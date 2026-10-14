// picd — Kindle image hub daemon.
//
// A single static binary that serves a LAN web UI for browsing, uploading,
// downloading and deleting images in whitelisted folders under /mnt/us,
// plus the converter front-end. Zero runtime dependencies.
package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

//go:embed web
var webFS embed.FS

const version = "0.1.0"

type fileEntry struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	Mod  int64  `json:"mod"`
}

type configOut struct {
	Name    string   `json:"name"`
	Version string   `json:"version"`
	Dirs    []string `json:"dirs"`
}

var (
	flagAddr   = flag.String("addr", ":8642", "listen address")
	flagRoot   = flag.String("root", "/mnt/us", "base directory for image folders")
	flagToken  = flag.String("token", "", "optional access token required for /api/*")
	dirWhitelist = []string{"screensaver", "images"}
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func errJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func dirPath(key string) (string, error) {
	for _, d := range dirWhitelist {
		if key == d {
			return filepath.Join(*flagRoot, d), nil
		}
	}
	return "", fmt.Errorf("unknown dir %q", key)
}

// sanitizeName keeps uploads/deletes inside the whitelisted folder.
func sanitizeName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("empty name")
	}
	if name != filepath.Base(name) || strings.ContainsAny(name, `/\`) {
		return "", fmt.Errorf("invalid name")
	}
	if strings.HasPrefix(name, ".") {
		return "", fmt.Errorf("hidden files are not managed")
	}
	return name, nil
}

func ensureDirs() {
	for _, d := range dirWhitelist {
		_ = os.MkdirAll(filepath.Join(*flagRoot, d), 0o755)
	}
}

/* ------------------------------------------------------------- handlers */

func handleConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, configOut{
		Name:    "picd",
		Version: version,
		Dirs:    dirWhitelist,
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	dir, err := dirPath(r.URL.Query().Get("dir"))
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		errJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	files := []fileEntry{}
	for _, e := range entries {
		if e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, fileEntry{
			Name: e.Name(),
			Size: info.Size(),
			Mod:  info.ModTime().Unix(),
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Name < files[j].Name })
	writeJSON(w, http.StatusOK, map[string]any{
		"dir":   r.URL.Query().Get("dir"),
		"files": files,
	})
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	dir, err := dirPath(q.Get("dir"))
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	name, err := sanitizeName(q.Get("name"))
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	full := filepath.Join(dir, name)
	if _, err := os.Stat(full); err != nil {
		errJSON(w, http.StatusNotFound, "file not found")
		return
	}
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("inline; filename*=UTF-8''%s", urlEncode(name)))
	http.ServeFile(w, r, full)
}

func urlEncode(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-' {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	dirKey := r.URL.Query().Get("dir")
	if dirKey == "" {
		dirKey = "screensaver"
	}
	dir, err := dirPath(dirKey)
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		errJSON(w, http.StatusBadRequest, "multipart: "+err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		errJSON(w, http.StatusBadRequest, `missing "file" field`)
		return
	}
	defer file.Close()

	name, err := sanitizeName(filepath.Base(header.Filename))
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	dst, err := os.OpenFile(filepath.Join(dir, name),
		os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		errJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	n, err := io.Copy(dst, file)
	closeErr := dst.Close()
	if err != nil {
		errJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	if closeErr != nil {
		errJSON(w, http.StatusInternalServerError, closeErr.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name, "size": n})
}

func handleDelete(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	dir, err := dirPath(q.Get("dir"))
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	name, err := sanitizeName(q.Get("name"))
	if err != nil {
		errJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	full := filepath.Join(dir, name)
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		errJSON(w, http.StatusNotFound, "file not found")
		return
	}
	if err := os.Remove(full); err != nil {
		errJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name})
}

/* ----------------------------------------------------------- middleware */

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Picd-Token")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func withToken(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if *flagToken != "" && strings.HasPrefix(r.URL.Path, "/api/") {
			got := r.URL.Query().Get("token")
			if got == "" {
				got = r.Header.Get("X-Picd-Token")
			}
			if got != *flagToken {
				errJSON(w, http.StatusUnauthorized, "token required")
				return
			}
		}
		h.ServeHTTP(w, r)
	})
}

/* ----------------------------------------------------------------- main */

func localIPs() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}
	return ips
}

func main() {
	flag.Parse()
	ensureDirs()

	manage, err := fs.Sub(webFS, "web/manage")
	if err != nil {
		log.Fatal(err)
	}
	convert, err := fs.Sub(webFS, "web/convert")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/config", handleConfig)
	mux.HandleFunc("GET /api/images", handleList)
	mux.HandleFunc("GET /api/download", handleDownload)
	mux.HandleFunc("POST /api/upload", handleUpload)
	mux.HandleFunc("DELETE /api/images", handleDelete)

	mux.Handle("GET /convert/", http.StripPrefix("/convert/",
		http.FileServerFS(convert)))
	mux.Handle("GET /{$}", http.FileServerFS(manage))
	mux.Handle("GET /", http.FileServerFS(manage))

	srv := &http.Server{
		Addr:              *flagAddr,
		Handler:           withToken(withCORS(mux)),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("picd %s listening on %s (root=%s)", version, *flagAddr, *flagRoot)
	for _, ip := range localIPs() {
		log.Printf("  LAN: http://%s%s", ip, *flagAddr)
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
