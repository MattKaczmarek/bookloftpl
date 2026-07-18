# BookLoft.pl 1.17.1

Status: wdrozone produkcyjnie `2026-07-18` na branchu `ver-1.17`, commit kodu `0f14dbe`, tag `bookloftpl-v1.17.1`.

## Zakres

- Przywraca poziomy ruch paska zalet na ekranach mobilnych do 620 px.
- Zachowuje mobilny pasek z nazwa, cena i przyciskiem `Kup na Allegro` dodany w 1.17.0.
- Nie zmienia katalogu, danych ofert, cache, API, SEO, sitemap, routingu ani wygladu desktopowego.

## Weryfikacja

- `npm test`: 18/18 testow.
- Playwright na szerokosciach 320 px i 390 px: `trustTicker` ma stan `running`, transformacja zmienia sie w czasie, a statyczny zamiennik nie jest renderowany.
- Oba widoki nie maja poziomego overflow ani bledow JavaScript; pasek zakupu pozostaje widoczny i przyklejony.
- Produkcyjny health zwrocil wersje `1.17.1`, aktywne polaczenie z Allegro, 2029 widocznych ofert i brak ostatniego bledu cache.

## Rollback

Patch nie ma migracji. Rollback polega na powrocie do tagu `bookloftpl-v1.17.0`, `npm ci --omit=dev` i restarcie `bookloft-shop.service`.
