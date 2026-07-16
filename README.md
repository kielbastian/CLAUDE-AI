# CAM Generator — Generator G-code

Aplikacja desktopowa (Windows) — **Generator G-code Haas ST-35Y / CAM Studio**.

> Uwaga: to osobna aplikacja od menedżera programów CNC (`CNC-Manager.exe`
> w release `windows-exe`). Ten projekt buduje plik `CAM-Generator.exe`
> i **nie nadpisuje** tamtego release.

Rdzeń aplikacji (`index.html`) działa też samodzielnie w przeglądarce, a Electron
opakowuje go w pojedynczy plik `CAM-Generator.exe`.

## Funkcje

- Toczenie zewnętrzne oraz wytaczanie wewnętrzne (cykle **G71 / G70**)
- Wygodne wymiarowanie tabelą współrzędnych (Ø X, Z, faza/promień na narożu)
- Fazy i promienie dodawane kliknięciem na styk linii
- Szkicownik profilu 2D z podglądem, symulacją obróbki i podglądem ścieżki
- Generowanie G-code krok po kroku (podświetlanie linii + pozycja narzędzia)
- Format zgodny z Haas (kropki dziesiętne, zakończenie `G53`)

## Uruchomienie w trybie deweloperskim

```bash
npm install
npm start
```

## Budowa pliku .exe (Windows)

```bash
npm install
npm run dist            # portable -> dist/CAM-Generator.exe
npm run dist:installer  # instalator NSIS -> dist/CAM-Generator-Setup.exe
```

## Build w CI

Workflow `.github/workflows/build-windows.yml` buduje `CAM-Generator.exe`
na runnerze `windows-latest` i publikuje go w **osobnym** release o tagu
`cam-generator-exe`. Nie dotyka release `windows-exe`, który należy do
osobnej aplikacji (menedżer programów CNC — `CNC-Manager.exe`).
