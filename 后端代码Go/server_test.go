package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

const testStage = `{"className":"Stage","attrs":{"width":1024,"height":768},"children":[]}`

type testResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func request(t *testing.T, handler http.Handler, method, path, contentType, body string, status int) testResponse {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", contentType)
	r.Header.Set("Authorization", "Bearer integration-test")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != status {
		t.Fatalf("%s %s = %d, want %d: %s", method, path, w.Code, status, w.Body)
	}
	var response testResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}

func dataAs[T any](t *testing.T, response testResponse) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(response.Data, &value); err != nil {
		t.Fatal(err)
	}
	return value
}

func createTestScene(t *testing.T, handler http.Handler) scene {
	t.Helper()
	body := `{"stageName":"监控-画面","stagedatajson":` + testStage + `,"datakeyarray":"device_temperature,device_power"}`
	return dataAs[scene](t, request(t, handler, "POST", "/ims/scene", "application/json", body, 200))
}

func TestFrontendAliasesUseOneEntry(t *testing.T) {
	dist := t.TempDir()
	assets := filepath.Join(dist, "byzt")
	index := filepath.Join(dist, "index.html")
	if err := os.MkdirAll(filepath.Join(assets, "config"), 0700); err != nil {
		t.Fatal(err)
	}
	const shell = "<!doctype html><div id=app></div>"
	for path, body := range map[string]string{
		index: shell, filepath.Join(assets, "config", "init.json"): `{}`,
		filepath.Join(assets, "engine.js"): "window.byzt = true;",
	} {
		if err := os.WriteFile(path, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	db, err := openDB(filepath.Join(t.TempDir(), "byzt.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	handler := newApp(db, "").routes(frontendSite{assets: assets, index: index}, false)
	for _, path := range []string{"/byzt/", "/byzt/index_edit.html?id=123", "/byzt/preview.html", "/byzt/editMoudle/editText.html"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != http.StatusOK || w.Body.String() != shell {
			t.Fatalf("entry alias %s returned %d: %s", path, w.Code, w.Body)
		}
	}
	redirect := httptest.NewRecorder()
	handler.ServeHTTP(redirect, httptest.NewRequest("GET", "/?id=123", nil))
	if redirect.Header().Get("Location") != "/byzt/?id=123" {
		t.Fatalf("redirect discarded editor parameters: %s", redirect.Header().Get("Location"))
	}
	static := httptest.NewRecorder()
	handler.ServeHTTP(static, httptest.NewRequest("GET", "/byzt/engine.js", nil))
	if static.Code != http.StatusOK || static.Body.String() != "window.byzt = true;" {
		t.Fatalf("engine resource was not served: %d", static.Code)
	}
}

func TestScenePersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "byzt.sqlite")
	db, err := openDB(path)
	if err != nil {
		t.Fatal(err)
	}
	handler := newApp(db, "").routes(frontendSite{assets: t.TempDir()}, false)
	item := createTestScene(t, handler)
	editBody := `{"id":"` + item.ID + `","stagedatajson":` + testStage + `,"stageName":"更新-画面"}`
	if count := dataAs[int](t, request(t, handler, "PUT", "/ims/scene", "application/json", editBody, 200)); count != 1 {
		t.Fatalf("edit count = %d", count)
	}
	request(t, handler, "GET", "/ims/scene/unknown", "", "", 404)
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = openDB(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	handler = newApp(db, "").routes(frontendSite{assets: t.TempDir()}, false)
	got := dataAs[scene](t, request(t, handler, "GET", "/ims/scene/"+item.ID, "", "", 200))
	if got.ID != item.ID || got.Name != "更新-画面" || got.StageJSON != testStage || got.DataKeys != item.DataKeys {
		t.Fatalf("unexpected persisted scene: %+v", got)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "/ztgl/hmgl/list?pageNum=1&pageSize=1&stageName="+url.QueryEscape("更新"), nil))
	var page struct {
		Rows  []sceneSummary `json:"rows"`
		Total int            `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil || page.Total != 1 ||
		len(page.Rows) != 1 || page.Rows[0].ID != item.ID {
		t.Fatalf("unexpected scene list: %s", w.Body)
	}
}

func testHandler(t *testing.T, token string) http.Handler {
	t.Helper()
	db, err := openDB(filepath.Join(t.TempDir(), "byzt.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return newApp(db, token).routes(frontendSite{assets: t.TempDir()}, false)
}

func TestTemplateAndPictureLibrary(t *testing.T) {
	handler := testHandler(t, "")
	const base = "/ztgl/hmgl/"
	post := func(path string, form url.Values) testResponse {
		return request(t, handler, "POST", base+path, "application/x-www-form-urlencoded", form.Encode(), 200)
	}
	template := url.Values{"templateName": {"模板"}, "stageDatajson": {testStage}}
	created := post("insertTemplateStage", template)
	if len(created.Msg) != 32 {
		t.Fatalf("legacy msg template ID = %q", created.Msg)
	}
	template.Set("templateId", created.Msg)
	template.Set("templateName", "更新后的模板")
	post("insertTemplateStage", template)
	templates := dataAs[[]templateRecord](t, post("selectTemplateStageList", nil))
	if len(templates) != 1 || templates[0].Name != "更新后的模板" {
		t.Fatalf("unexpected templates: %+v", templates)
	}
	post("templateStageDeleteById", url.Values{"templateId": {created.Msg}})
	if got := dataAs[[]templateRecord](t, post("selectTemplateStageList", nil)); got == nil || len(got) != 0 {
		t.Fatalf("expected empty template array, got %#v", got)
	}

	post("saveEditModuleGroup", url.Values{"groupName": {"图库"}})
	groups := dataAs[[]pictureGroup](t, post("selectPictureGroupList", nil))
	if len(groups) != 1 {
		t.Fatalf("unexpected groups: %+v", groups)
	}
	group := url.Values{"groupId": {groups[0].ID}}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("groupId", groups[0].ID); err != nil {
		t.Fatal(err)
	}
	file, err := writer.CreateFormFile("imagefile", "icon.svg")
	if err != nil {
		t.Fatal(err)
	}
	image := `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>`
	if _, err := io.WriteString(file, image); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if count := dataAs[int](t, request(t, handler, "POST", base+"insertPicture", writer.FormDataContentType(), body.String(), 200)); count != 1 {
		t.Fatalf("upload count = %d", count)
	}
	pictures := dataAs[[]pictureRecord](t, post("selectPictureList", group))
	if len(pictures) != 1 || !strings.HasSuffix(pictures[0].URL, ".svg") {
		t.Fatalf("unexpected pictures: %+v", pictures)
	}
	if count := dataAs[int](t, post("pictureGroupDeleteById", group)); count != -1 {
		t.Fatalf("nonempty group delete returned %d", count)
	}
	post("pictureDeleteById", url.Values{"id": {pictures[0].ID}})
	post("pictureGroupDeleteById", group)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", pictures[0].URL, nil))
	if w.Code != 200 || w.Body.String() != image || !strings.Contains(w.Header().Get("Content-Security-Policy"), "sandbox") {
		t.Fatalf("picture referenced by a saved scene is unavailable: %d", w.Code)
	}
}

func TestCatalogRejectsPartialReplacement(t *testing.T) {
	handler := testHandler(t, "integration-test")
	catalog := `{"products":[{"code":"p","name":"项目"}],"devices":[{"code":"d1","parentId":"p","name":"设备1"},{"code":"d2","parentId":"p","name":"设备2"}],
"points":[{"code":"temp","parentId":"d1","name":"温度1"},{"code":"temp","parentId":"d2","name":"温度2"}]}`
	const path = "/api/integration/catalog"
	request(t, handler, "PUT", path, "application/json", catalog, 200)
	request(t, handler, "PUT", path, "application/json", strings.Replace(catalog, `"parentId":"d2"`, `"parentId":"absent"`, 1), 400)
	for device, name := range map[string]string{"d1": "温度1", "d2": "温度2"} {
		got := dataAs[[]catalogItem](t, request(t, handler, "GET", "/ims/scene/listParameterStage?parendId="+device, "", "", 200))
		if len(got) != 1 || got[0].Name != name || got[0].Code != "temp" {
			t.Fatalf("unexpected points for %s: %+v", device, got)
		}
	}
}

func TestWebSocketRoutesTelemetryByStage(t *testing.T) {
	handler := testHandler(t, "integration-test")
	a, b := createTestScene(t, handler), createTestScene(t, handler)
	server := httptest.NewServer(handler)
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	connect := func(stage scene) *websocket.Conn {
		t.Helper()
		conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http")+"/websocket/message/"+stage.ID, nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { conn.CloseNow() })
		// 收到心跳后，服务端已经把连接加入了画面房间。
		sendMessage(t, ctx, conn, `{"sandType":"HEARTCMD","content":{"stageId":"`+stage.ID+`","value":"00000"}}`)
		if reply := readMessage(t, ctx, conn); reply.Type != "05" {
			t.Fatalf("heartbeat = %+v", reply)
		}
		return conn
	}
	a1, a2, other := connect(a), connect(a), connect(b)
	const publish = "/api/integration/telemetry/"
	request(t, handler, "POST", publish+a.ID, "application/json", `{"unbound":1}`, 422)
	response := request(t, handler, "POST", publish+a.ID, "application/json", `{"device_temperature":0,"device_power":true}`, 200)
	if count := dataAs[int](t, response); count != 2 {
		t.Fatalf("queued for %d connections", count)
	}
	for _, conn := range []*websocket.Conn{a1, a2} {
		reply := readMessage(t, ctx, conn)
		values, ok := reply.Content.(map[string]any)
		if reply.Type != "01" || !ok || values["device_temperature"] != float64(0) || values["device_power"] != true {
			t.Fatalf("unexpected telemetry: %+v", reply)
		}
	}
	sendMessage(t, ctx, other, `{"sandType":"CONTROLCMD","content":{"stageId":"`+b.ID+`","dataPointId":"device_power","value":0}}`)
	if reply := readMessage(t, ctx, other); reply.Type != "04" || reply.Success == nil || *reply.Success {
		t.Fatalf("separate stage must only receive its own failed command reply: %+v", reply)
	}
	sendMessage(t, ctx, a2, `{"sandType":"LEAVE"}`)
	if _, _, err := a2.Read(ctx); err == nil {
		t.Fatal("LEAVE did not close connection")
	}
}

func sendMessage(t *testing.T, ctx context.Context, conn *websocket.Conn, text string) {
	t.Helper()
	if err := conn.Write(ctx, websocket.MessageText, []byte(text)); err != nil {
		t.Fatal(err)
	}
}

func readMessage(t *testing.T, ctx context.Context, conn *websocket.Conn) outgoingMessage {
	t.Helper()
	_, payload, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var message outgoingMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		t.Fatal(err)
	}
	return message
}
