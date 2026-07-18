# BookLoft.pl 1.17.1

Status: przygotowane i przetestowane na branchu `ver-1.17`; przed deployem.

## Zakres

- Przywraca poziomy ruch paska zalet na ekranach mobilnych do 620 px.
- Zachowuje mobilny pasek z nazwa, cena i przyciskiem `Kup na Allegro` dodany w 1.17.0.
- Nie zmienia katalogu, danych ofert, cache, API, SEO, sitemap, routingu ani wygladu desktopowego.

## Weryfikacja

- `npm test`: 18/18 testow.
- Playwright na szerokosciach 320 px i 390 px: `trustTicker` ma stan `running`, transformacja zmienia sie w czasie, a statyczny zamiennik nie jest renderowany.
- Oba widoki nie maja poziomego overflow ani bledow JavaScript; pasek zakupu pozostaje widoczny i przyklejony.

## Rollback

Patch nie ma migracji. Rollback polega na powrocie do tagu `bookloftpl-v1.17.0`, `npm ci --omit=dev` i restarcie `bookloft-shop.service`.
