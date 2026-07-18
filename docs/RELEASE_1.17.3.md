# BookLoft.pl 1.17.3

Status: wdrozone produkcyjnie `2026-07-18` na branchu `ver-1.17`, commit kodu `ffa4f6d`, tag `bookloftpl-v1.17.3`.

## Cel

Usunac z wynikow Google techniczne strony paginacji katalogu, zachowujac je jako crawlable zaplecze infinite scrolla i bez ograniczania indeksowania pojedynczych ofert.

## Zakres

- `/strona/:page` od strony 2 zwraca nadal `200`, wlasny canonical oraz linki do sasiednich stron, ale ma `noindex,follow,max-image-preview:large`.
- `/kategoria/:id/:slug/strona/:page` od strony 2 zachowuje ten sam kontrakt techniczny i rowniez ma `noindex,follow`.
- Strony paginacji katalogu i kategorii nie sa juz wpisywane do `/sitemap.xml`.
- Strona glowna, pierwsze strony kategorii i wszystkie aktywne produkty pozostaja indeksowalne oraz obecne w sitemapie.
- Ukryte linki HTML paginacji pozostaja w SSR jako zaplecze dla crawlerow i przegladarek bez infinite scrolla.

## Niezmienione kontrakty

- Infinite scroll, wyszukiwanie, sortowanie, kategorie i bezposrednie adresy produktow dzialaja bez zmian.
- Nie zmieniono tytulow ani opisow produktow, cen, zdjec, JSON-LD, danych Allegro, statusow ofert, ENV, Nginx ani formatu cache.
- Strony 2+ nie sa przekierowywane na strone glowna i nie sa blokowane w `robots.txt`, dzieki czemu Google moze odczytac dyrektywe `noindex`.

## Weryfikacja

- `npm test`: 20/20 testow.
- Test routingu potwierdza `200`, `noindex,follow`, self-canonical i link `prev` dla paginacji katalogu oraz `noindex,follow` i self-canonical dla paginacji kategorii.
- Test sitemap potwierdza brak adresow paginacji katalogu i kategorii przy zachowaniu wpisow produktow i ich `lastmod`.
- `node --check src/routes/modules/pageRoutes.js` i `git diff --check`: bez bledow.
- Testy na Hetznerze przeszly 20/20 przed restartem uslugi.
- Live-check potwierdzil `200`, `noindex,follow`, self-canonical i linki produktow na stronach 2, 3, 40 oraz drugiej stronie kategorii Fantasy.
- Produkcyjna sitemap zawiera 2027 produktow oraz zero adresow paginacji katalogu i kategorii.
- Health potwierdzil wersje `1.17.3`, aktywne Allegro, brak ostatniego bledu cache oraz brak ostrzezen, bledow i automatycznych restartow procesu.

## Deploy i rollback

Zmiana nie wymagala odswiezenia cache ofert. Sitemap zostala ponownie wyslana w Search Console, poniewaz istotnie zmienil sie jej zbior adresow; po wyslaniu ma stan oczekujacy, 0 bledow i 0 ostrzezen. Google usunie juz zindeksowane strony 2+ dopiero po ponownym crawlowaniu i odczytaniu `noindex`.

Rollback nie wymaga migracji: powrot do tagu `bookloftpl-v1.17.2`, `npm ci --omit=dev` i restart `bookloft-shop.service`.
