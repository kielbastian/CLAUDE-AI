# Kreator Folderów — NC/TXT

Aplikacja Windows, na którą przeciągasz plik tekstowy (`.txt`, `.nc`), a ona
tworzy **na Pulpicie** folder o nazwie znajdującej się **w nawiasie w pierwszej
linijce** pliku i **kopiuje do niego ten plik**.

Przykład — plik zaczynający się od:

```
%
O02316 (TRZPIEN UA 227113)
```

utworzy na Pulpicie folder **`TRZPIEN UA 227113`** z kopią pliku w środku.

## Instalacja (Windows)

1. Pobierz plik **[`KreatorFolderow.exe`](KreatorFolderow.exe)**.
2. Skopiuj go na Pulpit — to cała instalacja (program niczego nie wymaga).
3. Przy pierwszym uruchomieniu Windows może pokazać ostrzeżenie SmartScreen
   („System Windows ochronił ten komputer”) — kliknij **„Więcej informacji”**,
   a następnie **„Uruchom mimo to”**. Ostrzeżenie pojawia się tylko raz.

## Użycie

- **Przeciągnij plik `.txt` / `.nc` na ikonę programu** — na Pulpicie powstanie
  folder, plik zostanie do niego skopiowany, a program pokaże wynik i otworzy
  utworzony folder. Można przeciągnąć kilka plików naraz.
- **Dwuklik na ikonę** — otwiera się okno, na które również można przeciągać
  pliki; poniżej widać dziennik wykonanych operacji.

## Wersja przeglądarkowa (Chrome / Edge)

Plik: [`UtworzFolder.html`](UtworzFolder.html) — otwórz w przeglądarce,
kliknij „Wybierz folder docelowy” (np. Pulpit), a potem przeciągaj pliki na
pole. Folder z kopią pliku powstanie w wybranym miejscu.

## Jak działa wyszukiwanie nazwy

- Program bierze **pierwszy tekst w nawiasie `( ... )`** od początku pliku
  (puste linie i linia `%` są pomijane).
- Znaki niedozwolone w nazwach folderów Windows (`\ / : * ? " < > |`)
  zamieniane są na `_`.
- Oryginalny plik zostaje na swoim miejscu — program **kopiuje**, niczego nie
  przenosi, nie nadpisuje i nie usuwa.
- Jeśli folder już istnieje, plik jest po prostu do niego dokopiowywany.

## Kompilacja ze źródeł

Wymagany [Go](https://go.dev). W katalogu projektu:

```
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H=windowsgui" -o KreatorFolderow.exe .
```

Ikona jest osadzona przez plik `rsrc_windows_amd64.syso`
(wygenerowany z `ikona.ico` narzędziem `github.com/akavel/rsrc`).
Testy logiki: `go test ./...`.
