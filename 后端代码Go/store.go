package main

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// 文件库使用一个连接，保证 SQLite 的写入顺序和连接级配置。
func openDB(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return nil, err
	}
	if err := file.Close(); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
PRAGMA busy_timeout = 5000;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS scenes (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	stage_json TEXT NOT NULL,
	thumbnail TEXT NOT NULL,
	data_keys TEXT NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	stage_json TEXT NOT NULL,
	thumbnail TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS picture_groups (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pictures (
	id TEXT PRIMARY KEY,
	group_id TEXT NOT NULL,
	extension TEXT NOT NULL,
	content_type TEXT NOT NULL,
	content BLOB NOT NULL,
	deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pictures_by_group ON pictures(group_id, deleted);
CREATE TABLE IF NOT EXISTS catalog (
	kind TEXT NOT NULL,
	parent TEXT NOT NULL,
	code TEXT NOT NULL,
	name TEXT NOT NULL,
	type TEXT NOT NULL,
	PRIMARY KEY (kind, parent, code)
);
CREATE INDEX IF NOT EXISTS catalog_by_parent ON catalog(kind, parent);
`)
	if err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
