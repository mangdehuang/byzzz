package main

import (
	"net/http"
	"os"
	"path"
	"strings"
)

type frontendSite struct {
	assets string
	index  string
}

func (s frontendSite) handler() http.Handler {
	files := http.StripPrefix("/byzt", http.FileServer(http.Dir(s.assets)))
	if s.index == "" {
		return files
	}
	// 旧路径和专用弹窗复用同一个入口，普通静态资源仍按原路径访问。
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 公式 Worker 允许计算脚本，但禁止其加载外部脚本、读取网络和设备接口。
		if strings.HasPrefix(path.Base(r.URL.Path), "formula-worker-") && strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'")
		}
		switch strings.ToLower(path.Ext(r.URL.Path)) {
		case ".html", ".htm":
			s.serveEntry(w, r)
		default:
			if r.URL.Path == "/byzt/" {
				s.serveEntry(w, r)
				return
			}
			files.ServeHTTP(w, r)
		}
	})
}

func (s frontendSite) serveEntry(w http.ResponseWriter, r *http.Request) {
	entry, err := os.Open(s.index)
	if err != nil {
		dbFailure(w, err)
		return
	}
	defer entry.Close()
	info, err := entry.Stat()
	if err != nil {
		dbFailure(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, "index.html", info.ModTime(), entry)
}
