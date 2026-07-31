# CNC Suite z poprawkami

Kopia **CNC Suite** rozbudowana o narzędzia dla programisty i operatora tokarki
Haas. Wersja podstawowa bez tych dodatków żyje dalej w katalogu `cnc-suite/`
i w release `cnc-suite-exe` — ta kopia buduje się do osobnego pliku
`CNC-Suite-z-poprawkami.exe` i release `cnc-suite-poprawki-exe`.

## Co doszło ponad wersję podstawową

### Kontrola programu przed wysłaniem na maszynę

Plakietka z liczbą uwag na karcie programu otwiera listę dla tego programu,
przycisk **„Sprawdź bibliotekę"** — zestawienie dla wszystkich, posortowane po
liczbie błędów. Obie listy można skopiować do schowka. Sprawdzane jest:

- **brak kropki dziesiętnej** przy wartości różnej od zera (`X50` zamiast
  `X50.`) — na Haasie taka liczba jest czytana w najmniejszym inkremencie
- **G96 bez wcześniejszego `G50 S…`** — brak ograniczenia obrotów; oraz G96 bez S
- **ruch roboczy** przed startem wrzeciona, bez zadanego posuwu F albo bez
  układu współrzędnych po zmianie narzędzia. Wrzeciono to zarówno główne
  (`M03`/`M04`), jak i **narzędzia napędzane** (`M133`/`M134`, obroty pod `P`) —
  w programach na oś C `M03` w ogóle nie występuje
- `M133`/`M134` **bez obrotów pod `P`** — narzędzie rusza z ostatnio zadaną prędkością
- narzędzie wywołane z **korektorem 00**
- niezamknięty nawias komentarza, brak `M30`/`M99`, brak `G20`/`G21`,
  niewyłączone chłodziwo, brak odjazdu `G53`/`G28`, brak znaków `%`

Ta sama uwaga powtórzona w wielu liniach (np. przez całe frezowanie spiralne)
jest pokazywana raz — z numerami pierwszych linii i licznikiem.

Celowo tylko pewne przypadki — przy kilkuset programach lista pełna wątpliwych
ostrzeżeń jest bezużyteczna. Sprawdzone na prawdziwych programach z warsztatu:
toczenie z gwintowaniem (O01037) i frezowanie z osią C oraz narzędziami
napędzanymi (O0020, FLANGE) przechodzą bez ani jednego błędu.

### Masowa edycja danych

Okno **„Masowa edycja danych"**: tabela z filtrem (bez numeru rysunku, bez
materiału, wszystkie), wyszukiwaniem i polami do wpisania numeru rysunku oraz
materiału. W wierszu widać pierwszy komentarz z kodu, więc detal da się
rozpoznać bez otwierania programu. **Enter** przechodzi do tego samego pola
w następnym wierszu — wpisywanie serią.

**„Zaproponuj numery"** wypełnia puste pola oznaczeniem SZ znalezionym w nazwie
folderu, pliku, nazwie detalu albo w nazwie przypisanego rysunku PDF.
Podpowiedzi są wyróżnione, więc widać, co zostało zgadnięte. Zmiany trafiają do
biblioteki — pliki `.nc` nie są modyfikowane.

### Karta ustawień do druku

Przycisk na karcie programu otwiera **kartę ustawień** — jedną stronę A4 na
maszynę: nazwa i numer O, numer rysunku, materiał, klient, plik, układ
współrzędnych, obroty i posuwy użyte w programie, wynik kontroli, tabela
narzędzi z korektorami i opisem z komentarzy, miniatura rysunku oraz miejsce na
uwagi o mocowaniu. Wydruk wychodzi na białym tle, bez ciemnego tła aplikacji.

### Dane skrawania w kalkulatorze

Ósma sekcja kalkulatora — **DANE SKRAWANIA**:

- **Vc ↔ obroty** sprzężone przez średnicę (zmiana jednego przelicza drugie)
  plus podpowiedź ogranicznika `G50 S…` do `G96`
- **chropowatość teoretyczna** `Ra = f² / (31,2 · r)`
- **posuw minutowy** `vf` i **czas przejścia** dla zadanej długości
- **moc skrawania** `Pc = ap · f · Vc · kc / 60000` z porównaniem do mocy
  wrzeciona — ostrzeżenie powyżej 70% i 90%
- **objętość wióra** `Q = ap · f · Vc`
- opór właściwy `kc` wybierany materiałem
- ostrzeżenia: posuw większy od promienia naroża, `ap` poniżej ⅓ promienia

---

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
i `widget.html` to **kopie** oryginałów. `widget.html` jest kopią bajt w bajt.
`manager.html` i `generator.html` mają dodaną jedną linijkę integracji
z powłoką:

```html
<script src="shell/embed.js"></script>
```

`shell/embed.js` robi cokolwiek **tylko wtedy**, gdy strona działa w ramce
powłoki: ukrywa własny pasek okna aplikacji (okno obsługuje powłoka) i
przekazuje skróty przełączania kart. Otwarta samodzielnie — w przeglądarce
albo w oryginalnym `.exe` — strona zachowuje się dokładnie jak dotąd.

Poza tym zmiany funkcjonalne, wszystkie tylko w tej aplikacji — oryginały na
swoich gałęziach pozostają nietknięte:

- `manager.html`, `detail.html` — obsługa rysunków PDF, opisana niżej.
- `kalkulator.html` — dodana sekcja **WIELOBOK**, opisana niżej.

## Rysunki PDF

