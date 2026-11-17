package main

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var base64Text = regexp.MustCompile(`^[A-Za-z0-9+/]+={0,2}$`)

func newRecordID() string {
	var bytes [16]byte
	rand.Read(bytes[:])
	return hex.EncodeToString(bytes[:])
}

type templateRecord struct {
	ID        string `json:"templateId"`
	Name      string `json:"templateName"`
	StageJSON string `json:"stageDatajson"`
	Thumbnail string `json:"stageBase64"`
}

func (a *app) saveTemplate(w http.ResponseWriter, r *http.Request) {
	if !readForm(w, r, documentLimit) {
		return
	}
	item := templateRecord{
		ID: r.PostForm.Get("templateId"), Name: strings.TrimSpace(r.PostForm.Get("templateName")),
		StageJSON: r.PostForm.Get("stageDatajson"), Thumbnail: r.PostForm.Get("stageBase64"),
	}
	if !validName(item.Name) || !validStage(item.StageJSON) || !validThumbnail(item.Thumbnail) ||
		(item.ID != "" && !validID.MatchString(item.ID)) {
		failure(w, http.StatusBadRequest, "模板名称、ID、组态 JSON 或缩略图无效")
		return
	}
	var result sql.Result
	var err error
	if item.ID == "" {
		item.ID = newRecordID()
		result, err = a.db.ExecContext(r.Context(), `INSERT INTO templates VALUES (?, ?, ?, ?)`,
			item.ID, item.Name, item.StageJSON, item.Thumbnail)
	} else {
		result, err = a.db.ExecContext(r.Context(), `UPDATE templates SET name=?, stage_json=?, thumbnail=? WHERE id=?`,
			item.Name, item.StageJSON, item.Thumbnail, item.ID)
	}
	if err != nil {
		dbFailure(w, err)
		return
	}
	count, err := result.RowsAffected()
	if err != nil {
		dbFailure(w, err)
		return
	}
	if count == 0 {
		failure(w, http.StatusNotFound, "模板不存在")
		return
	}
	// 旧版插件用 msg 中的 32 位模板 ID 判断保存成功。
	writeJSON(w, http.StatusOK, response{Code: 200, Msg: item.ID, Data: item})
}

func (a *app) listTemplates(w http.ResponseWriter, r *http.Request) {
	items, err := queryRows(r.Context(), a.db, func(rows *sql.Rows, item *templateRecord) error {
		return rows.Scan(&item.ID, &item.Name, &item.StageJSON, &item.Thumbnail)
	}, `SELECT id,name,stage_json,thumbnail FROM templates ORDER BY name,id`)
	if err != nil {
		dbFailure(w, err)
		return
	}
	success(w, items)
}

type pictureGroup struct {
	ID   string `json:"groupId"`
	Name string `json:"groupName"`
}

func (a *app) saveGroup(w http.ResponseWriter, r *http.Request) {
	if !readForm(w, r, 64<<10) {
		return
	}
	id, name := r.PostForm.Get("groupId"), strings.TrimSpace(r.PostForm.Get("groupName"))
	if !validName(name) || id != "" && !validID.MatchString(id) {
		failure(w, http.StatusBadRequest, "分组名称或 ID 无效")
		return
	}
	if id == "" {
		result, err := a.db.ExecContext(r.Context(), `INSERT INTO picture_groups VALUES (?, ?)`, newRecordID(), name)
		affected(w, result, err)
		return
	}
	result, err := a.db.ExecContext(r.Context(), `UPDATE picture_groups SET name=? WHERE id=?`, name, id)
	affected(w, result, err)
}

func (a *app) listGroups(w http.ResponseWriter, r *http.Request) {
	items, err := queryRows(r.Context(), a.db, func(rows *sql.Rows, item *pictureGroup) error {
		return rows.Scan(&item.ID, &item.Name)
	}, `SELECT id,name FROM picture_groups ORDER BY name,id`)
	if err != nil {
		dbFailure(w, err)
		return
	}
	success(w, items)
}

