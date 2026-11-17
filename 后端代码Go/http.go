package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	documentLimit = 24 << 20
	imageLimit    = 10 << 20
)

type app struct {
	db    *sql.DB
	hub   *stageHub
	token string
}

func newApp(db *sql.DB, token string) *app {
	return &app{db: db, hub: newStageHub(), token: token}
}

// 保留当前插件使用的方法、路径以及 {code,msg,data} 响应结构。
func (a *app) routes(frontend frontendSite, local bool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /ims/scene", a.createScene)
	mux.HandleFunc("PUT /ims/scene", a.editScene)
	mux.HandleFunc("GET /ims/scene/{id}", a.getScene)
	mux.HandleFunc("GET /ztgl/hmgl/list", a.listScenes)
	mux.HandleFunc("GET /ims/scene/listProductStage", a.listCatalog("product"))
	mux.HandleFunc("GET /ims/scene/listDeviceStage", a.listCatalog("device"))
	mux.HandleFunc("GET /ims/scene/listParameterStage", a.listCatalog("point"))

	mux.HandleFunc("POST /ztgl/hmgl/insertTemplateStage", a.saveTemplate)
	mux.HandleFunc("POST /ztgl/hmgl/selectTemplateStageList", a.listTemplates)
	mux.HandleFunc("POST /ztgl/hmgl/templateStageDeleteById", a.deleteRecord("templates", "templateId"))
	mux.HandleFunc("POST /ztgl/hmgl/saveEditModuleGroup", a.saveGroup)
	mux.HandleFunc("POST /ztgl/hmgl/selectPictureGroupList", a.listGroups)
	mux.HandleFunc("POST /ztgl/hmgl/pictureGroupDeleteById", a.deleteGroup)
	mux.HandleFunc("POST /ztgl/hmgl/insertPicture", a.uploadPicture)
	mux.HandleFunc("POST /ztgl/hmgl/selectPictureList", a.listPictures)
	mux.HandleFunc("POST /ztgl/hmgl/pictureDeleteById", a.deleteRecord("pictures", "id"))
	mux.HandleFunc("GET /byzt-media/{file}", a.getPicture)

	mux.HandleFunc("GET /websocket/message/{stageId}", a.websocket)
	mux.HandleFunc("PUT /api/integration/catalog", a.integration(a.replaceCatalog))
	mux.HandleFunc("POST /api/integration/telemetry/{stageId}", a.integration(a.publishTelemetry))

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		entry := "/byzt/index_edit.html"
		if frontend.index != "" {
			entry = "/byzt/"
		}
		if r.URL.RawQuery != "" {
			entry += "?" + r.URL.RawQuery
		}
		http.Redirect(w, r, entry, http.StatusTemporaryRedirect)
	})
	mux.HandleFunc("GET /byzt/config/init.json", localFrontendConfig(frontend.assets))
	mux.Handle("GET /byzt/", frontend.handler())

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if local && !localRequestHost(r.Host) {
			failure(w, http.StatusForbidden, "请使用本机地址访问")
			return
		}
		// 插件与 API 同源托管。拒绝来自其他站点的浏览器表单写入。
		if origin := r.Header.Get("Origin"); origin != "" && r.Method != http.MethodGet && r.Method != http.MethodHead {
			u, err := url.Parse(origin)
			if err != nil || !strings.EqualFold(u.Host, r.Host) || (u.Scheme != "http" && u.Scheme != "https") {
				failure(w, http.StatusForbidden, "请求来源无效")
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}

func localRequestHost(host string) bool {
	u, err := url.Parse("http://" + host)
	if err != nil {
		return false
	}
	hostname := u.Hostname()
	ip := net.ParseIP(hostname)
	return strings.EqualFold(hostname, "localhost") || ip != nil && ip.IsLoopback()
}

// Go 托管的页面使用当前站点地址，磁盘上的原始集成配置可继续供其他部署使用。
func localFrontendConfig(frontend string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		raw, err := os.ReadFile(filepath.Join(frontend, "config/init.json"))
		if err != nil {
			dbFailure(w, err)
			return
		}
		var config map[string]json.RawMessage
		if err := json.Unmarshal(raw, &config); err != nil {
			dbFailure(w, err)
			return
		}
		if config == nil {
			failure(w, http.StatusInternalServerError, "前端配置无效")
			return
		}
		config["serviceIpPort"] = json.RawMessage(`""`)
		config["webSocketUrl"] = json.RawMessage(`"/websocket/message"`)
		config["goBackend"] = json.RawMessage("true")
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, config)
	}
}

func (a *app) integration(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.token == "" {
			failure(w, http.StatusServiceUnavailable, "尚未配置设备接入令牌")
			return
		}
		scheme, token, _ := strings.Cut(r.Header.Get("Authorization"), " ")
		if !strings.EqualFold(scheme, "Bearer") || subtle.ConstantTimeCompare([]byte(token), []byte(a.token)) != 1 {
			failure(w, http.StatusUnauthorized, "设备接入令牌无效")
			return
		}
		next(w, r)
	}
}

type response struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("写入 JSON 响应：%v", err)
	}
}

func success(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, response{Code: 200, Msg: "操作成功", Data: data})
}

func failure(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, response{Code: status, Msg: message})
}

func dbFailure(w http.ResponseWriter, err error) {
	log.Printf("处理请求失败：%v", err)
	failure(w, http.StatusInternalServerError, "服务暂时无法处理请求")
}

func readJSON(w http.ResponseWriter, r *http.Request, target any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(target)
	if err == nil {
		err = decoder.Decode(new(json.RawMessage))
		if errors.Is(err, io.EOF) {
			return true
		}
	}
	invalidBody(w, err)
	return false
}

func readForm(w http.ResponseWriter, r *http.Request, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	if err := r.ParseForm(); err != nil {
		invalidBody(w, err)
		return false
	}
	return true
}

func invalidBody(w http.ResponseWriter, err error) {
	var sizeError *http.MaxBytesError
	if errors.As(err, &sizeError) {
		failure(w, http.StatusRequestEntityTooLarge, "请求内容过大")
		return
	}
	failure(w, http.StatusBadRequest, "请求内容格式无效")
}

var validID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

func queryRows[T any](ctx context.Context, db *sql.DB, scan func(*sql.Rows, *T) error, query string, args ...any) ([]T, error) {
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []T{}
	for rows.Next() {
		var item T
		if err := scan(rows, &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func affected(w http.ResponseWriter, result sql.Result, err error) {
	if err != nil {
		dbFailure(w, err)
		return
	}
	count, err := result.RowsAffected()
	if err != nil {
		dbFailure(w, err)
		return
	}
	success(w, count)
}
