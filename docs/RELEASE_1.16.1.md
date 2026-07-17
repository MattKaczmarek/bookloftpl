# BookLoft.pl 1.16.1

Status: przygotowane na branchu `ver-1.16`, przed deployem.

## Cel i zakres

- Duzy naglowek strony kategorii nadal pokazuje jej nazwe.
- Nizszy opis zaczyna sie od liczby ofert, bez ponownego prefiksu z nazwa kategorii.
- Ta sama funkcja dziala w SSR i po klientowej zmianie kategorii bez przeladowania.
- Meta title, meta description, URL-e, canonicale, sitemap, dane ofert i cache pozostaja bez zmian.

## Weryfikacja

- Test SSR wymaga tekstu `51 ofert...` i jawnie odrzuca stare `Fantasy: 51 ofert...`.
- Po deployu sprawdz strone kategorii na desktopie i mobile oraz brak bledow w `bookloft-shop.service`.

## Rollback

Zmiana nie ma migracji ani zmian ENV. Rollback polega na powrocie do tagu `bookloftpl-v1.16.0` i restarcie `bookloft-shop.service`; cache pozostaje zgodny.
