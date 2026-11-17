package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 只给新构建目录即可启动；旧入口存在也不能掩盖缺失的构建产物。
func TestFrontendRequiresVueBuild(t *testing.T) {
	dir := t.TempDir()
	assets := filepath.Join(dir, "byzt")
	if err := os.MkdirAll(filepath.Join(assets, "config"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("BY_VUE_DIR", assets)
	for _, file := range []string{"index_edit.html", "config/init.json"} {
		if err := os.WriteFile(filepath.Join(assets, file), []byte("{}"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := frontendDir(); err == nil || !strings.Contains(err.Error(), "pnpm build") {
		t.Fatalf("missing Vue entry must fail clearly, got %v", err)
	}
	index := filepath.Join(dir, "index.html")
	if err := os.WriteFile(index, []byte("<div id=app></div>"), 0600); err != nil {
		t.Fatal(err)
	}
	site, err := frontendDir()
	if err != nil || site.index != index || site.assets != assets {
		t.Fatalf("standalone build was not selected: %+v, %v", site, err)
	}
	if err := os.Remove(filepath.Join(assets, "config/init.json")); err != nil {
		t.Fatal(err)
	}
	if _, err := frontendDir(); err == nil {
		t.Fatal("missing Vue configuration must fail")
	}
}

// 公式计算线程不能联网；普通应用脚本继续沿用自己的加载策略。
func TestFormulaWorkerNetworkPolicy(t *testing.T) {
	dir := t.TempDir()
	assets := filepath.Join(dir, "byzt")
	if err := os.MkdirAll(filepath.Join(assets, "assets"), 0700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"formula-worker-abc.js", "editor.js"} {
		if err := os.WriteFile(filepath.Join(assets, "assets", name), []byte("self.onmessage=()=>{}"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	handler := (frontendSite{assets: assets, index: filepath.Join(dir, "index.html")}).handler()
	for _, name := range []string{"formula-worker-abc.js", "editor.js"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "/byzt/assets/"+name, nil))
		if w.Code != http.StatusOK {
			t.Fatalf("script failed: %d", w.Code)
		}
		policy := w.Header().Get("Content-Security-Policy")
		if strings.HasPrefix(name, "formula-worker-") {
			if !strings.Contains(policy, "connect-src 'none'") || !strings.Contains(policy, "script-src 'unsafe-eval'") {
				t.Fatalf("worker policy: %s", policy)
			}
		} else if policy != "" {
			t.Fatalf("ordinary scripts must not receive the worker-only policy: %s", policy)
		}
	}
}
