# Kontekst pracy — CNC Manager

Notatka dla nowej sesji/czatu: co to za projekt, gdzie co leży, jak to budować
i testować oraz co zostało zrobione. Czytaj to najpierw.

---

## 1. Repozytorium i gałęzie

| | |
|---|---|
| Repo | `kielbastian/CLAUDE-AI` |
| **Gałąź robocza** | `claude/cnc-manager-exe-wjuac5` ← tu commituj i pushuj |
| Gałąź źródłowa (baza) | `claude/cnc-file-manager-qa8krs` (commit `189dd86`) |

**Uwaga:** gałąź `main` zawiera zupełnie inny projekt (menedżer haseł Chrome).
Kod CNC Managera żyje wyłącznie na gałęziach `claude/cnc-*`. Nie mieszać.

Push (bez `gh` CLI — nie ma go w środowisku):

```bash
git push -u origin claude/cnc-manager-exe-wjuac5
```

Operacje GitHub (buildy, release'y) — przez narzędzia MCP `mcp__github__*`,
ładowane przez `ToolSearch` (np. `select:mcp__github__actions_list,mcp__github__get_release_by_tag`).

---

## 2. Czym jest aplikacja

Menedżer programów CNC dla tokarki **Haas ST-35Y** — aplikacja **Electron**
(portable `.exe` na Windows). Skanuje foldery z programami `.nc`/`.txt`,
kataloguje je, pozwala wyszukiwać, edytować, podpinać rysunki PDF i podglądać
zarys detalu z G-kodu.

### Pliki

| Plik | Rola |
|---|---|
| `main.js` (443 l.) | proces główny Electrona: okna, IPC, dostęp do dysku (`scan-programs`, `scan-pdfs`, zapis/kopiowanie plików) |
| `preload.js` (39 l.) | most `window.native.*` (contextBridge) — cała komunikacja renderer ↔ main |
| `index.html` (3241 l.) | okno główne: biblioteka, wyszukiwarka, foldery, formularze. Cały JS w jednym `<script>` |
| `detail.html` (1174 l.) | okno szczegółów programu **+ podgląd 2D (backplot)** |
| `widget.html` (115 l.) | widget szybkiego wyszukiwania |
| `vendor/` | czcionki (Orbitron/Rajdhani), `pdf.js` |
| `build/` | ikony (`icon.ico`, `icon.png`) |

### Budowanie `.exe`

Workflow `.github/workflows/build-windows.yml`:

- wyzwalacz: push na `main`, `master`, `claude/**`
- **filtr ścieżek**: `index.html`, `detail.html`, `widget.html`, `preload.js`,
  `main.js`, `package.json`, `vendor/**`, `build/**`, sam workflow
  → zmiany w `docs/**` **nie** uruchamiają builda
- `npx electron-builder --win portable` → `dist/CNC-Manager.exe`
- publikacja do release'a o tagu **`windows-exe`**, plik nadpisywany za każdym razem
- czas builda: ~2,5 min

Stały link do pobrania (nie zmienia się):
`https://github.com/kielbastian/CLAUDE-AI/releases/download/windows-exe/CNC-Manager.exe`

Weryfikacja gotowego builda: sprawdź `conclusion: success` w
`mcp__github__actions_list` (workflow `build-windows.yml`) **oraz** świeży
`updated_at`/`digest` assetu w `mcp__github__get_release_by_tag` (tag `windows-exe`).
Użytkownikowi podawaj rozmiar + SHA-256 jako dowód, że plik faktycznie się zmienił.

---

## 3. Podgląd 2D (backplot) — `detail.html`

Największa funkcja dodana w tej sesji. Przycisk **„Podgląd 2D"** (`#btnBackplot`)
w stopce okna szczegółów otwiera pełnoekranowy overlay rysujący zarys detalu
z toru narzędzia. **Tylko do odczytu — nie zapisuje ani nie modyfikuje plików NC.**

### Elementy DOM

`#bpOverlay`, `#bpCanvas`, `#bpTip` (dymek z wymiarem), `#bpInfo` (statystyki),
przyciski: `#bpFit`, `#bpMirror`, `#bpRapids`, `#bpHoles`, `#bpThreads`,
`#bpGrid`, `#bpClose`.

Stan: `opts = { mirror, rapids, grid, holes, threads }` — każdy ma przełącznik
w pasku (klasa `.on` = włączony).

### Model geometrii

`parse(code)` → `{ feeds, rapids, holes, threads, zmin, zmax, rmax, maxDia, length }`

Układ: płaszczyzna tokarska **G18**; `X` = **średnica** → promień `r = X/2`
(oś pionowa), `Z` = oś pozioma. `U`/`W` = przyrostowe X/Z.

| Kody | Traktowanie |
|---|---|
| G00 | dojazd (biała przerywana) |
| G01 | posuw (żółty `#ffd60a`) |
| G02/G03 | łuk → `arc()` (I/K albo R), rozbijany na odcinki |
| **G81–G89** | **wiercenie/gwintowanie sztywne** → otwór osiowy (`addHole`), pomarańczowy `#ffb454` |
| **G76** | gwint jednoblokowy → `addThread` (root = X, wysokość zęba = K, podziałka = F) |
| **G92 / G32 / G33 / G34** | gwint wieloprzejściowy → akumulacja przejść → jeden `addThread`, różowy `#ff77c8` |
| G70–G80, G04, G10 | cykle obróbki zgrubnej/dwell — **pomijane** (żeby zarys był czysty) |
| G53, G28, G30 | dojazd do zera maszyny — zeruje pozycję, nie rysuje |
| G17/G19 | inna płaszczyzna — ruchy pomijane (poza cyklami wierceń) |

**Średnica otworu** (`drillDia`) czytana z komentarza narzędzia:
`(---WIERTLO 10.2)` → Ø10.2; gwintownik `(---GWINTOWNIK M12)` → Ø12.
Brak liczby → średnica poprzedniego otworu.

**Domykanie gwintu** (`flushThread`) — kluczowa reguła, była źródłem błędu
„wachlarza": gwint kończy się **tylko** przy zmianie narzędzia (`T`), `G53`/`G28`,
zmianie płaszczyzny, ruchu skrawającym `G01/G02/G03` albo cyklu wiercenia.
Linie `S`/`M` (np. `M23`/`M24`), komentarze i dojazdy `G00` **nie** przerywają
gwintu — inaczej każde przejście stawało się osobnym gwintem i powstawał
wachlarz ukośnych linii.

Symbol gwintu = linia wierzchołków (major) + ząbki zygzakiem co pół podziałki —
zamiast rysowania każdego przejścia (to dawało „poprzeczne kreski" przy G32).

### Interakcja

- kółko myszy = zoom, przeciąganie = przesuwanie (kursor **łapki tylko przy
  wciśniętym LPM** — klasa `.drag`; normalnie kursor domyślny)
- `Dopasuj` / klawisz `F` lub `0` = dopasowanie widoku, `Esc` = zamknij
- **najechanie na tor** → `hitTest()` przyciąga do wierzchołka (priorytet),
  potem do rzutu na odcinek; dymek pokazuje **Ø / Z / R**, znacznik turkusowy
  + przerywana linia do osi
- odbicie lustrzane (`mirror`) rysuje drugą połowę zarysu półprzezroczyście

---

## 4. Okno główne — `index.html`, ważne mechanizmy

Zmienne globalne: `programs[]` (biblioteka), `folders[]` (`{key,path,name}`),
`activeFolderKey` (cel nowych programów/zapisu), `folderView` (`"all"` albo klucz
folderu — co widać w siatce), `folderSearch` (`false` = widok Programy,
`true` = widok Foldery; kafelki `#statProg` / `#statFolders`).

- `FILE_RE` (index.html) i `PROG_RE` (main.js): `\.(txt|nc|cnc|tap|eia|prg|ngc)$`
- `rescanFolderKey(key)` → `window.native.scanPrograms(path)` → `mergeScanFolder()`
  (dopisuje nowe, aktualizuje zmienione + historia wersji, usuwa skasowane, `render()`)
- `render()` = `renderGrid()` + `renderSidebar()`; `renderGrid()` przy
  `folderSearch` woła `renderFolderGrid()`
- programy dyskowe mają `id = "d:" + folderKey + ":" + dir + "/" + file`

### Naprawione w tej sesji

**Odświeżanie:** `rescanFolder()` skanował tylko folder *aktywny* — gdy oglądany
był inny folder, „Odśwież" pozornie nic nie robił. Teraz skanuje **wszystkie**
połączone foldery; handler `#btnRefresh` ma blokadę podwójnego kliknięcia
(`dataset.busy` + klasa `.busy`), a w `finally` zawsze czyści `thumbByCard`
i woła `render()`.

**Numer O:** `parseGcodeMeta` czytał tylko `\d{1,5}`, więc `O0123244` skracało
się do `O01232` i fałszywie kolidowało z istniejącym programem. Limit podniesiony
do `\d{1,8}` (również w `detail.html`), a `onumInt` czyta numer od początku wpisu
(`/^[Oo]?\s*(\d+)/`) zamiast pierwszych cyfr znalezionych gdziekolwiek.
Zera wiodące nadal bez znaczenia → `O2261` = `O02261` (prawdziwe duplikaty dalej
wykrywane).

---

## 5. Jak testować (bez Windows!)

Środowisko ma Chromium + globalny Playwright. **Nie instaluj przeglądarek.**

```bash
export NODE_PATH="$(npm root -g)"
# executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome
```

### Sprawdzenie składni

```bash
# wyciągnij największy blok <script> i sprawdź
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");
const re=/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;let m,b="";
while((m=re.exec(h))) if(m[1].length>b.length) b=m[1];
fs.writeFileSync("/tmp/s.js",b);'
node --check /tmp/s.js
```

### Test podglądu 2D (harness)

Wytnij z `detail.html` trzy bloki po znacznikach i sklej samodzielny HTML:

- CSS: od `/* ── generator / podgląd konturu 2D (backplot z G-kodu) ── */` do `</style>`
- HTML: od `<!-- ── generator / podgląd konturu 2D ── -->` do `<div id="toast">`
- JS: od `/* ─────────── Generator / podgląd konturu 2D (backplot z G-kodu)`
  do `/* skróty klawiszowe w trybie edycji`

W harnessie zdefiniuj `let prog = {name, onum, code}`, dodaj atrapę
`<button id="btnBackplot">`, wywołaj `window.__openBackplot()`. Do asercji
podmień `window.__openBackplot = openBp;` na wersję eksportującą też
`window.__model = () => model;` — wtedy w teście czytasz `threads`, `holes`,
`feeds`, `rapids`.

### Test okna głównego

`page.addInitScript()`: podstaw atrapę `window.native` (`scanPrograms` zwraca
udawaną zawartość dysku) i zasiej `localStorage`: `cncFolders`,
`cncActiveFolder`, `cncPrograms`. Potem klikaj `#btnRefresh`, `#statFolders`
i sprawdzaj `document.querySelectorAll("#grid .card").length` oraz `programs`.

### Programy testowe

W scratchpadzie sesji (znikają razem z kontenerem — w razie potrzeby odtworzyć):
`O02575.nc` (toczenie + gwint wewn. G92), `O02676.nc` (wiercenia G81, gwintownik
G84 M12, gwint G92), `g76test.nc`, `g32test.nc`, `gsplit.nc` (gwint z `M23`/`M24`
między przejściami — regresja „wachlarza").

Oczekiwane wyniki: każdy program → **dokładnie 1 gwint**; `O02676` → 3 otwory;
`O02575` → 1 otwór, 104 odcinki posuwu.

---

## 6. Historia zmian tej sesji (gałąź `claude/cnc-manager-exe-wjuac5`)

| Commit | Zmiana |
|---|---|
| `f85593f` | generator/podgląd konturu 2D (backplot) w oknie szczegółów |
| `7dca36a` | odczyt wymiaru po najechaniu na tor (Ø / Z / R) |
| `5793247` | kursor „łapki" tylko przy wciśniętym LPM |
| `83ca147` | wiercenia i gwintowanie sztywne (otwory osiowe, G81–G89) |
| `40f1ea2` | gwintowanie G76/G92/G32/G33/G34 jako symbol gwintu |
| `6df2056` | usunięcie „wachlarza" linii przy gwintowaniu |
| `3af1298` | naprawa odświeżania folderów + fałszywy duplikat długiego numeru O |

---

## 7. Do zrobienia / otwarte

- **„Otwórz w zewnętrznym G-kod"** — użytkownik wspominał o opcji: wskazać raz
  zewnętrzny program (viewer G-kodu), aplikacja zapamiętuje wybór i otwiera w nim
  pliki `.nc`. **Nie zaimplementowane** — wbudowany podgląd 2D pokrył potrzebę,
  ale opcja pozostaje na życzenie.
- Zakres gwintu w Z bierze programowany start (może obejmować dojazd, np. `Z2.6`),
  więc symbol bywa odrobinę dłuższy niż fizyczny gwint. Do dopracowania, jeśli
  użytkownik zgłosi.
- Ostatni build (`3af1298`) nie był weryfikowany — użytkownik prosi o sprawdzenie
  hasłem „sprawdź build".

## 8. Zasady współpracy z użytkownikiem

- Rozmowa po **polsku**, konkretnie, bez lania wody.
- Użytkownik jest operatorem CNC — opisuj efekty w kategoriach obróbki
  (średnica, posuw, gwint, rowek), nie żargonem programistycznym.
- **Nie nadpisywać istniejącego programu** — pracować na kopii/gałęzi roboczej
  (to jego wyraźne życzenie z początku pracy).
- Po każdej zmianie: commit + push na gałąź roboczą; build startuje sam.
  Potwierdzenie gotowego `.exe` dopiero na prośbę („sprawdź build") —
  użytkownik nie chce automatycznych przypomnień.
- Zmiany weryfikować renderem w Chromium i pokazywać zrzut (`SendUserFile`),
  zamiast deklarować, że „działa".
