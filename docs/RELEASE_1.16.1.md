# BookLoft.pl 1.16.1

Status: wdrozone produkcyjnie `2026-07-17` na branchu `ver-1.16`, commit `6bda500`.

## Cel i zakres

- Duzy naglowek strony kategorii nadal pokazuje jej nazwe.
- Nizszy opis zaczyna sie od liczby ofert, bez ponownego prefiksu z nazwa kategorii.
- Ta sama funkcja dziala w SSR i po klientowej zmianie kategorii bez przeladowania.
- Meta title, meta description, URL-e, canonicale, sitemap, dane ofert i cache pozostaja bez zmian.

## Weryfikacja

- Test SSR wymaga tekstu `51 ofert...` i jawnie odrzuca stare `Fantasy: 51 ofert...`.
- Pelny zestaw `npm test` przechodzi: 16/16 testow.
- Produkcyjny SSR kategorii pokazuje `565 ofert...` bez prefiksu `Fantasy:`.
- Playwright potwierdzil ten sam wynik po klientowej zmianie kategorii na desktopie i przez mobilny selektor, bez overflow ani nakladania tekstu.
- Health zwraca wersje `1.16.1`, cache i polaczenie Allegro pozostaja zdrowe, a log uslugi nie zawiera bledow po restarcie.

## Rollback

Zmiana nie ma migracji ani zmian ENV. Rollback polega na powrocie do tagu `bookloftpl-v1.16.0` i restarcie `bookloft-shop.service`; cache pozostaje zgodny.
