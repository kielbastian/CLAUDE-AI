# Utwórz folder z pliku NC / TXT

Aplikacja, na którą przeciągasz plik tekstowy (`.txt`, `.nc`), a ona tworzy
folder o nazwie znajdującej się **w nawiasie w pierwszej linijce** pliku.

Przykład — plik zaczynający się od:

```
%
O02316 (TRZPIEN UA 227113)
```

utworzy folder **`TRZPIEN UA 227113`** (obok pliku).

## Sposób 1 — Windows: przeciągnij plik na ikonę (zalecany)

Pliki: [`UtworzFolder.bat`](UtworzFolder.bat) + [`UtworzFolder.ps1`](UtworzFolder.ps1)

1. Pobierz **oba** pliki i umieść je w tym samym miejscu (np. na Pulpicie).
2. Przeciągnij plik `.txt` / `.nc` na ikonę **`UtworzFolder.bat`**.
3. Folder zostanie utworzony **w tym samym miejscu, w którym jest plik**.

Można przeciągnąć **kilka plików naraz** — powstanie folder dla każdego z nich.

Wskazówka: skrót do `UtworzFolder.bat` można przypiąć na Pulpicie i przeciągać
pliki na skrót.

## Sposób 2 — przeglądarka (Chrome / Edge)

Plik: [`UtworzFolder.html`](UtworzFolder.html)

1. Pobierz plik i otwórz go dwuklikiem (otworzy się w przeglądarce).
2. Kliknij **„Wybierz folder docelowy”** i wskaż, gdzie mają powstawać foldery.
3. Przeciągnij plik `.txt` / `.nc` na pole — folder zostanie utworzony
   w wybranym miejscu.

## Jak działa wyszukiwanie nazwy

- Program szuka **pierwszego tekstu w nawiasie `( ... )`** od początku pliku
  (puste linie i linia `%` są pomijane).
- Znaki niedozwolone w nazwach folderów Windows (`\ / : * ? " < > |`)
  są zamieniane na `_`.
- Jeżeli folder już istnieje, program tylko o tym informuje — niczego nie
  nadpisuje ani nie usuwa.
- Jeżeli w pliku nie ma żadnego nawiasu z tekstem, program zgłasza błąd
  i nie tworzy folderu.
