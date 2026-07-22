# 🔐 Sejf Haseł – menedżer i generator haseł dla Chrome

Rozszerzenie do przeglądarki Chrome (Manifest V3), które:

- **proponuje silne hasło** automatycznie, gdy klikniesz pole „nowe hasło” przy rejestracji
  lub zmianie hasła (dymek z przyciskiem „Użyj hasła”),
- **zapisuje login i hasło dla danej strony** – po wysłaniu formularza logowania/rejestracji
  pyta: „Zapisać hasło dla tej strony?”,
- **automatycznie pyta, czy uzupełnić pola** – gdy wchodzisz na stronę logowania, dla której
  masz zapisane dane, pojawia się pytanie „Uzupełnić login i hasło?” z przyciskiem
  „Uzupełnij”,
- ma wbudowany **generator haseł** (długość 8–64, litery, cyfry, znaki specjalne),
- pozwala przeglądać, wyszukiwać, kopiować, dodawać ręcznie i usuwać zapisane wpisy,
- **synchronizuje sejf z Dyskiem Google** (zakładka „☁️ Dysk”) — zaszyfrowany plik
  trafia do folderu „Sejf Haseł” na Twoim Dysku, skąd czyta go też
  [aplikacja mobilna](../chrome-password-manager-mobile/) na Androida; konfiguracja
  krok po kroku: [`KONFIGURACJA-GOOGLE.md`](../KONFIGURACJA-GOOGLE.md).

## Bezpieczeństwo

- Wszystkie dane są szyfrowane **AES-256-GCM**; klucz jest wyprowadzany z Twojego
  **hasła głównego** algorytmem PBKDF2 (310 000 iteracji, SHA-256).
- Dane nigdy nie opuszczają Twojej przeglądarki – nie ma żadnego serwera ani synchronizacji.
- Sejf odblokowujesz raz na sesję przeglądarki; po zamknięciu przeglądarki (lub kliknięciu
  „Zablokuj”) klucz jest usuwany z pamięci.
- Hasła są wydawane stronie tylko wtedy, gdy jej adres zgadza się z adresem, dla którego
  zostały zapisane (ochrona przed phishingiem).
- **Uwaga:** jeśli zapomnisz hasła głównego, danych nie da się odzyskać – to celowe.

## Instalacja (tryb dewelopera)

1. Otwórz w Chrome adres: `chrome://extensions`
2. Włącz przełącznik **„Tryb dewelopera”** (prawy górny róg).
3. Kliknij **„Załaduj rozpakowane”**.
4. Wskaż folder `chrome-password-manager` (ten, w którym jest plik `manifest.json`).
5. Kliknij ikonę 🔐 na pasku narzędzi i **utwórz sejf**, ustawiając hasło główne
   (min. 8 znaków).

## Jak używać

| Sytuacja | Co się dzieje |
|---|---|
| Rejestrujesz się na stronie | Po kliknięciu pola hasła pojawia się dymek z propozycją silnego hasła – kliknij „Użyj hasła” |
| Wysyłasz formularz z loginem i hasłem | Pojawia się pytanie „Zapisać hasło dla tej strony?” |
| Wracasz na stronę logowania | Pojawia się pytanie „Uzupełnić login i hasło?” – kliknij „Uzupełnij” |
| Masz kilka kont na jednej stronie | Wybierasz konto z listy przed uzupełnieniem |
| Chcesz zobaczyć/zmienić zapisy | Kliknij ikonę rozszerzenia → zakładka „Hasła” |
| Potrzebujesz hasła „na już” | Kliknij ikonę rozszerzenia → zakładka „Generator” |

Jeśli sejf jest **zablokowany**, a strona wykryje dane do zapisania, zobaczysz komunikat,
aby otworzyć rozszerzenie i odblokować sejf – oczekujący zapis będzie czekał w popupie
(sekcja „Oczekujące zapisy”, do 3 minut).

## Struktura projektu

```
chrome-password-manager/
├── manifest.json          # konfiguracja rozszerzenia (MV3) + klient OAuth
├── background.js          # service worker: sejf, szyfrowanie, generator, synchronizacja
├── crypto.js              # PBKDF2 + AES-256-GCM (Web Crypto API)
├── drive.js               # Dysk Google: folder, plik sejfu, wysyłka/pobieranie
├── sync.js                # scalanie wpisów między urządzeniami (nowszy wygrywa)
├── content/content.js     # dymki i paski na stronach (shadow DOM)
├── popup/                 # interfejs rozszerzenia (HTML/CSS/JS)
└── icons/                 # ikony 16/48/128 px
```

## Synchronizacja z telefonem

1. Wykonaj jednorazową konfigurację z [`KONFIGURACJA-GOOGLE.md`](../KONFIGURACJA-GOOGLE.md)
   (identyfikatory OAuth + wpisanie client ID do `manifest.json`).
2. W popupie: zakładka **„☁️ Dysk”** → podaj hasło główne → **„Połącz z Dyskiem Google”**.
3. Od tej chwili każdy zapis/zmiana/usunięcie hasła jest automatycznie wysyłane na
   Dysk (i pobierane przy odblokowaniu); przycisk „Synchronizuj teraz” wymusza
   synchronizację ręcznie.
4. Na telefonie zainstaluj [aplikację mobilną](../chrome-password-manager-mobile/) —
   po zalogowaniu na to samo konto Google zobaczy ten sam sejf.
