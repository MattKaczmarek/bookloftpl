# BookLoft.pl 1.15.0

Status: wdrozone produkcyjnie na branchu `ver-1.15`.

Poprzednia produkcja: `ver-1.14`, commit `2aa707d`, wersja `1.14.5`.

## Cel

Wersja naprawia obsluge nieaktywnych ofert i techniczne sygnaly SEO wykryte w audycie z 2026-07-16. Nie zmienia nazw ofert, tytulow HTML aktywnych produktow ani ich meta description.

## Zakres zmian

### Strony 410 i 404

- Niedostepna historyczna oferta nadal zwraca `410 Gone`, `X-Robots-Tag: noindex, nofollow, noarchive` i nie przekierowuje na strone glowna.
- Uklad `410` nie korzysta z dwukolumnowego `.shop-layout`, ktory bez panelu kategorii umieszczal tresc w waskiej kolumnie i ucinal banner.
- Nowy widok pokazuje zapisane dane egzemplarza, wyszukiwarke z przygotowana fraza, link do katalogu oraz do osmiu aktualnych alternatyw.
- Dla starego URL bez snapshotu fraza jest wyliczana ze sluga. Strona nadal ma poprawny status `410`.
- Wspolny `.simple-page-shell` dla pozostalych stron bledow zostal wymuszony do jednej kolumny, co usuwa analogiczny blad szerokosci na `404`.

### Dane historyczne

`published-offers.json` przechodzi logicznie z `version: 2` na `version: 3` i dostaje mape `removedOfferSnapshots`.

Snapshot zawiera:

- `id`,
- `name`,
- `slug`,
- pierwsze `image`,
- `categoryId`, `categoryName` i `categoryPath`,
- `removedAt`,
- `sourceUpdatedAt`, jesli bylo znane.

Snapshot nie przechowuje ceny, pelnego opisu ani calej galerii. Przy ponownej aktywacji tego samego ID oba wpisy, `removedByUnavailable` i `removedOfferSnapshots`, sa usuwane.

Migracja jest wykonywana podczas zwyklego odczytu i kolejnego zapisu. Wersja `1.14` ignoruje dodatkowe pole, dlatego pozniejszy rollback kodu nie wymaga cofania pliku runtime.

### Alternatywy

Ranking aktualnych ofert bierze pod uwage:

- zgodnosc glownej frazy tytulu,
- wspolne istotne slowa,
- zgodnosc kategorii,
- date swiezosci jako rozstrzygniecie remisu.

Brakujace miejsca sa uzupelniane najnowszymi ofertami. Do HTML trafia maksymalnie osiem kart.

### Sitemap

- Usunieto globalny `lastmod` oparty na czasie kazdej przebudowy cache.
- `lastmod` jest opcjonalny i dotyczy tylko produktu z wiarygodna data `contentUpdatedAt`, `sourceUpdatedAt`, `descriptionFetchedAt`, `addedAt` albo `sourceAddedAt`.
- Zmiana nazwy, ceny, kategorii, SKU lub glownego zdjecia aktualizuje `contentUpdatedAt`.
- Usunieto ignorowane przez Google pola `changefreq` i `priority`.

### Dane strukturalne

- Hydratacja oferty laczy parametry ofertowe z `parameters` oraz produktowe z `productSet[].product.parameters`, zamiast odrzucac m.in. wydawnictwo, gdy Allegro zwraca ofertowy parametr stanu.
- `Product.brand` preferuje rzeczywiste wydawnictwo, producenta albo marke z Allegro. Przy braku znanej wartosci zachowuje dotychczasowy fallback `BookLoft`.
- Usunieto niepelne `MerchantReturnPolicy`, `ShippingService` i referencje polityki z `Offer`.
- Pozostaja prawdziwe dane `OnlineStore`, `Product`, `Offer`, cena, waluta, dostepnosc, stan, sprzedawca oraz identyfikatory, gdy Allegro je dostarczy.

### Bezpieczne wzbogacenie cache

- Chroniony endpoint operacyjny wzbogaca wszystkie aktywne oferty szczegolami Allegro w paczkach po 5 bez blokowania publicznego odczytu dotychczasowego cache.
- Katalog i storefront sa zapisywane atomowo dopiero po zakonczeniu operacji i kontroli niezmiennej liczby wpisow katalogu.
- Blad pojedynczej oferty zachowuje jej poprzednie dane; skrypt produkcyjny automatycznie ponawia nieudane wpisy jeden raz.
- Wzbogacenie zachowuje identyfikator, nazwe, cene, walute, stan, kategorie i status z aktualnego listingu, dlatego nie zmienia URL-i ani dostepnosci aktywnych ofert.
- Refresh listingu jest przerywany, gdy Allegro zwroci mniej niz 75% poprzedniego katalogu liczacego co najmniej 20 ofert.

### Snippety katalogu

- Przy aktywnym SSR kontener pustego wyniku jest pusty i ukryty. Jego tekst jest generowany dopiero dla faktycznie pustej listy.
- Techniczna paginacja nadal zawiera crawlable linki, ale jej kontener ma `data-nosnippet`.

### Zaleznosci

Istniejacy lockfile wskazywal wycofany artefakt `dayjs 1.11.30`, przez co czyste `npm ci` zwracalo `404`. `sanitize-html` zostal przypiety do stabilnej wersji `2.17.0`, a lockfile zostal odtworzony. `npm ci` oraz `npm audit --omit=dev` dzialaja poprawnie.

## Testy regresji

Polecenie:

```bash
npm test
```

Zakres:

- niezmieniony tytul i meta description aktywnej oferty,
- wydawnictwo Allegro z fallbackiem `BookLoft` i brak niepelnych polityk w JSON-LD,
- status, naglowki i zawartosc `410`,
- brak ukrytego pustego komunikatu w aktywnym SSR,
- `data-nosnippet` na technicznej paginacji,
- daty `lastmod` per produkt,
- migracja snapshotu, ranking alternatyw i czyszczenie po reaktywacji.
- polaczenie parametrow ofertowych i produktowych,
- ochrona przed masowym spadkiem aktywnego katalogu,
- atomowe paczkowe wzbogacenie z zachowaniem danych po bledzie pojedynczej oferty.

## Weryfikacja wdrozenia

1. Uruchomic `npm ci`, `npm test` i `npm audit --omit=dev`.
2. Sprawdzic PC `1440x900` i mobile `390x844` dla `/`, aktywnego produktu, historycznego `410` ze snapshotem, starego `410` bez snapshotu i nieznanego `404`.
3. Potwierdzic statusy HTTP, brak bledow konsoli, brak overflow i zaladowanie obrazow.
4. Uruchomic `scripts/refresh-production-cache.js` przez transient unit z produkcyjnym ENV.
5. Porownac liczbe aktywnych i widocznych ofert przed i po, sprawdzic sitemap oraz obserwowac logi uslugi.
