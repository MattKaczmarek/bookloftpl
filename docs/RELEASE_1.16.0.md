# BookLoft.pl 1.16.0

Status: przygotowane lokalnie na branchu `ver-1.16`, bez deployu i bez zmian na Hetznerze.

## Cel

Wersja poprawia odkrywanie powiazanych ofert, wewnetrzne linkowanie kategorii oraz wage pierwszego widoku. Nie zmienia tytulow, opisow, cen ani zdjec aktywnych ofert.

## Zmiany

- Aktywna karta produktu wybiera do osmiu podobnych ofert na podstawie wspolnych slow tytulu, autora, serii, wydawnictwa i sciezki kategorii.
- Przy rownym dopasowaniu wyzej trafia nowsza oferta; przypadkowa nowa pozycja z tej samej kategorii nie wypiera zgodnego tytulu lub autora.
- Strona kategorii podaje rzeczywista liczbe aktywnych ofert i linkuje maksymalnie szesc powiazanych, indeksowalnych kategorii.
- `lastmod` produktu nie korzysta z `descriptionFetchedAt`, poniewaz samo techniczne pobranie nie musi oznaczac zmiany widocznej tresci.
- Banner ma WebP 92 KB dla desktopu i 47 KB dla telefonu, zachowujac dotychczasowy JPEG jako fallback.
- Preload wybiera wariant bannera odpowiedni do szerokosci ekranu, a logo nie konkuruje z nim o priorytet sieciowy i ma jawne wymiary obrazu.

## Weryfikacja

- Test regresyjny rankingu rekomendacji obejmuje zgodny tytul i autora w tej samej oraz innej kategorii Allegro.
- Test SSR kategorii sprawdza licznik i link do powiazanej kategorii.
- Test sitemap potwierdza, ze nowsze `descriptionFetchedAt` nie zmienia `lastmod` produktu.
- Pelny zestaw `npm test` przechodzi: 16/16 testow.
- Playwright Chromium potwierdza brak poziomego overflow przy `1440x1000` i `390x844`, poprawna zmiane kategorii bez przeladowania oraz po 50 kart SSR i 6 linkow kontekstowych na pierwszym widoku kategorii.
- Przegladarka pobiera tylko `loft-hero.webp` na desktopie i tylko `loft-hero-mobile.webp` na telefonie; JPEG pozostaje niewykorzystanym fallbackiem dla starszych przegladarek.

## Ograniczenia

- Wydanie nie zostalo wdrozone ani wypchniete na serwer.
- Produkcja pozostaje na `1.15.3` i branchu `ver-1.15`.
