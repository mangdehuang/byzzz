package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

// 默认从项目目录加载 .env，进程环境变量具有更高优先级。
func main() {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Fatal("读取 .env 失败：", err)
	}
	addr := env("BY_LISTEN", "127.0.0.1:8088")
	dbPath := env("BY_DB_PATH", "./data/byzt.sqlite")
	frontend, err := frontendDir()
	if err != nil {
		log.Fatal("检查前端目录失败：", err)
	}
	db, err := openDB(dbPath)
	if err != nil {
		log.Fatal("初始化 SQLite 失败：", err)
	}
	defer db.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		log.Fatal("BY_LISTEN 需填写主机和端口：", err)
	}
	ip := net.ParseIP(host)
	local := strings.EqualFold(host, "localhost") || ip != nil && ip.IsLoopback()
	app := newApp(db, strings.TrimSpace(os.Getenv("BY_INTEGRATION_TOKEN")))
	server := &http.Server{
		Addr:              addr,
		Handler:           app.routes(frontend, local),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       45 * time.Second,
		WriteTimeout:      45 * time.Second,
		IdleTimeout:       90 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return ctx },
	}
	result := make(chan error, 1)
	go func() { result <- server.ListenAndServe() }()
	log.Printf("BY 组态服务监听 %s", addr)
	select {
	case err := <-result:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			log.Printf("关闭 HTTP 服务：%v", err)
		}
	}
}

// 仅提供独立 Vue 构建；缺少产物时明确报错，避免静默回退到旧前端。
func frontendDir() (frontendSite, error) {
	built := env("BY_VUE_DIR", "../前端代码/BY1.2.6.35/dist-independent/byzt")
	site := frontendSite{assets: built, index: filepath.Join(filepath.Dir(built), "index.html")}
	for _, file := range []string{site.index, filepath.Join(site.assets, "config/init.json")} {
		info, err := os.Stat(file)
		if err != nil {
			return frontendSite{}, fmt.Errorf("请先在前端目录运行 pnpm build，并检查 BY_VUE_DIR：%w", err)
		}
		if info.IsDir() {
			return frontendSite{}, fmt.Errorf("前端文件不能是目录：%s", file)
		}
	}
	return site, nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
