# 📱 Sejf Haseł – aplikacja na Androida (PWA)

Mobilna wersja menedżera haseł, powiązana z rozszerzeniem
[`chrome-password-manager`](../chrome-password-manager/) przez **Dysk Google**:
hasło zapisane na komputerze pojawia się na telefonie i odwrotnie.

> **Dlaczego PWA, a nie rozszerzenie?** Chrome na Androidzie **nie obsługuje
> rozszerzeń** — to ograniczenie samej przeglądarki. Dlatego wersja mobilna jest
> aplikacją webową (PWA), którą instalujesz z Chrome na ekran główny telefonu.
> Wygląda i działa jak zwykła aplikacja, także offline.

## Co potrafi

- 🔄 **Synchronizacja z komputerem** — czyta i zapisuje ten sam zaszyfrowany plik
  `sejf-hasel.vault.json` w folderze „Sejf Haseł” na Twoim Dysku Google;
  synchronizuje się przy starcie, co 60 s, po powrocie do aplikacji i po każdej
  zmianie. Konflikty: „nowszy wygrywa”, usunięcia przenoszą się między urządzeniami.
- 🔐 **To samo szyfrowanie** — AES-256-GCM, klucz z hasła głównego (PBKDF2 310k);
  odszyfrowanie odbywa się tylko na telefonie, na Dysku leżą wyłącznie zaszyfrowane dane.
- 📋 Przeglądanie, wyszukiwanie, kopiowanie loginów i haseł, dodawanie i usuwanie wpisów.
- 🎲 Generator silnych haseł (8–64 znaki, wybór klas znaków).
- ✈️ Tryb offline — ostatnia pobrana kopia sejfu jest dostępna bez internetu (odczyt).

## Instalacja — w skrócie

Pełna instrukcja (z obrazkowym opisem konsoli Google) jest w pliku
[`KONFIGURACJA-GOOGLE.md`](../KONFIGURACJA-GOOGLE.md). Skrót:

1. Utwórz projekt w Google Cloud, włącz **Drive API**, dodaj siebie jako
   użytkownika testowego.
2. Utwórz identyfikator klienta OAuth typu **„Aplikacja internetowa”**
   z autoryzowanym źródłem `https://TWOJA-NAZWA.github.io`.
3. Włącz **GitHub Pages** dla tego repozytorium (gałąź `main`, folder root).
4. Na telefonie otwórz
   `https://TWOJA-NAZWA.github.io/NAZWA-REPO/chrome-password-manager-mobile/`
   w Chrome → menu ⋮ → **„Dodaj do ekranu głównego”**.
5. W aplikacji: wklej identyfikator klienta → zaloguj się przez Google → podaj
   **to samo hasło główne**, co w rozszerzeniu na komputerze.

## Ograniczenia

- Aplikacja nie wypełnia automatycznie pól w innych aplikacjach/przeglądarce na
  telefonie (Android pozwala na to tylko natywnym aplikacjom przez tzw. Autofill
  Framework) — hasła kopiujesz przyciskiem „Kopiuj hasło”.
- W trybie offline sejf jest tylko do odczytu.

## Pliki

```
chrome-password-manager-mobile/
├── index.html            # widoki: konfiguracja / logowanie / odblokowanie / sejf
├── app.js                # kryptografia, Dysk Google (OAuth + API), scalanie, UI
├── style.css             # styl (ciemny, mobilny)
├── manifest.webmanifest  # metadane PWA („Dodaj do ekranu głównego”)
├── sw.js                 # service worker – działanie offline
└── icons/                # ikony 192/512 px
```
