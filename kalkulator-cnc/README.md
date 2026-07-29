# Kalkulator CNC

Projekt Marka Kulczyckiego. Kalkulator działa w całości w przeglądarce —
jeden plik HTML, bez instalacji, bez internetu (offline).

## Co jest w tym folderze

| Ścieżka | Co to jest |
|---|---|
| `kalkulator_cnc.html` | Wersja podstawowa — jeden plik, otwierasz dwuklikiem w przeglądarce |
| `windows/` | Paczka na Windows: instalator tworzący skrót na pulpicie i w menu Start |
| `android/` | Paczka PWA na Androida: własna ikona, własne okno, działa offline |

Instrukcje krok po kroku są w plikach `windows/CZYTAJ-Windows.txt`
oraz `android/CZYTAJ-Android.txt`.

## Szybki start

**Windows** — pobierz folder `windows/`, kliknij dwukrotnie
`Zainstaluj-KalkulatorCNC.bat`.

**Android** — patrz `android/CZYTAJ-Android.txt`. Najszybciej: wyślij sobie
`android/index.html` na telefon i otwórz w Chrome.

**Cokolwiek innego** — otwórz `kalkulator_cnc.html` w dowolnej przeglądarce.

## Uwaga: wersje różnią się logiką gwintu

Trzy pliki HTML w tej paczce **nie są identyczne**. Wersja w `windows/`
jest nowsza — liczy inaczej wysokość gwintu wewnętrznego 60°:

- `windows/kalkulator_cnc.html` — rozróżnia gwint **zewnętrzny** (0,6134·P)
  i **wewnętrzny** (0,5413·P, czyli H1 = 5/8 H)
- `kalkulator_cnc.html` i `android/index.html` — używają 0,6134·P
  w obu przypadkach

Jeśli poprawka z wersji Windows jest tą właściwą, trzeba ją przenieść
do pozostałych dwóch plików.

## Aplikacja PWA przez GitHub Pages

Repozytorium jest publiczne, więc `android/` można wystawić przez
GitHub Pages i zainstalować jako prawdziwą aplikację (SPOSÓB 2
w `CZYTAJ-Android.txt`). Trzeba to włączyć ręcznie:
Settings → Pages → Branch: `main` → Save.
