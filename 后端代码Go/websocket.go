package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

type stageClient struct {
	send   chan []byte
	cancel context.CancelFunc
}

type stageHub struct {
	mu    sync.Mutex
	rooms map[string]map[*stageClient]struct{}
}

func newStageHub() *stageHub {
	return &stageHub{rooms: make(map[string]map[*stageClient]struct{})}
}

func (h *stageHub) join(stageID string, client *stageClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[stageID] == nil {
		h.rooms[stageID] = make(map[*stageClient]struct{})
	}
	h.rooms[stageID][client] = struct{}{}
}

func (h *stageHub) leave(stageID string, client *stageClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms[stageID], client)
	if len(h.rooms[stageID]) == 0 {
		delete(h.rooms, stageID)
	}
}

// 和 Java WebSocketPool 一样按画面广播。慢连接不会拖住其他监控页。
func (h *stageHub) broadcast(stageID string, payload []byte) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	delivered := 0
	for client := range h.rooms[stageID] {
		if client.enqueue(payload) {
			delivered++
		}
	}
	return delivered
}

func (c *stageClient) enqueue(payload []byte) bool {
	select {
	case c.send <- payload:
		return true
	default:
		c.cancel()
		return false
	}
}

type incomingMessage struct {
	Type    string `json:"sandType"`
	Content struct {
		StageID     string          `json:"stageId"`
		DataPointID string          `json:"dataPointId"`
		Value       json.RawMessage `json:"value"`
	} `json:"content"`
}

type outgoingMessage struct {
	Type    string `json:"MESSAGETYPE"`
	Content any    `json:"MESSAGECONTENT"`
	Success *bool  `json:"SUCCESS,omitempty"`
}

func (c *stageClient) reply(message outgoingMessage) {
	payload, _ := json.Marshal(message) // 回复内容仅包含字符串和布尔值。
	c.enqueue(payload)
}

func (a *app) websocket(w http.ResponseWriter, r *http.Request) {
	stageID := r.PathValue("stageId")
	if !validID.MatchString(stageID) {
		failure(w, http.StatusBadRequest, "画面 ID 无效")
		return
	}
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(64 << 10)
	ctx, cancel := context.WithCancel(r.Context())
	client := &stageClient{send: make(chan []byte, 16), cancel: cancel}
	a.hub.join(stageID, client)
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		defer cancel()
		for {
			select {
			case <-ctx.Done():
				return
			case payload := <-client.send:
				writeCtx, finish := context.WithTimeout(ctx, 5*time.Second)
				err := conn.Write(writeCtx, websocket.MessageText, payload)
				finish()
				if err != nil {
					return
				}
			}
		}
	}()
	defer func() {
		a.hub.leave(stageID, client)
		cancel()
		<-writerDone
	}()

	for {
		readCtx, finish := context.WithTimeout(ctx, 45*time.Second)
		messageType, data, err := conn.Read(readCtx)
		finish()
		if err != nil {
			return
		}
		var message incomingMessage
		if messageType != websocket.MessageText || json.Unmarshal(data, &message) != nil {
			continue
		}
		// 路由上的画面 ID 决定连接归属，客户端消息不能跨画面操作。
		if message.Content.StageID != "" && message.Content.StageID != stageID {
			continue
		}
		switch message.Type {
		case "LEAVE":
			return
		case "HEARTCMD":
			client.reply(outgoingMessage{Type: "05", Content: "心跳正常"})
		case "CONTROLCMD":
			messageText := "现场设备控制尚未接入"
			if !validPointCode(message.Content.DataPointID) || len(message.Content.Value) == 0 ||
				string(message.Content.Value) == "null" {
				messageText = "控制指令参数无效"
			}
			sent := false
			client.reply(outgoingMessage{Type: "04", Content: messageText, Success: &sent})
		}
	}
}

func (a *app) publishTelemetry(w http.ResponseWriter, r *http.Request) {
	stageID := r.PathValue("stageId")
	if !validID.MatchString(stageID) {
		failure(w, http.StatusBadRequest, "画面 ID 无效")
		return
	}
	var values map[string]json.RawMessage
	if !readJSON(w, r, &values, 256<<10) {
		return
	}
	if len(values) == 0 {
		failure(w, http.StatusBadRequest, "请提供数据点编号到实际值的映射")
		return
	}
	var keys string
	err := a.db.QueryRowContext(r.Context(), "SELECT data_keys FROM scenes WHERE id=?", stageID).Scan(&keys)
	if errors.Is(err, sql.ErrNoRows) {
		failure(w, http.StatusNotFound, "画面不存在")
		return
	}
	if err != nil {
		dbFailure(w, err)
		return
	}
	bound := make(map[string]bool)
	for _, key := range strings.Split(keys, ",") {
		bound[strings.TrimSpace(key)] = true
	}
	for key := range values {
		if !validPointCode(key) || !bound[key] {
			failure(w, http.StatusUnprocessableEntity, "消息包含未绑定到该画面的数据点")
			return
		}
	}
	payload, err := json.Marshal(outgoingMessage{Type: "01", Content: values})
	if err != nil {
		dbFailure(w, err)
		return
	}
	success(w, a.hub.broadcast(stageID, payload))
}
