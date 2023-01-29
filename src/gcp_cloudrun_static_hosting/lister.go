package main

import (
	"bytes"
	"os"
	"path"
	"path/filepath"
	"strings"
)
const l = "\n"

func main() {
	err := listAllFiles()
	if err != nil {
		panic(err)
	}
}

func writeLocation(nginxConf *strings.Builder, file string, line string) {
	nginxConf.WriteString("     location /")
	nginxConf.WriteString(file)
	nginxConf.WriteString(" {")
	nginxConf.WriteString(l)
	nginxConf.WriteString("          ")
	nginxConf.WriteString(line)
	nginxConf.WriteString(l)
	nginxConf.WriteString("     }")
	nginxConf.WriteString(l)
}

func listAllFiles() error {
	var files []string
	err := filepath.WalkDir(".", func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return err
	}
	filesMap := make(map[string]struct{})
	for _, file := range files {
		filesMap[file] = struct{}{}
	}

	nginxConf := strings.Builder{}
	for i, file := range files {
		if file == "lister.go" {
			continue
		}
		if i != 0 {
			nginxConf.WriteString("     ")
		}
		if strings.HasSuffix(file, ".html") {
			nginxConf.WriteString("location /")
			nginxConf.WriteString(file)
			nginxConf.WriteString(" {}")
			nginxConf.WriteString(l)

			if strings.HasSuffix(file, "index.html") {
				indexNameNoExt := strings.TrimSuffix(file, ".html")
				// /docs/index.html -> /docs/index
				writeLocation(&nginxConf, indexNameNoExt, "try_files ^ /"+file+" =404;")
				// /docs/index/ -> /docs/index
				writeLocation(&nginxConf, indexNameNoExt+"/", "return 301 /"+indexNameNoExt+";")

				parent := path.Dir(file)
				_, ok1 := filesMap[parent]
				_, ok2 := filesMap[parent+".html"]
				if parent != "." && !ok1 && !ok2 {
					// /docs -> /docs/index.html
					writeLocation(&nginxConf, parent, "try_files ^ /"+file+" =404;")
					// /docs/ -> /docs
					writeLocation(&nginxConf, parent+"/", "return 301 /"+parent+";")
				}
			} else {
				anyNoExt := strings.TrimSuffix(file, ".html")
				// /docs/any -> /docs/any.html
				writeLocation(&nginxConf, anyNoExt, "try_files ^ /"+file+" =404;")
				// /docs/any/ -> /docs/any
				writeLocation(&nginxConf, anyNoExt+"/", "return 301 /"+anyNoExt+";")
			}
		} else {
			nginxConf.WriteString("location /")
			nginxConf.WriteString(file)
			nginxConf.WriteString(" {}")
			nginxConf.WriteString(l)
		}
	}

	dockerfileContent, err := os.ReadFile("nginx.conf")
	if err != nil {
		return err
	}

	dockerfileContent = bytes.ReplaceAll(dockerfileContent, []byte("{{LOCATIONS}}"), []byte(nginxConf.String()))
	return os.WriteFile("nginx.conf", dockerfileContent, 0644)
}