- **Rysunek leżący obok programu jest wykrywany sam.** Przy każdym skanowaniu
  folderu menedżer zbiera pliki `.pdf` z folderów programów i przypisuje je do
  programów — miniaturka na karcie pojawia się bez żadnego klikania. Rysunek
  usunięty z dysku znika też z karty. Zasady przypisania:
  - **Jeden program w podfolderze** (klasyczny „folder na detal") — rysunki
    z tego folderu są jego, niezależnie od nazwy pliku.
  - **Kilka programów w jednym folderze** (np. wspólny `0516` z jarzmem,
    denkiem, dławnicami i tłokiem) — każdy rysunek trafia tylko do programu,
    do którego pasuje nazwą. Liczy się najmocniejszy trop: numer rysunku,
    numer O, nazwa pliku `.nc`, nazwa detalu. Porównywane są **całe człony**
    nazwy, nie fragmenty — `SZ-1124` to ten sam rysunek co `SZ1124`, ale
    `SZ1124B` i `SZ11245` to **inne** rysunki i nigdy nie zostaną podstawione
    pod `SZ1124`. Gdy plik ma własne oznaczenie SZ, a program inne, plik jest
    odrzucany od razu — bez oglądania się na resztę nazwy.
  - **Rysunek pasujący jednakowo do kilku programów** (np. `0516.pdf`
    w folderze `0516`, gdzie każdy program ma `0516` w nazwie) nie trafia do
    nikogo — inaczej wszystkie karty dostałyby ten sam, błędny rysunek.
    Wyjątek: trafienie po numerze rysunku, gdzie wspólny plik oznacza po prostu
    wspólny rysunek kilku sztuk.
  - **Programy luzem w korzeniu** folderu traktowane są jak folder z wieloma
    programami — wymagana jest zgodność nazwy.
  - **Rysunek przypisany ręcznie** (przycisk „Dopasuj PDF" na karcie,
    upuszczenie pliku na kartę) jest oznaczany i skan folderu go nie nadpisuje.
- **Przycisk „Dopasuj rysunki"** w panelu *Rysunki PDF*: dla każdego programu
  bez rysunku szuka w folderze rysunków pliku po numerze SZ i kopiuje go do
  folderu programu. Na koniec podsumowanie — ile skopiowano, dla ilu nie
  znaleziono, ile programów nie ma numeru rysunku.
- **Przycisk „Bez rysunku: N"** pojawia się pod spodem po dopasowaniu i otwiera
  listę programów, które zostały bez rysunku — w trzech grupach: *nie znaleziono
  rysunku*, *bez numeru rysunku* i *dopasowane*. Każdy wiersz pokazuje nazwę,
  numer O, folder i numer rysunku; kliknięcie otwiera program, przycisk obok
  pozwala wskazać rysunek ręcznie. „Kopiuj listę" wrzuca całą grupę do schowka
  (kolumny rozdzielone tabulatorem — wklei się do arkusza).
- **Przycisk „Rysunek"** w oknie podglądu programu otwiera przypisany rysunek
  na pełnym oknie (skala do szerokości, zoom +/−, „Pokaż plik"
  w Eksploratorze). Rysowany przez pdf.js na canvasie, więc podgląd nie zależy
  od wbudowanej wtyczki PDF.
- Przycisk **„Folder Szkice"** działa jak dotąd — otwiera w Eksploratorze
  folder szkicu wpisanego w polu obok.

### Wiele folderów z rysunkami

Przycisk **„Foldery PDF"** w nagłówku rozwija listę folderów z rysunkami —
tak samo jak „Połącz folder" dla programów. Można podłączyć ich dowolnie wiele
(np. bieżące szkice i archiwum), odłączyć pojedynczy krzyżykiem przy nazwie
albo wszystkie naraz krzyżykiem obok przycisku. Przy każdym folderze widać,
ile rysunków z niego pochodzi.

Wszystkie funkcje szukające rysunku — podpowiedzi w formularzu, „Dopasuj PDF"
na karcie, „Dopasuj rysunki", otwieranie oryginału — przeszukują **sumę
wszystkich** podłączonych folderów. „Folder Szkice" i „Otwórz folder rysunku"
w oknie podglądu najpierw ustalają, w którym folderze szkic w ogóle jest,
i dopiero wtedy otwierają Eksplorator — nie otwiera się kilka okien naraz.

Lista folderów zapisuje się między uruchomieniami (`cncPdfFolders`), a folder,
którego nie ma już na dysku, jest przy starcie pomijany. Ustawienie
z wcześniejszej wersji, gdzie folder rysunków był jeden, migruje automatycznie.

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

## Kalkulator CNC — sekcja WIELOBOK

Karta kalkulatora ma dodatkową, siódmą sekcję **WIELOBOK Ø** — liczy najmniejszą
średnicę przygotówki potrzebną, żeby wyjść z niej zadanym wielobokiem lub
prostokątem:

- kwadrat, sześciokąt, ośmiokąt — z wymiaru „S" (na płask): `Ø = S / cos(π/n)`
- prostokąt a×b — z przekątnej: `Ø = √(a² + b²)`

Do tego rysunek z wymiarowaniem (kontur na tle okręgu przygotówki) i promień.

Sekcja pochodzi z wersji kalkulatora z repozytorium `KalkulatorCNC-Android`
(gałąź `claude/android-tv-program-search-dauefn`, plik
`cncapp/src/main/assets/index.html`). Przeniesiona została **tylko ta sekcja** —
tamten plik jest w innych miejscach starszy niż nasz (uboższe tabele pasowań,
brak korekty odchyłek otworów K/M/N/P/R/S, brak sekcji POSUW), więc podmiana
całego pliku byłaby krokiem wstecz. Sekcja POSUW F/min zostaje bez zmian.

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
