# Wizualizator NC

Wrzucasz program NC (tokarski G-kod) — dostajesz obraz: ścieżkę narzędzia 2D
i bryłę 3D detalu. Wszystko w jednym pliku HTML, w przeglądarce, offline.
Program nigdzie nie jest wysyłany.

## Szybki start

Otwórz `wizualizator_nc.html` dwuklikiem w dowolnej przeglądarce, potem:

- **Wczytaj plik NC** albo po prostu przeciągnij plik `.NC` / `.TXT` na okno,
- **Wklej kod** — jak wolisz wkleić treść ze schowka,
- **Przykład** — wbudowany prosty program, żeby zobaczyć jak to działa.

## Co pokazuje

| Zakładka | Co widać |
|---|---|
| **Widok 2D** | Ścieżka narzędzia w płaszczyźnie Z–X (Z w poziomie, średnica w pionie), przekrój materiału po obróbce, kontur półfabrykatu, oś obrotu. Każde narzędzie w innym kolorze. |
| **Widok 3D** | Bryła detalu powstała z symulacji (obrót profilu) razem z gwintami. Obracasz myszką, kółko = zoom, przycisk **Przekrój** rozcina detal, żeby zobaczyć otwory, rowki i gwinty wewnętrzne. Powierzchnia cięcia jest pełna (na żółto) — nie widać przez nią środka detalu. |
| **Kod NC** | Treść programu z numeracją; kliknięcie w linię przeskakuje do tego ruchu, a odtwarzanie podświetla aktualną linię. |

Jeśli detal jest robiony na kilka mocowań, nad rysunkiem dochodzi drugi rząd
kart — osobny model dla każdego mocowania plus złożenie (patrz niżej).

Suwak na dole przewija program ruch po ruchu (`◀` `▶`, spacja = odtwarzanie,
strzałki = krok). Opcja *„rysuj tylko do bieżącego kroku”* pokazuje ścieżkę
narastająco. **Zapisz obraz PNG** zapisuje aktualny widok do pliku.

## Co jest rozumiane z programu

- ruchy `G00`, `G01`, łuki `G02`/`G03` (promień `R` oraz `I`/`K`),
- płaszczyzny `G17`/`G18`, `G90`/`G91`, `G20`/`G21` (cal/mm), `U`/`W` przyrostowo,
- `X` jako **średnica** (można przełączyć na promień),
- `G53`, `G28`, `G30` — zjazdy do bazy maszyny są pomijane w rysunku
  (i kończą cykl gwintowania, żeby `G28 U0` nie wpadło jako kolejne przejście),
- cykle wiercenia `G81`–`G89` + `G80`; średnica wiertła czytana z komentarza
  narzędzia (np. `T707 (--- WIERTLO FI45)`), również otwory na okręgu
  (oś C, `M19 R…`) — pokazywane jako otwory w bryle 3D,
- **gwintowanie**: cykle `G92` / `G78` (kolejne bloki z samym `X` to kolejne
  przejścia), cykl `G76` (średnica końcowa z `X`, wysokość zarysu z `P` w µm)
  oraz `G32` / `G33` (przejścia zbierane w jeden gwint). Skok czytany z `F`
  (także modalnego). Gwint jest rysowany w 3D jako prawdziwa powierzchnia
  śrubowa,
- zmiany narzędzia `T…` z komentarzem → lista operacji z osobnymi kolorami,
- podział na **mocowania** po komentarzu typu `(DRUGA STRONA)` — patrz niżej.

## Detal robiony na kilka mocowań

Każdy komentarz `(DRUGA STRONA)` (albo `TRZECIA STRONA`, `STRONA 2`, `SIDE 2`…)
oznacza, że detal został wyjęty i obrócony. Program jest wtedy dzielony na
mocowania, a nad rysunkiem pojawia się dodatkowy rząd kart:

| Karta | Co pokazuje |
|---|---|
| **po 1. mocowaniu**, **po 2. mocowaniu**, … | Osobny model: detal w takim stanie, w jakim wychodzi z tego mocowania, ustawiony tak jak leżał w uchwycie (Z=0 przy czole, które jest z przodu). Obróbka z wcześniejszych mocowań jest uwzględniona — tak jak na maszynie. |
| **złożenie** | Gotowy detal — wszystkie mocowania razem. |

Dwie rzeczy do sprawdzenia przy kilku mocowaniach:

