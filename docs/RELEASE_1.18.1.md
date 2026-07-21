# BookLoft.pl 1.18.1

Status: patch gotowy na branchu `ver-1.18`; przed deployem. Produkcja dziala na `1.18.0`.

## Cel

Pokazanie ofert kategorii juz na pierwszym ekranie telefonu przez usuniecie zbednego powtorzenia nawigacji i zageszczenie kontrolek katalogu.

## Zmiany

- `Kategoria` i `Sortuj` sa zgrupowane w `mobile-catalog-controls` i ponizej `980 px` zajmuja jeden wiersz z dwiema rownymi kolumnami.
- Obie kontrolki zachowuja czytelne etykiety, ten sam wymiar i bezpieczne `minmax(0, 1fr)` na waskich ekranach.
- `Przegladaj tez` jest ukryte przez CSS ponizej `620 px`, poniewaz na telefonie powtarzalo funkcje paska `Popularne` i selekta kategorii.
- Linki `Przegladaj tez` nie zostaly usuniete z HTML. Pozostaja w SSR, na desktopie i w ukladach tabletowych, wiec wewnetrzne linkowanie kategorii nie zostalo zmienione.
- Wersja aplikacji i zasobow statycznych zostala podniesiona do `1.18.1`.

## Efekt mobilny

- `320 px`: pierwsza oferta przesunieta z `y=803` do `y=582`.
- `390 px`: pierwsza oferta przesunieta z `y=799` do `y=604`.
- Przy `280`, `300`, `320`, `360`, `390` i `430 px` obie kontrolki maja rowna wysokosc `68 px`, rowne kolumny i nie powoduja poziomego overflow.
- Przy `280` i `300 px` same selekty zachowuja cel dotykowy `44 px`, a pierwsza oferta zaczyna sie na `y=603`.

## Granice

Nie zmieniono tytulow ani opisow ofert, meta title, meta description, canonicali, schema, sitemap, URL-i, danych Allegro, API, formatu cache, ENV ani Nginx. Patch nie wymaga odswiezenia cache ani migracji danych.

## Weryfikacja

- `npm test`: 22/22 testy zaliczone.
- `node --check`: SSR bez bledu skladni.
- Playwright na kopii publicznych danych: brak bledow i overflow przy `280`, `300`, `320`, `360`, `390` i `430 px`.
- Kontrola wizualna przy `280`, `300`, `320` i `390 px`: widoczny poczatek kart ofert na pierwszym ekranie, rowny wiersz filtrow i brak sekcji `Przegladaj tez`.
- Tymczasowy serwer i zrzuty zostaly usuniete po kontroli.

## Deploy i rollback

Deploy nie zostal jeszcze wykonany. Po wdrozeniu nalezy sprawdzic health `1.18.1`, logi, strone kategorii na mobile, zmiane obu selektow oraz brak overflow.

Rollback polega na powrocie do tagu `bookloftpl-v1.18.0` i restarcie `bookloft-shop.service`; dane i cache nie wymagaja zmian.
