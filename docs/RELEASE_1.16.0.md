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

## Przebieg funkcji

### Podobne oferty

1. `StoreCache.getProduct()` pobiera aktywny produkt i, tak jak dotychczas, uzupelnia jego szczegoly tylko wtedy, gdy cache ich nie ma.
2. `selectRelatedProducts()` odrzuca biezaca oferte i ocenia pozostale po zgodnosci kategorii, slow tytulu oraz parametrow `Autor`, `Seria`, `Wydawnictwo` i `Producent`.
3. Dokladna kategoria daje 60 punktow, wspolny istotny poziom kategorii 12, wspolne slowo tytulu 28, autor 70, seria 48, a wydawnictwo lub producent 18.
4. Kandydat musi miec dokladna kategorie albo wspolne slowo tytulu, autora lub serie. Samo wspolne wydawnictwo nie wystarcza do pokazania niepowiazanej ksiazki.
5. Wynik malejacy jest pierwszym kryterium sortowania, a czas dodania lub aktualizacji rozstrzyga remis. Do widoku trafia maksymalnie osiem unikalnych ofert.

### Kategorie

1. SSR filtruje katalog po calej sciezce wybranej kategorii, dlatego licznik obejmuje takze widoczne podkategorie.
2. `relatedCategoryLinks()` wybiera najpierw podkategorie, nastepnie kategorie z tym samym rodzicem, a brakujace miejsca uzupelnia najpopularniejszymi widocznymi kategoriami.
3. Linki sa zwyklymi adresami `/kategoria/:id/:slug`, wiec dzialaja bez JavaScriptu i pozostaja dostepne dla crawlerow.
4. `public/assets/js/store.js` powtarza te sama kolejnosc po zmianie filtra bez przeladowania: aktualizuje URL, naglowek, licznik i maksymalnie szesc linkow.

### Sitemap i obrazy

1. `sitemapLastModified()` bierze najnowsza wiarygodna date z `contentUpdatedAt`, `sourceUpdatedAt`, `addedAt` i `sourceAddedAt`.
2. `descriptionFetchedAt` jest pominiete, bo oznacza wykonanie pobrania, a nie zawsze zmiane widocznej tresci oferty.
3. Desktop preloaduje i wyswietla `loft-hero.webp` 93 506 B, a ekran do 620 px `loft-hero-mobile.webp` 47 522 B.
4. CSS `image-set()` zachowuje dotychczasowy `loft-hero.jpg` jako fallback. Jawne `width` i `height` logo rezerwuja miejsce przed zaladowaniem obrazu.

## Pliki i zgodnosc

- Logika rekomendacji: `src/services/storeCache.js`.
- SSR kategorii, preload i sitemap: `src/routes/modules/pageRoutes.js`.
- Aktualizacja kategorii bez przeladowania: `public/assets/js/store.js`.
- Responsive hero: `public/assets/css/styles.css` oraz `public/assets/img/loft-hero*.webp`.
- Wersja aplikacji: `package.json`, `package-lock.json` i `src/config.js`.
- Nie zmienia sie format cache, API publiczne, ENV, OAuth Allegro, adresy URL, canonicale, tytuly ani opisy aktywnych ofert.

## Weryfikacja

- Test regresyjny rankingu rekomendacji obejmuje zgodny tytul i autora w tej samej oraz innej kategorii Allegro.
- Test SSR kategorii sprawdza licznik i link do powiazanej kategorii.
- Test sitemap potwierdza, ze nowsze `descriptionFetchedAt` nie zmienia `lastmod` produktu.
- Pelny zestaw `npm test` przechodzi: 16/16 testow.
- Playwright Chromium potwierdza brak poziomego overflow przy `1440x1000` i `390x844`, poprawna zmiane kategorii bez przeladowania oraz po 50 kart SSR i 6 linkow kontekstowych na pierwszym widoku kategorii.
- Przegladarka pobiera tylko `loft-hero.webp` na desktopie i tylko `loft-hero-mobile.webp` na telefonie; JPEG pozostaje niewykorzystanym fallbackiem dla starszych przegladarek.

## Ograniczenia

- Wydanie nie zostalo wdrozone na serwer.
- Produkcja pozostaje na `1.15.3` i branchu `ver-1.15`.

## Rollback

Poniewaz wersja nie ma migracji danych ani zmian ENV, rollback kodu polega na ponownym uruchomieniu ostatniego commita `ver-1.15`. Nie trzeba cofac ani przebudowywac runtime cache. Samo wypchniecie `ver-1.16` do GitHub nie zmienia produkcji.
