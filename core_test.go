package main

import (
	"os"
	"testing"
)

func TestExtractFromExample(t *testing.T) {
	data := []byte("\n%\nO02316 (TRZPIEN UA 227113) \n(28.09.2023 19:10:04) \nG00 G53 X0 Y0\n")
	got := string(ExtractRawName(data))
	if got != "TRZPIEN UA 227113" {
		t.Fatalf("got %q", got)
	}
}

func TestExtractFromUploadedFile(t *testing.T) {
	path := "/root/.claude/uploads/8d902332-63e6-5004-a316-c7c624e90c97/1e4c236c-O02316.nc"
	data, err := os.ReadFile(path)
	if err != nil {
		t.Skip("brak pliku przykładowego")
	}
	got := SanitizeName(string(ExtractRawName(data)))
	if got != "TRZPIEN UA 227113" {
		t.Fatalf("got %q", got)
	}
}

func TestEdgeCases(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"pusty nawias pomijany", "()\nO1 (NAZWA X)\n", "NAZWA X"},
		{"brak nawiasu", "%\nG00 X0\n", ""},
		{"niedozwolone znaki", `O3 (AB/CD:EF*GH)`, "AB_CD_EF_GH"},
		{"koncowe kropki i spacje", "O4 ( NAZWA. )\n", "NAZWA"},
	}
	for _, c := range cases {
		raw := ExtractRawName([]byte(c.in))
		got := ""
		if raw != nil {
			got = SanitizeName(string(raw))
		}
		if got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}
