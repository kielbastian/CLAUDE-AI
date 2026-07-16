# CNC Manager

Aplikacja desktopowa (Windows) — **Generator G-code Haas ST-35Y / CAM Studio**.

Rdzeń aplikacji (`index.html`) działa też samodzielnie w przeglądarce, a Electron
opakowuje go w pojedynczy plik `CNC-Manager.exe`.

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
npm run dist            # portable -> dist/CNC-Manager.exe
npm run dist:installer  # instalator NSIS -> dist/CNC-Manager-Setup.exe
```

## Publikacja

Workflow GitHub Actions `.github/workflows/build-windows.yml` buduje
`CNC-Manager.exe` na runnerze `windows-latest` i wgrywa go do release
o tagu `windows-exe` (przy każdym pushu zmian lub ręcznie przez
„Run workflow").
