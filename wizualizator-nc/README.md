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
| **Widok 3D** | Bryła detalu powstała z symulacji (obrót profilu). Obracasz myszką, kółko = zoom, przycisk **Przekrój** rozcina detal, żeby zobaczyć otwory i rowki wewnętrzne. |
| **Kod NC** | Treść programu z numeracją; kliknięcie w linię przeskakuje do tego ruchu, a odtwarzanie podświetla aktualną linię. |

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
- zmiany narzędzia `T…` z komentarzem → lista operacji z osobnymi kolorami,
- rozpoznanie drugiej strony po komentarzu typu `(DRUGA STRONA)` — obie strony
  składane są na jednym detalu 3D.

## Czego program **nie** robi (i dobrze o tym wiedzieć)

- **Przejścia zgrubne cykli `G71`/`G72`/`G73` nie są rozwijane** — rysowany jest
  kontur wykańczający zapisany między blokami `P…Q…`. Dla obrazu detalu to
  wystarcza, ale to nie jest pełna symulacja czasu obróbki.
- **Nie uwzględnia promienia płytki** (`G41`/`G42` są tylko sygnalizowane) —
  rysunek idzie dokładnie po torze z programu.
- Gwintowanie, frezowanie osią C i podprogramy są pokazane orientacyjnie.
- Widok 3D to **symulacja poglądowa**, nie model CAD. Sprawdza się do
  „czy to wygląda jak ten detal, o który chodzi”, nie do pomiarów.

## Jeśli obraz nie wygląda jak detal

Panel po prawej ma wszystko, czego zwykle trzeba:

- **Ø i długość materiału** — domyślnie dobierane automatycznie z programu.
  Przy detalach robionych na dwa mocowania automat często nie zgadnie długości
  — wpisz ją ręcznie, model przeliczy się od razu.
- **Lista operacji** — przy każdej możesz:
  - wyłączyć ją z widoku (checkbox),
  - zmienić **mocowanie A / B** (czyli z której strony detal był trzymany),
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