func (a *app) deleteGroup(w http.ResponseWriter, r *http.Request) {
	id, ok := readFormID(w, r, "groupId")
	if !ok {
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		dbFailure(w, err)
		return
	}
	defer tx.Rollback()
	var hasPictures bool
	err = tx.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM pictures WHERE group_id=? AND deleted=0)`, id).Scan(&hasPictures)
	if err != nil {
		dbFailure(w, err)
		return
	}
	if hasPictures {
		success(w, -1)
		return
	}
	result, err := tx.ExecContext(r.Context(), `DELETE FROM picture_groups WHERE id=?`, id)
	if err == nil {
		err = tx.Commit()
	}
	affected(w, result, err)
}

func readFormID(w http.ResponseWriter, r *http.Request, field string) (string, bool) {
	if !readForm(w, r, 64<<10) {
		return "", false
	}
	id := r.PostForm.Get(field)
	if !validID.MatchString(id) {
		failure(w, http.StatusBadRequest, "记录 ID 无效")
		return "", false
	}
	return id, true
}

func (a *app) deleteRecord(table, field string) http.HandlerFunc {
	query := `DELETE FROM templates WHERE id=?`
	if table == "pictures" {
		// 已保存的画面仍可能引用图库图片，删除只影响图库列表。
		query = `UPDATE pictures SET deleted=1 WHERE id=? AND deleted=0`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := readFormID(w, r, field)
		if !ok {
			return
		}
		result, err := a.db.ExecContext(r.Context(), query, id)
		affected(w, result, err)
	}
}

type pictureRecord struct {
	ID  string `json:"id"`
	URL string `json:"picUrl"`
}

func (a *app) listPictures(w http.ResponseWriter, r *http.Request) {
	id, ok := readFormID(w, r, "groupId")
	if !ok {
		return
	}
	items, err := queryRows(r.Context(), a.db, func(rows *sql.Rows, item *pictureRecord) error {
		var extension string
		err := rows.Scan(&item.ID, &extension)
		item.URL = "/byzt-media/" + item.ID + extension
		return err
	}, `SELECT id,extension FROM pictures WHERE group_id=? AND deleted=0 ORDER BY rowid`, id)
	if err != nil {
		dbFailure(w, err)
		return
	}
	success(w, items)
}

func (a *app) uploadPicture(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, imageLimit+(64<<10))
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		invalidBody(w, err)
		return
	}
	defer r.MultipartForm.RemoveAll()
	groupID := r.PostForm.Get("groupId")
	if !validID.MatchString(groupID) {
		failure(w, http.StatusBadRequest, "图片分组无效")
		return
	}
	file, _, err := r.FormFile("imagefile")
	if err != nil {
		failure(w, http.StatusBadRequest, "请选择图片文件")
		return
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, imageLimit+1))
	if err != nil {
		dbFailure(w, err)
		return
	}
	if len(content) > imageLimit {
		failure(w, http.StatusRequestEntityTooLarge, "图片文件超过 10 MiB")
		return
	}
	extension, contentType := imageFormat(content)
	if extension == "" {
		failure(w, http.StatusBadRequest, "仅支持 JPEG、PNG、GIF 和 SVG 图片")
		return
	}
	// 图片元数据和文件内容使用一次数据库写入，且分组必须仍然存在。
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO pictures(id,group_id,extension,content_type,content)
SELECT ?,id,?,?,? FROM picture_groups WHERE id=?`, newRecordID(), extension, contentType, content, groupID)
	affected(w, result, err)
}

func imageFormat(content []byte) (string, string) {
	contentType := http.DetectContentType(content)
	switch contentType {
	case "image/jpeg":
		return ".jpg", contentType
	case "image/png":
		return ".png", contentType
	case "image/gif":
		return ".gif", contentType
	}
	var root struct{ XMLName xml.Name }
	if xml.Unmarshal(bytes.TrimPrefix(content, []byte{0xef, 0xbb, 0xbf}), &root) == nil &&
		root.XMLName.Local == "svg" && (root.XMLName.Space == "" || root.XMLName.Space == "http://www.w3.org/2000/svg") {
		return ".svg", "image/svg+xml"
	}
	return "", ""
}

func (a *app) getPicture(w http.ResponseWriter, r *http.Request) {
	id, ext, ok := strings.Cut(r.PathValue("file"), ".")
	if !ok || !validID.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	var content []byte
	var contentType string
	err := a.db.QueryRowContext(r.Context(), `SELECT content,content_type FROM pictures WHERE id=? AND extension=?`,
		id, "."+ext).Scan(&content, &contentType)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		dbFailure(w, err)
		return
	}
	// 直接打开用户上传的 SVG 时禁止脚本、外部资源与同源权限。
	w.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:")
	w.Header().Set("Content-Type", contentType)
	http.ServeContent(w, r, r.PathValue("file"), time.Time{}, bytes.NewReader(content))
}
