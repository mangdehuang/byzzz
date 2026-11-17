package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type scene struct {
	ID        string `json:"id"`
	Name      string `json:"stageName"`
	StageJSON string `json:"stagedatajson"`
	Thumbnail string `json:"stagebase64"`
	DataKeys  string `json:"datakeyarray"`
}

// 接受插件保存的 JSON 字符串以及导入时的 JSON 对象，保持对象内部字段原样。
type stageDocument string

func (d *stageDocument) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '{' {
		*d = stageDocument(data)
		return nil
	}
	var text string
	if err := json.Unmarshal(data, &text); err != nil {
		return err
	}
	*d = stageDocument(text)
	return nil
}

type sceneInput struct {
	ID        json.RawMessage `json:"id"`
	Name      *string         `json:"stageName"`
	StageJSON stageDocument   `json:"stagedatajson"`
	Thumbnail *string         `json:"stagebase64"`
	DataKeys  *string         `json:"datakeyarray"`
}

func sceneID(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var id string
	if json.Unmarshal(raw, &id) == nil {
		return id
	}
	return string(raw)
}

func validStage(raw string) bool {
	var doc struct {
		ClassName string          `json:"className"`
		Attrs     json.RawMessage `json:"attrs"`
		Children  json.RawMessage `json:"children"`
	}
	return json.Unmarshal([]byte(raw), &doc) == nil && doc.ClassName == "Stage" &&
		len(doc.Attrs) > 0 && doc.Attrs[0] == '{' && len(doc.Children) > 0 && doc.Children[0] == '['
}

func validName(name string) bool {
	return strings.TrimSpace(name) != "" && utf8.RuneCountInString(name) <= 200
}

// 列表缩略图会作为 img 的来源，限制为插件生成的栅格图片。
func validThumbnail(value string) bool {
	if value == "" {
		return true
	}
	prefix, body, ok := strings.Cut(value, ",")
	if !ok || len(body) == 0 {
		return false
	}
	switch prefix {
	case "data:image/png;base64", "data:image/jpeg;base64", "data:image/webp;base64", "data:image/gif;base64":
	default:
		return false
	}
	return base64Text.MatchString(body)
}

func (a *app) createScene(w http.ResponseWriter, r *http.Request) {
	var input sceneInput
	if !readJSON(w, r, &input, documentLimit) {
		return
	}
	name := "未命名画面"
	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
	}
	id := sceneID(input.ID)
	if !validName(name) || !validStage(string(input.StageJSON)) || !validThumbnail(valueOrEmpty(input.Thumbnail)) ||
		(id != "" && !validID.MatchString(id)) {
		failure(w, http.StatusBadRequest, "画面 ID、名称、组态 JSON 或缩略图无效")
		return
	}
	// 导入旧画面时可保留 ID，避免已有的画面跳转和监控链接失效。
	if id == "" {
		id = newRecordID()
	}
	result := scene{
		ID: id, Name: name, StageJSON: string(input.StageJSON),
		Thumbnail: valueOrEmpty(input.Thumbnail), DataKeys: valueOrEmpty(input.DataKeys),
	}
	inserted, err := a.db.ExecContext(r.Context(), `INSERT INTO scenes VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
		result.ID, result.Name, result.StageJSON, result.Thumbnail, result.DataKeys, time.Now().UnixMilli())
	if err != nil {
		dbFailure(w, err)
		return
	}
	count, err := inserted.RowsAffected()
	if err != nil {
		dbFailure(w, err)
		return
	}
	if count == 0 {
		failure(w, http.StatusConflict, "画面 ID 已存在")
		return
	}
	success(w, result)
}

func (a *app) editScene(w http.ResponseWriter, r *http.Request) {
	var input sceneInput
	if !readJSON(w, r, &input, documentLimit) {
		return
	}
	id := sceneID(input.ID)
	if !validID.MatchString(id) || !validStage(string(input.StageJSON)) ||
		input.Name != nil && !validName(*input.Name) || !validThumbnail(valueOrEmpty(input.Thumbnail)) {
		failure(w, http.StatusBadRequest, "画面 ID、名称、组态 JSON 或缩略图无效")
		return
	}
	result, err := a.db.ExecContext(r.Context(), `UPDATE scenes SET name=coalesce(?, name),
stage_json=?, thumbnail=coalesce(?, thumbnail), data_keys=coalesce(?, data_keys), updated_at=? WHERE id=?`,
		input.Name, input.StageJSON, input.Thumbnail, input.DataKeys, time.Now().UnixMilli(), id)
	affected(w, result, err)
}

func (a *app) getScene(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validID.MatchString(id) {
		failure(w, http.StatusBadRequest, "画面 ID 无效")
		return
	}
	result := scene{ID: id}
	err := a.db.QueryRowContext(r.Context(), `SELECT name,stage_json,thumbnail,data_keys FROM scenes WHERE id=?`, id).
		Scan(&result.Name, &result.StageJSON, &result.Thumbnail, &result.DataKeys)
	if errors.Is(err, sql.ErrNoRows) {
		failure(w, http.StatusNotFound, "画面不存在")
		return
	}
	if err != nil {
		dbFailure(w, err)
		return
	}
	success(w, result)
}

type sceneSummary struct {
	ID        string `json:"stageId"`
	Name      string `json:"stageName"`
	Thumbnail string `json:"stageBase64"`
}

func (a *app) listScenes(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page := pageNumber(query.Get("pageNum"), 1, 1_000_000)
	size := pageNumber(query.Get("pageSize"), 10, 100)
	name := strings.TrimSpace(query.Get("stageName"))
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		dbFailure(w, err)
		return
	}
	defer tx.Rollback()
	var total int
	if err := tx.QueryRowContext(r.Context(), `SELECT count(*) FROM scenes WHERE instr(name, ?) > 0`, name).Scan(&total); err != nil {
		dbFailure(w, err)
		return
	}
	rows, err := tx.QueryContext(r.Context(), `SELECT id,name,thumbnail FROM scenes WHERE instr(name, ?) > 0
ORDER BY updated_at DESC, id LIMIT ? OFFSET ?`, name, size, (page-1)*size)
	if err != nil {
		dbFailure(w, err)
		return
	}
	items := []sceneSummary{}
	for rows.Next() {
		var item sceneSummary
		if err := rows.Scan(&item.ID, &item.Name, &item.Thumbnail); err != nil {
			rows.Close()
			dbFailure(w, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		dbFailure(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		dbFailure(w, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Code  int            `json:"code"`
		Msg   string         `json:"msg"`
		Total int            `json:"total"`
		Rows  []sceneSummary `json:"rows"`
	}{200, "操作成功", total, items})
}

func pageNumber(raw string, fallback, limit int) int {
	if n, err := strconv.Atoi(raw); err == nil && n > 0 {
		return min(n, limit)
	}
	return fallback
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
