// env2kubesecrets converts a environment variable file containing = separated pairs into a Kubernetes secrets config.
//
// Usage: go run tools/env2kubesecrets.go < dev.env.list > dev-secrets.yaml
//
package main

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"fmt"
	"html/template"
	"os"
)

func main() {
	secrets := map[string]string{}
	b64 := base64.StdEncoding
	n := 0
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		n++
		line := scanner.Bytes()
		parts := bytes.SplitN(line, []byte{'='}, 2)
		if len(parts) != 2 {
			fmt.Fprintf(os.Stderr, "error parsing line %d: %q\n", n, string(line))
			continue
		}
		secrets[string(parts[0])] = b64.EncodeToString(parts[1])
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintln(os.Stderr, "reading standard input:", err)
	}

	yamlTmpl := `apiVersion: v1
kind: Secret
metadata:
  name: secrets
type: Opaque
data:
  {{- range $k, $v := . }}
  {{ $k }}: {{ $v -}}
  {{ end }}
`

	tmpl := template.Must(template.New("output").Parse(yamlTmpl))
	tmpl.Execute(os.Stdout, secrets)
}