- **Długość materiału.** Z samego programu nie da się jej wyliczyć na pewno.
  Domyślnie wystarczy zasięg głębszego mocowania — tak jest, gdy detal ma
  otwór na wylot albo gdy jedno mocowanie robi tylko czoło. Jeśli natomiast
  **oba mocowania toczą z zewnątrz tak głęboko, że musiałyby wejść sobie
  w drogę**, aplikacja przyjmuje, że stykają się w środku detalu (długość =
  suma zasięgów) i pisze o tym w Uwagach. Bez tego np. tłoczysko gwintowane
  z dwóch stron wychodziło jako jeden cienki pręt. Jeśli detal ma inną
  długość — wpisz ją ręcznie.
- **Ustawienie A / B** przy operacji (widoczne na karcie „złożenie”).
  Domyślnie przyjmowane jest, że każde `(DRUGA STRONA)` to obrót detalu,
  więc mocowania idą na przemian A, B, A… Jeśli któreś mocowanie w
  rzeczywistości robisz od tej samej strony co poprzednie, przestaw je tutaj —
  zmiana obejmuje od razu wszystkie operacje tego mocowania.

Jest jeszcze przełącznik **„tylko obróbka z tego mocowania”**: pokazuje, co
robi samo to mocowanie, na surowym materiale — przydatne, gdy chcesz zobaczyć
wyłącznie jedną operację, bez tego, co było wcześniej.

**Materiał jest wspólny dla wszystkich kart** — to jeden pręt, z którego
powstaje detal, więc na każdej karcie widać go tak samo, tylko z coraz większą
ilością obróbki. Auto-dobór liczy się z całego programu, a wpisana ręcznie
średnica i długość obowiązuje na wszystkich kartach.

## Rowki i szerokość płytki

Program prowadzi **jeden narożnik płytki rowkowej**, a materiał schodzi na całej
jej szerokości — rowek jest więc szerszy od toru narzędzia o szerokość płytki.
Aplikacja to uwzględnia.

Szerokość jest czytana z komentarza narzędzia — z liczby zaraz za słowem
`ROWKOWANIE` / `KANAŁEK` / `PRZECINAK` / `GROOVING`:

```
N4 T505 (---ROWKOWANIE WEW. 4 FI32)   ->  płytka 4 mm
T1212 (--- ROWKOWANIE ZEW 3)          ->  płytka 3 mm
```

Przy każdej operacji rowkowania w liście po prawej widać, jaka szerokość
została użyta. Jeśli w komentarzu jej nie ma, wpisuje się ją ręcznie w panelu
**Płytki rowkowe** — osobno dla rowków zewnętrznych i wewnętrznych; wpisana
wartość jest używana tylko tam, gdzie komentarz nic nie mówi.

Domyślnie przyjmowane jest, że płytka leży **w stronę −Z** od zaprogramowanego
punktu (tak liczy większość CAM-ów i tak wychodzi z wcinków zgrubnych w
programach z tego warsztatu). Gdyby w Twoim postprocesorze było odwrotnie,
przestaw to jednym rozwijakiem na `+Z` albo `symetrycznie`.

Sprawdzenie na realnych programach — szerokość rowka wyliczona z konturu
wykańczającego zgadza się z rozstawem wcinków zgrubnych co do 0,2 mm:

| Rowek | tor narzędzia | z płytką | z wcinków zgrubnych |
|---|---|---|---|
| `ROWKOWANIE WEW. 4`, duży | 16,0 mm | **20,0 mm** | 20,0 mm |
| `ROWKOWANIE WEW. 4`, pierwszy | 0,9 mm | **4,9 mm** | 5,3 mm |
| `ROWKOWANIE ZEW 3` | 1,8 mm | **4,8 mm** | 5,5 mm |

## Gwinty

Program rozpoznaje gwint z cyklu i dorysowuje go w 3D — na zewnątrz i w otworze.
Panel **Uwagi** wypisuje, co zostało wykryte, np.
*„Gwint wewnętrzny: Ø48.15 × skok 3.00 mm, Z -60.3…-17.7”* — warto to sprawdzić,
zanim uznasz obrazek za dobry.

Jak to jest liczone:

- **średnica** — z ostatniego (najgłębszego) przejścia cyklu: przy gwincie
  wewnętrznym największe `X`, przy zewnętrznym najmniejsze,
- **wysokość zarysu** — z `P` przy `G76`, a jeśli go nie ma, z zasady ISO 60°:
  0,6134·P na zewnątrz i 0,5413·P wewnątrz (tak jak w kalkulatorze CNC),
- **zakres** — gwint jest rysowany tylko tam, gdzie faktycznie jest co naciąć;
  jeśli w połowie długości cyklu otwór jest szerszy od gwintu, w tym miejscu
  gwintu nie będzie (bo w rzeczywistości też go nie ma),
