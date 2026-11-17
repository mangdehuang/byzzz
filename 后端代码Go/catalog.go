package main

import (
	"database/sql"
	"net/http"
	"strings"
	"unicode/utf8"
)

type catalogItem struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	ParentID string `json:"parentId,omitempty"`
}

type catalogInput struct {
	Products *[]catalogItem `json:"products"`
	Devices  *[]catalogItem `json:"devices"`
	Points   *[]catalogItem `json:"points"`
}

func (a *app) listCatalog(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		parent := r.URL.Query().Get("parendId")
		if kind != "product" && !validPointCode(parent) {
			failure(w, http.StatusBadRequest, "缺少有效的上级编号")
			return
		}
		items, err := queryRows(r.Context(), a.db, func(rows *sql.Rows, item *catalogItem) error {
			return rows.Scan(&item.Code, &item.Name, &item.Type)
		}, `SELECT code,name,type FROM catalog WHERE kind=? AND parent=? ORDER BY name,code`, kind, parent)
		if err != nil {
			dbFailure(w, err)
			return
		}
		success(w, items)
	}
}

func validPointCode(value string) bool {
	// 逗号和 ## 是前端存储绑定与下拉框的分隔符。
	return strings.TrimSpace(value) == value && value != "" && utf8.RuneCountInString(value) <= 128 &&
		!strings.ContainsAny(value, ",\r\n\x00") && !strings.Contains(value, "##") &&
		value != "__proto__" && value != "constructor" && value != "prototype" && value != "hasOwnProperty"
}

func (a *app) replaceCatalog(w http.ResponseWriter, r *http.Request) {
	var input catalogInput
	if !readJSON(w, r, &input, 4<<20) {
		return
	}
	if input.Products == nil || input.Devices == nil || input.Points == nil {
		failure(w, http.StatusBadRequest, "请提供 products、devices 和 points 三个数组")
		return
	}
	levels := []struct {
		kind  string
		items []catalogItem
	}{{"product", *input.Products}, {"device", *input.Devices}, {"point", *input.Points}}

	parents := map[string]bool{"": true}
	for _, level := range levels {
		codes := make(map[string]bool, len(level.items))
		for _, item := range level.items {
			if !validPointCode(item.Code) || !validName(item.Name) || strings.Contains(item.Type, "##") ||
				!parents[item.ParentID] || codes[catalogKey(level.kind, item)] {
				failure(w, http.StatusBadRequest, "设备目录包含无效编号、重复记录或找不到上级")
				return
			}
			codes[catalogKey(level.kind, item)] = true
		}
		parents = codes
	}
	// 设备清单按整份快照替换，校验或写入失败时保留上一份目录。
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		dbFailure(w, err)
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(r.Context(), "DELETE FROM catalog"); err != nil {
		dbFailure(w, err)
		return
	}
	insert, err := tx.PrepareContext(r.Context(), "INSERT INTO catalog VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		dbFailure(w, err)
		return
	}
	defer insert.Close()
	for _, level := range levels {
		for _, item := range level.items {
			if _, err := insert.ExecContext(r.Context(), level.kind, item.ParentID, item.Code, item.Name, item.Type); err != nil {
				dbFailure(w, err)
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		dbFailure(w, err)
		return
	}
	success(w, len(*input.Products)+len(*input.Devices)+len(*input.Points))
}

// 同型号的多个设备可共用点位编号，设备编号本身用于下一级查询。
func catalogKey(kind string, item catalogItem) string {
	if kind == "point" {
		return item.ParentID + "\x00" + item.Code
	}
	return item.Code
}
