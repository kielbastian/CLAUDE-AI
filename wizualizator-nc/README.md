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
- `G53` — dojazdy do bazy maszyny są pomijane w rysunku,
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

- **Długość materiału.** Z samego programu nie da się wyliczyć, jak głęboko
  mocowania na siebie zachodzą — wpisz długość detalu ręcznie, jeśli auto
  nie trafiło.
- **Ustawienie A / B** przy operacji (widoczne na karcie „złożenie”).
  Domyślnie przyjmowane jest, że każde `(DRUGA STRONA)` to obrót detalu,
  więc mocowania idą na przemian A, B, A… Jeśli któreś mocowanie w
  rzeczywistości robisz od tej samej strony co poprzednie, przestaw je tutaj —
  zmiana obejmuje od razu wszystkie operacje tego mocowania.

Jest jeszcze przełącznik **„tylko obróbka z tego mocowania”**: pokazuje, co
robi samo to mocowanie, na surowym materiale — przydatne, gdy chcesz zobaczyć
wyłącznie jedną operację, bez tego, co było wcześniej.

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

Uproszczenia: zarys jest symetryczny ISO 60° (bez wybiegu, luzu wierzchołka
i fazy najazdu), gwint przyjmowany jest jako **prawozwojny jednokrotny**.
To rysunek poglądowy — do sprawdzenia „czy i gdzie jest gwint”, nie do pomiarów.

## Czego program **nie** robi (i dobrze o tym wiedzieć)

- **Przejścia zgrubne cykli `G71`/`G72`/`G73` nie są rozwijane** — rysowany jest
  kontur wykańczający zapisany między blokami `P…Q…`. Dla obrazu detalu to
  wystarcza, ale to nie jest pełna symulacja czasu obróbki.
- **Nie uwzględnia promienia płytki** (`G41`/`G42` są tylko sygnalizowane) —
  rysunek idzie dokładnie po torze z programu.
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

## Uwagi techniczne

Jeden plik, zero zależności: parser G-kodu, symulacja usuwania materiału na
siatce plastrów wzdłuż osi Z, widok 2D na `<canvas>`, widok 3D na WebGL
(własny renderer, bez bibliotek). Działa bez internetu — z sieci pobierane są
tylko fonty, a bez nich strona wygląda tak samo, tylko innym krojem pisma.
</content>
