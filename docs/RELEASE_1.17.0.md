# BookLoft.pl 1.17.0

Status: przygotowane na branchu `ver-1.17`; bez deployu. Produkcja pozostaje na `1.16.1` z brancha `ver-1.16`.

## Cel

Zmniejszyc koszt pierwszego wejscia do katalogu i na karte produktu, poprawic decyzje zakupowa na telefonie oraz uporzadkowac obsluge blednych i wycofanych adresow bez zmiany danych ofert ani sposobu zakupu.

## Przeplyw katalogu

1. Serwer renderuje 50 ofert, liczbe wszystkich pasujacych ofert, kategorie, canonical i dane strukturalne.
2. `store.js` przejmuje istniejacy listing bez pobierania `/api/storefront` i `/api/newest`.
3. Pelny katalog laduje sie dopiero przy wyszukiwaniu, sortowaniu, zmianie filtra albo dojsciu do sentinela infinite scroll.
4. Klient porownuje ID z SSR z aktualnym katalogiem. Jesli kolejnosc nadal pasuje, zachowuje gotowy DOM i dodaje nastepna paczke; przy rozjezdzie renderuje listing ponownie z aktualnych danych.

## Przeplyw produktu

1. Serwer renderuje cala karte produktu i przekazuje minimalne dane startowe w `window.__BOOKLOFT_PRODUCT__`.
2. `product.js` uruchamia galerie na istniejacym HTML. Nie pobiera pelnego storefrontu i nie zastepuje SSR.
3. Na ekranach do 620 px animowany ticker jest zastepowany trzema statycznymi atutami.
4. Nad galeria pojawia sie przyklejony pasek z nazwa, cena i bezposrednim przyciskiem `Kup na Allegro`.

## Bledne i wycofane adresy

- Nieznana sciezka nadal zwraca prawdziwe `404` oraz `X-Robots-Tag: noindex, nofollow, noarchive`.
- Ekran `404` ma banner BookLoft, wyszukiwarke i powrot do wszystkich ofert.
- Odswiezenie dostepnosci porownuje Allegro z suma aktywnych ID i ofert widocznych w poprzednim storefront. Usunieta oferta nie moze pozostac widoczna tylko dlatego, ze wypadla z `published-offers.json`.
- Dla naprawionego rozjazdu zapisywany jest lekki snapshot, a pozniejszy adres produktu zwraca `410 Gone`.

## Stabilnosc wizualna

- Dokladne podzbiory Latin i Latin Extended fontow Nunito Sans oraz Source Serif 4 sa preloadowane na listingach, produktach i stronach bledow.
- Lokalny pomiar po zimnym otwarciu dal CLS `0` dla strony glownej, kategorii, produktu i finalnego ekranu `404`.
- Widoki 320 px i 390 px nie maja poziomego overflow; pasek zakupu, atuty, galeria i formularz `404` mieszcza sie w viewport.

## Niezmienione kontrakty

- Nazwy, ceny, opisy, obrazy, parametry i adresy ofert pochodza z tego samego cache Allegro.
- Nie zmieniono generatorow meta title, meta description, canonicali, sitemap ani JSON-LD aktywnych ofert.
- Zakup nadal odbywa sie w Allegro; BookLoft.pl nie otrzymuje koszyka ani platnosci.
- Nie ma zmian ENV, konfiguracji Nginx ani migracji danych.

## Weryfikacja

- `npm test` - 18/18 testow jednostkowych i routingu.
- `node --check` - skrypty klienta, routing i cache.
- Playwright na kopii publicznego cache: start i kategoria `0` wywolan `/api/storefront` przed interakcja; produkt `0`; wyszukiwanie `1`; infinite scroll dodaje druga paczke 50 ofert.
- Playwright: galeria zmienia aktywne zdjecie; status `404` i naglowek `X-Robots-Tag` sa zachowane; brak bledow JavaScript i uszkodzonych obrazow w sprawdzonych widokach.

## Wdrazanie i rollback

W tym wydaniu nie wykonano deployu. Przed przyszlym wdrozeniem trzeba ponownie uruchomic testy, zrobic health-check i sprawdzic log uslugi po restarcie. Pelne odswiezenie cache nie jest wymagane.

Rollback nie wymaga migracji: powrot do tagu/commitu `1.16.1`, `npm ci --omit=dev` i restart `bookloft-shop.service`. Cache pozostaje zgodny w obie strony.