- **zewnętrzny czy wewnętrzny** — z kierunku kolejnych przejść i z komentarza
  narzędzia; można wymusić ręcznie przełącznikiem przy operacji.

**Skok jest odwzorowany co do setnej.** Gwint to prawdziwa powierzchnia
śrubowa, nie rząd pierścieni: odległość między wierzchołkami wzdłuż osi równa
się skokowi z programu, a jeden obrót to dokładnie jeden skok. Zmierzone na
gotowej siatce 3D:

| Gwint | skok z `F` | zmierzony odstęp wierzchołków | przesunięcie 0°/180° |
|---|---|---|---|
| M42×2 zewn. | 2 mm | 2,0000 mm (min 2,0000, max 2,0000) | 1,00 mm = ½ skoku |
| M48×3 wewn. | 3 mm | 3,0000 mm (min 3,0000, max 3,0001) | 1,50 mm = ½ skoku |
| M58×1,5 zewn. | 1,5 mm | 1,5000 mm (min 1,4999, max 1,5000) | 0,75 mm = ½ skoku |
| M85×2 zewn. | 2 mm | 2,0000 mm (min 1,9999, max 2,0000) | 1,00 mm = ½ skoku |

Uproszczenia dotyczą **kształtu zęba, nie podziałki**: zarys jest symetryczny
ISO 60° (płaski wierzchołek P/8, dno P/4), bez wybiegu i fazy najazdu, kąt
zarysu nie jest czytany z `A` przy `G76`. Gwint przyjmowany jest jako
**prawozwojny jednokrotny** — przy gwincie wielokrotnym rysowana podziałka
odpowiada zaprogramowanemu skokowi linii śrubowej (`F`), a nie podziałce zwoju.

## Czego program **nie** robi (i dobrze o tym wiedzieć)

- **Przejścia zgrubne cykli `G71`/`G72`/`G73` nie są rozwijane** — rysowany jest
  kontur wykańczający zapisany między blokami `P…Q…`. Dla obrazu detalu to
  wystarcza, ale to nie jest pełna symulacja czasu obróbki.
- **Nie uwzględnia promienia płytki tokarskiej** (`G41`/`G42` są tylko
  sygnalizowane) — kontur toczony idzie dokładnie po torze z programu.
  Uwzględniana jest natomiast **szerokość płytki rowkowej** (patrz niżej).
- Frezowanie osią C i podprogramy są pokazane orientacyjnie; gwint ma zarys
  umowny (patrz wyżej).
- Widok 3D to **symulacja poglądowa**, nie model CAD. Sprawdza się do
  „czy to wygląda jak ten detal, o który chodzi”, nie do pomiarów.

## Jeśli obraz nie wygląda jak detal

Panel po prawej ma wszystko, czego zwykle trzeba:

- **Ø i długość materiału** — domyślnie dobierane automatycznie z programu.
  Średnica brana jest z toczenia wzdłużnego, bo planowanie często zaczyna się
  w powietrzu i zawyżyłoby wynik.
  Przy detalach robionych na dwa mocowania automat często nie zgadnie długości
  — wpisz ją ręcznie, model przeliczy się od razu.
- **Lista operacji** — przy każdej możesz:
  - wyłączyć ją z widoku (checkbox),
  - zmienić **ustawienie A / B** (czyli czy detal był w tym mocowaniu
    obrócony) — działa na całe mocowanie,
  - wymusić **zewnętrzna / wewnętrzna**, jeśli automat źle zgadł, czy narzędzie
    zbiera materiał z zewnątrz, czy od środka. Automat najpierw patrzy na
    komentarz przy narzędziu (`ZEW`, `WEW`, `WYTACZAK`, `WIERTLO`), potem na
    geometrię — przy programach bez opisów warto to sprawdzić.
- **Odwróć kierunek łuków G02/G03** — jeśli łuki wychodzą „w drugą stronę”
  (różne konwencje przy imaku przednim/tylnym).
- **Płytki rowkowe** — szerokość płytki dla rowków zewnętrznych i wewnętrznych
  oraz to, w którą stronę płytka leży względem toru.

## Uwagi techniczne

Jeden plik, zero zależności: parser G-kodu, symulacja usuwania materiału na
siatce plastrów wzdłuż osi Z, widok 2D na `<canvas>`, widok 3D na WebGL
(własny renderer, bez bibliotek). Działa bez internetu — z sieci pobierane są
tylko fonty, a bez nich strona wygląda tak samo, tylko innym krojem pisma.
</content>
