# ☁️ Konfiguracja synchronizacji z Dyskiem Google (krok po kroku)

Aby rozszerzenie na komputerze i aplikacja na telefonie mogły zapisywać sejf
w folderze **„Sejf Haseł”** na Twoim Dysku Google, musisz jednorazowo utworzyć
darmowe „identyfikatory klienta OAuth” w Google Cloud. To zajmuje ok. 10 minut
i nie wymaga karty płatniczej.

> **Ważne:** oba identyfikatory utwórz w **tym samym projekcie** Google Cloud.
> Tylko wtedy rozszerzenie i aplikacja mobilna będą widziały ten sam plik sejfu
> (uprawnienie `drive.file` daje dostęp wyłącznie do plików utworzonych przez
> daną aplikację/projekt).

## Krok 1: Utwórz projekt

1. Wejdź na [console.cloud.google.com](https://console.cloud.google.com/) i zaloguj się
   na to samo konto Google, którego Dysku chcesz używać.
2. U góry kliknij listę projektów → **„Nowy projekt”**.
3. Nazwa: np. `Sejf Hasel` → **Utwórz** → przełącz się na ten projekt.

## Krok 2: Włącz Google Drive API

1. Menu ☰ → **„Interfejsy API i usługi”** → **„Biblioteka”**.
2. Wyszukaj **„Google Drive API”** → kliknij → **„Włącz”**.

## Krok 3: Ekran zgody OAuth

1. Menu ☰ → „Interfejsy API i usługi” → **„Ekran zgody OAuth”**.
2. Typ użytkownika: **Zewnętrzny** → Utwórz.
3. Nazwa aplikacji: `Sejf Haseł`, e-mail pomocy: Twój adres → Zapisz i kontynuuj.
4. Zakresy: nic nie dodawaj → Zapisz i kontynuuj.
5. **Użytkownicy testowi:** kliknij „Dodaj użytkowników” i dodaj **swój adres Gmail**
   → Zapisz. (Aplikacja w trybie testowym działa tylko dla dodanych tu kont — do
   prywatnego użytku to w zupełności wystarcza.)

## Krok 4: Identyfikator dla rozszerzenia Chrome (komputer)

1. Menu ☰ → „Interfejsy API i usługi” → **„Dane logowania”** →
   **„Utwórz dane logowania”** → **„Identyfikator klienta OAuth”**.
2. Typ aplikacji: **Rozszerzenie do Chrome**.
3. Nazwa: `Sejf Hasel – rozszerzenie`.
4. **Identyfikator elementu** (Item ID) wpisz dokładnie:

   ```
   kophlmcchgfamngackfbmokcpeoponmc
   ```

   (To stały identyfikator tego rozszerzenia — jest zapisany w `manifest.json`
   w polu `key`, więc będzie taki sam na każdym komputerze.)
5. Kliknij **Utwórz** i skopiuj **Identyfikator klienta** (kończy się na
   `.apps.googleusercontent.com`).
6. Otwórz plik `chrome-password-manager/manifest.json` i w sekcji `oauth2` podmień
   `WPISZ_TUTAJ_SWOJ_CLIENT_ID.apps.googleusercontent.com` na skopiowany identyfikator.
7. Odśwież rozszerzenie na `chrome://extensions` (ikona ↻).

## Krok 5: Identyfikator dla aplikacji na telefon

1. Ponownie: **„Utwórz dane logowania”** → **„Identyfikator klienta OAuth”**.
2. Typ aplikacji: **Aplikacja internetowa**.
3. Nazwa: `Sejf Hasel – telefon`.
4. **Autoryzowane źródła JavaScript** — dodaj adres, pod którym opublikujesz
   aplikację mobilną (patrz krok 6), np.:

   ```
   https://TWOJA-NAZWA.github.io
   ```

5. Kliknij **Utwórz** i skopiuj **Identyfikator klienta**.
6. Ten identyfikator wpiszesz w aplikacji na telefonie przy pierwszym uruchomieniu
   (aplikacja o niego zapyta — nie trzeba edytować żadnych plików).

## Krok 6: Opublikuj aplikację mobilną (GitHub Pages, za darmo)

Aplikacja na telefon to strona internetowa (PWA) — musi być dostępna pod adresem
`https://`. Najprościej użyć GitHub Pages tego repozytorium:

1. Na GitHubie otwórz repozytorium → **Settings** → **Pages**.
2. „Source”: **Deploy from a branch** → gałąź `main`, folder `/ (root)` → Save.
3. Po chwili aplikacja będzie dostępna pod adresem:

   ```
   https://TWOJA-NAZWA.github.io/NAZWA-REPOZYTORIUM/chrome-password-manager-mobile/
   ```

4. **Uwaga:** repozytorium musi być publiczne (albo mieć plan GitHub Pro dla
   prywatnych Pages). W repozytorium nie ma żadnych haseł — sejf leży wyłącznie
   na Twoim Dysku Google, zaszyfrowany.
5. Dokładnie ten adres źródła (`https://TWOJA-NAZWA.github.io`) musi być dodany
   w kroku 5.4.

## Krok 7: Instalacja na telefonie

1. Otwórz powyższy adres w **Chrome na Androidzie**.
2. Menu ⋮ → **„Dodaj do ekranu głównego”** / „Zainstaluj aplikację”.
3. Uruchom „Sejf Haseł” z ekranu głównego, wklej identyfikator klienta z kroku 5,
   zaloguj się przez Google i podaj **to samo hasło główne**, którego używasz
   w rozszerzeniu na komputerze.

## Jak to potem działa

1. Na komputerze: popup rozszerzenia → zakładka **„☁️ Dysk”** → podaj hasło główne →
   **„Połącz z Dyskiem Google”**. Rozszerzenie utworzy folder „Sejf Haseł” i wgra
   tam zaszyfrowany plik `sejf-hasel.vault.json`.
2. Każde zapisane/zmienione/usunięte hasło jest automatycznie synchronizowane
   (a także przy odblokowaniu sejfu i ręcznie przyciskiem „Synchronizuj teraz”).
3. Na telefonie aplikacja pobiera ten sam plik przy starcie, co 60 sekund oraz po
   powrocie do aplikacji; zmiany z telefonu również wracają na Dysk.
4. Konflikty rozwiązywane są zasadą „nowszy wygrywa”, a usunięcia przenoszą się
   między urządzeniami.

## Bezpieczeństwo

- Na Dysku Google leży **wyłącznie zaszyfrowany plik** (AES-256-GCM). Google ani
  nikt, kto zajrzy do pliku, nie odczyta haseł bez Twojego hasła głównego.
- Hasło główne nigdy nie jest nigdzie wysyłane — odszyfrowanie odbywa się tylko
  na Twoich urządzeniach.
- Używaj **tego samego hasła głównego** na komputerze i telefonie.
