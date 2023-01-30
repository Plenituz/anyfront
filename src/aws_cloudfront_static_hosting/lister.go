package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
)

//this is here cause the escaping mecanism of jsonnet doesnt work properly
const l = "\n"

func main() {
	err := listAllFiles()
	if err != nil {
		panic(err)
	}
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

	output := strings.Builder{}
	for i, file := range files {
		if file == "lister.go" || file == "origin_request.js" {
			continue
		}
		if i != 0 {
			output.WriteString("    ")
		}
		output.WriteString("\"")
		output.WriteString(file)
		output.WriteString("\": true")
		if i != len(files)-1 {
			output.WriteString(",")
			output.WriteString(l)
		}
	}

	template, err := os.ReadFile("origin_request.js")
	if err != nil {
		return err
	}

	template = bytes.ReplaceAll(template, []byte("{{LOCATIONS}}"), []byte(output.String()))
	return os.WriteFile("origin_request.js", template, 0644)
}