# Menedżer programów CNC — wymagania

Aplikacja do zarządzania programami tokarskimi (Haas ST-35Y) pisanymi jako pliki
`.txt`, przechowywanymi w strukturze: folder główny `CNC Programy` → podfolder o
nazwie programu → plik `.txt` (+ pliki towarzyszące).

## Problem do rozwiązania

Programista CNC pisze program, zapisuje go jako `.txt`, ręcznie tworzy folder o
tej samej nazwie i wrzuca go do folderu głównego. Po kilkuset programach:

- trudno odnaleźć program sprzed miesięcy (pamięta się detal albo klienta, nie nazwę pliku),
- pliki `program_v2_poprawiony_FINAL.txt` — brak kontroli wersji,
- numery O-programów się dublują,
- rysunki, listy narzędzi i notatki są porozrzucane albo ich nie ma,
- kopiowanie na pendrive'a do maszyny to ręczna robota podatna na pomyłki.

## 1. Biblioteka programów (rdzeń aplikacji)

- Jeden widok listy wszystkich programów z kolumnami: nazwa, numer O, nazwa
  detalu, numer rysunku, klient, materiał, data utworzenia/modyfikacji.
- **Import istniejącej struktury** — aplikacja skanuje obecny folder
  `CNC Programy` i buduje bibliotekę z tego, co już jest, bez przenoszenia
  plików ręcznie. To warunek wejścia: nikt nie będzie przepisywał setek programów.
- Każdy program to „karta" z metadanymi + folder z plikami. Aplikacja zarządza
  strukturą folderów sama — użytkownik nie tworzy już folderów ręcznie.

## 2. Zapis nowego programu

- Przycisk „Nowy program": wklejasz kod (albo wskazujesz plik `.txt`) →
  aplikacja sama tworzy podfolder o właściwej nazwie we właściwym miejscu
  i zapisuje plik. Zero ręcznego klikania po folderach.
- Wymuszona, spójna konwencja nazewnictwa, np.
  `NR-RYSUNKU_NAZWA-DETALU_REW` — konfigurowalna raz, potem pilnowana przez program.
- Przy zapisie formularz metadanych: detal, klient, materiał, uchwyt/mocowanie,
  tagi (np. `wałek`, `gwint`, `nierdzewka`), notatka.
- Do karty programu można dorzucić **pliki towarzyszące**: rysunek PDF/DXF,
  zdjęcia zamocowania, listę narzędzi, kartę pomiarową — wszystko ląduje w tym
  samym folderze programu.

## 3. Wyszukiwanie — najważniejsza funkcja

- Jedno pole wyszukiwania, wyniki od razu podczas pisania.
- Szukanie po: nazwie, numerze O, numerze rysunku, kliencie, materiale, tagach.
- **Wyszukiwanie pełnotekstowe w treści G-kodu** — w tym w komentarzach
  w nawiasach `(PRZECINAK 3MM)`, bo to tam siedzi wiedza o programie.
- Filtry: „programy z gwintem G76", „programy używające narzędzia T101",
  „wszystko dla klienta X", zakres dat.
- Ostatnio otwierane + ulubione/przypięte.

## 4. Wersjonowanie

- Każdy zapis tworzy nową wersję automatycznie — koniec z `_v2_final`.
- Historia wersji z datą i notatką („zmieniony posuw wykańczaka z F0.15 na F0.2").
- **Porównanie dwóch wersji linia po linii** (diff) — widać dokładnie co się
  zmieniło, zanim program pójdzie na maszynę.
- Przywrócenie dowolnej starszej wersji jednym kliknięciem.
- Nic nie jest kasowane bezpowrotnie — kosz z możliwością odzyskania.

## 5. Edytor G-kodu

- Podświetlanie składni Haas (G/M-kody, adresy X/Z/C/Y, komentarze, numery N).
- Numeracja linii, przenumerowanie bloków N.
- Podstawowa walidacja przed zapisem: brak `%`, niedomknięty nawias komentarza,
  zdublowany numer O, brak `M30`.
- Szablony/wstawki: nagłówek programu, cykl gwintowania G76, wiercenie,
  cykle z osią Y i narzędziami napędzanymi — rzeczy pisane w kółko.

## 6. Rejestr numerów O

- Lista zajętych numerów `O#####` w całej bibliotece.
- Ostrzeżenie przy próbie zapisu programu z numerem, który już istnieje.
- Podpowiedź pierwszego wolnego numeru z wybranego zakresu.

## 7. Karta ustawcza i lista narzędzi

- Automatyczne wyciągnięcie z kodu listy narzędzi (`T101`, `T202`…) wraz
  z komentarzami przy nich oraz użytych baz (`G54`…).
- Generowanie karty ustawczej do wydruku: narzędzia, mocowanie, materiał,
  notatki — kartka, którą operator kładzie przy maszynie.

## 8. Eksport na maszynę

- „Wyślij na USB": aplikacja kopiuje program na pendrive'a w formacie, który
  Haas przyjmie bez marudzenia (nazwa `O#####.nc`, `%` na początku i końcu,
  poprawne kodowanie/końce linii).
- Opcjonalnie wysyłka po sieci na sterowanie Haas NGC (udział sieciowy),
  a dla starszych maszyn DNC po RS-232.
- Log wysyłek: kiedy i która wersja poszła na maszynę.

## 9. Kopia zapasowa

- Automatyczny backup całej biblioteki (ZIP na drugi dysk / dysk sieciowy /
  chmurę) według harmonogramu — programy to często lata pracy jednej osoby.

## 10. Wymagania ogólne

- Działa **offline**, szybko, bez logowania — komputer warsztatowy bywa stary
  i bez internetu.
- Windows, najlepiej wersja portable (uruchamialna z pendrive'a).
- Duże, czytelne fonty i przyciski — obsługa przy maszynie, czasem w rękawicach.
- Przeciągnij-i-upuść dla plików.
- Pliki pozostają zwykłymi `.txt` w zwykłych folderach — aplikacja jest
  nakładką, nie więzieniem: gdy zniknie, struktura folderów dalej działa.

## Priorytety (MVP → dalej)

1. **MVP:** biblioteka + import istniejących folderów + zapis z automatycznym
   tworzeniem folderu + wyszukiwarka (z pełnym tekstem) + wersjonowanie.
2. **Etap 2:** edytor z podświetlaniem i walidacją, rejestr numerów O,
   eksport na USB.
3. **Etap 3:** karty ustawcze, wysyłka po sieci, backup automatyczny,
   podgląd ścieżki narzędzia (backplot 2D dla tokarki).
