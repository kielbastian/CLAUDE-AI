# CNC Suite — trzy aplikacje w jednym oknie

Jedna aplikacja desktopowa (Windows) z **kartami**, która łączy trzy istniejące
narzędzia w jednym oknie:

| Karta | Skrót | Plik | Pochodzenie |
|---|---|---|---|
| Menedżer programów CNC | `Ctrl+1` | `manager.html` | gałąź `claude/cnc-manager-exe-wjuac5` (CNC Manager) |
| Generator G-code / NC | `Ctrl+2` | `generator.html` | gałąź `claude/file-manager-ui-features-ur6z46` (CAM Generator) |
| Kalkulator CNC | `Ctrl+3` | `kalkulator.html` | `kalkulator-cnc/kalkulator_cnc.html` z gałęzi `main` |

`Ctrl+Tab` / `Ctrl+Shift+Tab` przechodzi do następnej / poprzedniej karty.
Skróty działają również wtedy, gdy kursor jest wewnątrz karty.

## Oryginały pozostają nietknięte

To **osobna aplikacja**. Nie modyfikuje ani nie zastępuje żadnej z trzech
oryginalnych aplikacji — te dalej działają samodzielnie, na swoich gałęziach,
z własnymi wydaniami (`windows-exe`, `cam-generator-exe`) i własnym plikiem
kalkulatora. CNC Suite buduje się do osobnego pliku `CNC-Suite.exe`
i publikuje w osobnym release o tagu `cnc-suite-exe`.

Pliki `manager.html`, `generator.html`, `kalkulator.html`, `detail.html`
i `widget.html` to **kopie** oryginałów. Jedyna zmiana wobec oryginałów to
jedna linijka w `manager.html` i `generator.html`:

```html
<script src="shell/embed.js"></script>
```

`shell/embed.js` robi cokolwiek **tylko wtedy**, gdy strona działa w ramce
powłoki: ukrywa własny pasek okna aplikacji (okno obsługuje powłoka) i
przekazuje skróty przełączania kart. Otwarta samodzielnie — w przeglądarce
albo w oryginalnym `.exe` — strona zachowuje się dokładnie jak dotąd.

## Jak to działa

```
index.html            powłoka: pasek okna + karty + trzy <iframe>
  ├─ manager.html     Menedżer programów CNC
  ├─ generator.html   Generator G-code / NC
  └─ kalkulator.html  Kalkulator CNC

main.js               proces główny Electron — połączone procesy główne
                      obu oryginalnych aplikacji
preload.js            window.native (menedżer) + window.cam (generator)
                      + window.suite (powłoka)
shell/embed.js        integracja osadzonej aplikacji z powłoką
detail.html           osobne okno podglądu programu (menedżer)
widget.html           pływający widget szybkiego wyszukiwania (menedżer)
vendor/, build/       czcionki, pdf.js, ikony
```

Wszystkie trzy karty ładują się przy starcie i **zachowują swój stan** przy
przełączaniu — przejście na inną kartę niczego nie resetuje.

Ponieważ aplikacje działają w ramkach, preload ładowany jest także w ramkach
(`nodeIntegrationInSubFrames`), a proces główny prowadzi rejestr ramek, żeby
wiadomości systemowe (potwierdzenie zamknięcia, widget wyszukiwania, okno
podglądu programu) trafiały do właściwej karty.

Zachowane funkcje systemowe obu aplikacji:

- pełna obsługa plików menedżera (skanowanie, zapis, kopiowanie, usuwanie,
  podgląd PDF, „pokaż w Eksploratorze", otwieranie szkicu),
- osobne okno podglądu programu,
- pływający widget szybkiego wyszukiwania wraz ze skrótem globalnym
  `Ctrl+Shift+Space` — zatwierdzenie wyszukiwania przełącza okno na kartę
  menedżera,
- ikona w zasobniku systemowym,
- natywne okno „Zapisz jako" dla programów `.nc` z generatora,
- menu kontekstowe (kopiuj / wklej) w polach edycji.

Motyw powłoki podąża za ustawieniem jasny/ciemny wybranym w menedżerze.

## Uruchomienie w trybie deweloperskim

```bash
cd cnc-suite
npm install
npm start
```

## Budowa pliku .exe (Windows)

```bash
cd cnc-suite
npm install
npm run dist            # przenośny  -> dist/CNC-Suite.exe
npm run dist:installer  # instalator -> dist/CNC-Suite-Setup.exe
```

## Budowa w CI

Workflow `.github/workflows/build-cnc-suite.yml` buduje `CNC-Suite.exe` na
runnerze `windows-latest` i publikuje go w release o tagu `cnc-suite-exe`.
Nie dotyka wydań pozostałych aplikacji.

## Uwagi

Kalkulator CNC pobiera swoje czcionki z Google Fonts — tak samo jak jego
oryginał. Bez internetu karta działa normalnie, tylko z czcionkami systemowymi.
Menedżer i generator mają czcionki w `vendor/` i nie wymagają sieci.

## Uwaga o przeglądarce

`index.html` otwarty prosto w przeglądarce pokaże karty, ale w pełni zadziałają
tylko **Generator NC** i **Kalkulator CNC**. Menedżer programów wymaga dostępu
do systemu plików, czyli uruchomienia w Electronie (`npm start` lub
`CNC-Suite.exe`).
