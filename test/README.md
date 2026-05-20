# BookLoft sklep testowy

Wersja sklepu: `1.01`.

Ten katalog zawiera izolowana aplikacje sklepu pod adresem `/test`. Glowna wizytowka `bookloft.pl` pozostaje poza tym katalogiem i nie jest zaleznoscia sklepu.

## Zakres

- sklep pod `https://bookloft.pl/test`,
- panel administratora pod `https://bookloft.pl/test/panel`,
- osobne strony produktow pod `/test/product/:id/:slug`,
- logowanie loginem z ENV i haslem z ENV,
- integracja z Base.com przez `BASE_COM_TOKEN`,
- ceny z grupy cenowej Base o nazwie `Sklep`,
- cache danych, zeby frontend nie odpytywal Base przy wejsciach uzytkownikow,
- reczne dodawanie nowych produktow przyciskiem `Dodaj nowe`.

## Zmiany w 1.01

- Glowny listing renderuje tylko 20 produktow na start.
- Dalsze produkty pokazuja sie dopiero po wyszukiwaniu albo wyborze kategorii, z porcjowaniem wynikow po 48 kart.
- Karta produktu prowadzi do wlasnego adresu produktu.
- Karta listingu pokazuje tylko zdjecie, skrocona kategorie, tytul, cene i przycisk `Szczegoly`; nie pokazuje opisu, SKU, stanu magazynowego, `Kup` ani `Koszyk`.
- Pelny opis HTML nie jest juz wysylany do kart listingu; trafia dopiero na strone produktu.
- Kategorie sa sortowane malejaco po liczbie widocznych ofert.
- Kategorie na kartach i w szybkich filtrach sa skracane do nazw sprzedazowych, np. `Fantasy`, `Kryminal`, `Mlodziezowe`; szybkie filtry deduplikuja powtorzone nazwy.
- Motyw sklepu jest bialy, a logo z repo jest renderowane jako czarny znak na bialym tle przez osobny plik `logo-mark.png`.

## Struktura

```text
test/
  src/
    config.js                 # ENV i stale runtime
    server.js                 # start Express
    lib/                      # auth, Base client, JSON store, HTML sanitizer
    routes/                   # osobne moduly tras: auth, pages, API, admin, health
    services/storeCache.js    # cache, publikacja i pruning kategorii
  public/
    store.html                # sklep
    panel.html                # panel administratora
    assets/
      css/styles.css
      js/store.js
      js/product.js
      js/panel.js
      img/logo.png
      img/logo-mark.png
  deploy/                     # przyklady systemd i Nginx
  scripts/                    # healthcheck
```

Podzial jest przygotowany pod rozwoj o rejestracje, koszyk, zamowienia i kolejne panele bez mieszania tych funkcji z landingiem.

## ENV

Wartosci sekretow nie sa zapisywane w repo.

Wymagane:

```bash
BASE_COM_TOKEN=...
BOOKLOFT_TEST_ADMIN_USER=admin
BOOKLOFT_TEST_ADMIN_PASSWORD=...
BOOKLOFT_TEST_SESSION_SECRET=...
```

Zalecane produkcyjnie:

```bash
NODE_ENV=production
BOOKLOFT_TEST_HOST=127.0.0.1
BOOKLOFT_TEST_PORT=3205
BOOKLOFT_TEST_BASE_PATH=/test
BOOKLOFT_TEST_COOKIE_SECURE=true
BOOKLOFT_TEST_DATA_DIR=/var/lib/bookloft-test-shop
BASE_COM_PRICE_GROUP_NAME=Sklep
```

Opcjonalne:

```bash
BASE_COM_INVENTORY_ID=27574
BASE_COM_PRICE_GROUP_ID=49399
BASE_COM_WAREHOUSE_ID=bl_35569
BOOKLOFT_TEST_STOCK_REFRESH_MS=1800000
BOOKLOFT_TEST_CATALOG_REFRESH_MS=10800000
```

Jesli `BASE_COM_PRICE_GROUP_ID` nie jest podane, aplikacja szuka grupy cenowej po nazwie `Sklep`.

## Cache

Cache jest trzymany w `BOOKLOFT_TEST_DATA_DIR`.

Pliki:

- `published-products.json` - aktywne produkty dopuszczone do sklepu,
- `stock-cache.json` - ostatnie stany z Base,
- `catalog-cache.json` - tytuly, opisy HTML, zdjecia, ceny i kategorie aktywnych produktow,
- `storefront-cache.json` - gotowe dane dla frontendu,
- `cache-meta.json` - status ostatnich aktualizacji i bledow.

Zasady:

- automatyczny refresh stanow co 30 minut,
- automatyczny refresh katalogu co 3 godziny,
- automatyczne refreshe nie dodaja nowych produktow do sklepu,
- produkt ze stanem `0` wypada z `published-products.json` i znika ze sklepu,
- produkt, ktory wroci na stan `>= 1`, wraca do sklepu dopiero po akcji `Dodaj nowe`,
- kategorie sa budowane z Base i przycinane do kategorii, ktore maja widoczne produkty.

## Panel

`/test/panel` ma na start jedna akcje:

- `Dodaj nowe` - pobiera z Base produkty ze stanem `>= 1`, porownuje z aktywnymi produktami sklepu i dodaje brakujace.

Panel pokazuje tez status cache, liczbe widocznych produktow, liczbe kategorii i ostatni blad Base API.

## HTML opisow

Opisy sa pobierane z Base jako HTML i sanitizowane po stronie backendu. Zachowane sa m.in. akapity, pogrubienia, listy, linki i tabele. Skrypty, event handlery i obce osadzenia sa usuwane.

## Uruchomienie lokalne

```powershell
cd C:\Users\Właściciel\OneDrive\Pulpit\CODEX\bookloftpl\test
$env:BASE_COM_TOKEN="..."
$env:BOOKLOFT_TEST_ADMIN_USER="admin"
$env:BOOKLOFT_TEST_ADMIN_PASSWORD="..."
$env:BOOKLOFT_TEST_SESSION_SECRET="dev-secret"
$env:BOOKLOFT_TEST_COOKIE_SECURE="false"
npm install
npm start
```

Adres lokalny:

```text
http://127.0.0.1:3205/test
```

## Healthcheck

```bash
npm run healthcheck
```

Produkcja:

```bash
curl -s http://127.0.0.1:3205/test/health
```

Healthcheck nie zwraca sekretow.
