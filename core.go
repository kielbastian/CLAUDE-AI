package main

import (
	"bufio"
	"bytes"
	"regexp"
	"strings"
)

var parenRe = regexp.MustCompile(`\(([^)]+)\)`)

// ExtractRawName zwraca zawartość pierwszego niepustego nawiasu
// znalezionego w pliku, np. "O02316 (TRZPIEN UA 227113)" -> "TRZPIEN UA 227113".
func ExtractRawName(data []byte) []byte {
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		if m := parenRe.FindSubmatch(sc.Bytes()); m != nil {
			if c := bytes.TrimSpace(m[1]); len(c) > 0 {
				return c
			}
		}
	}
	return nil
}

// SanitizeName zamienia znaki niedozwolone w nazwach folderów Windows
// na "_" i usuwa końcowe kropki oraz spacje.
func SanitizeName(s string) string {
	s = strings.Map(func(r rune) rune {
		if strings.ContainsRune(`\/:*?"<>|`, r) || r < 0x20 {
			return '_'
		}
		return r
	}, s)
	return strings.TrimSpace(strings.TrimRight(s, ". "))
}
