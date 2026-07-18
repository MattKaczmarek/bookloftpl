# BookLoft.pl 1.17.2

Status: przygotowane i przetestowane na branchu `ver-1.17`; przed deployem.

## Cel

Usunac ostrzezenia danych produktowych Google bez zmiany tresci ofert ani procesu zakupu. Polityka zwrotow pozostaje obslugiwana przez Allegro, a identyfikatory sa publikowane tylko wtedy, gdy maja poprawny format i sume kontrolna.

## Dane strukturalne

- `OnlineStore` publikuje wspolna `MerchantReturnPolicy` z bezposrednim linkiem do instrukcji zwrotu zakupu w Pomocy Allegro.
- Kazdy `Offer` wskazuje wspolna polityke przez stabilne `@id`; aplikacja nie deklaruje wlasnej liczby dni, kosztow ani metody zwrotu.
- Poprawny ISBN-13 jest publikowany na laczonym typie `Product` i `Book`, zgodnie z wymaganiami Google.
- Poprawny ISBN-10 jest walidowany i konwertowany do ISBN-13 przed publikacja.
- ISBN o blednej dlugosci, prefiksie albo sumie kontrolnej jest pomijany w polach identyfikatora JSON-LD.
- Parametry Allegro `EAN (GTIN)`, `EAN`, `GTIN`, `Kod EAN` i `Kod producenta` sa rozpoznawane, ale wartosc trafia do `gtin8`, `gtin12`, `gtin13` albo `gtin14` dopiero po walidacji sumy kontrolnej.
- Filmy i inne produkty z EAN pozostaja typem `Product`; nie otrzymuja pola `isbn` ani typu `Book`.

## Niezmienione kontrakty

- Bez zmian pozostaja tytuly, meta description, opisy Allegro, ceny, zdjecia, kategorie, canonicale, sitemap i statusy HTTP.
- Zakup, platnosc, dostawa oraz zwroty nadal odbywaja sie na Allegro.
- Nie ma zmian ENV, Nginx, formatu cache ani API.

## Weryfikacja

- `npm test`: 19/19 testow.
- `node --check src/routes/modules/pageRoutes.js` i `git diff --check`: bez bledow.
- Test routingu potwierdza konwersje ISBN-10, laczony typ `Product`/`Book`, osobny GTIN filmu, odrzucenie blednych sum kontrolnych oraz polaczenie `Offer` z polityka Allegro.
- Test na kopii pelnego produkcyjnego cache potwierdzil poprawny wynik dla ISBN-10, ISBN-13, UPC/EAN oraz niepelnego ISBN; po tescie nie pozostal lokalny serwer.

## Deploy i rollback

Patch nie wymaga pelnego odswiezenia cache ani ponownego zglaszania sitemap. Ostrzezenia w Search Console moga znikac stopniowo po ponownym crawlowaniu stron przez Google.

Rollback nie wymaga migracji: powrot do tagu `bookloftpl-v1.17.1`, `npm ci --omit=dev` i restart `bookloft-shop.service`.
