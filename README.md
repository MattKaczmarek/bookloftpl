# BookLoft sklep

Wersja sklepu: `1.02`.
Branch produkcyjny tej wersji: `ver-1.02`.

Repo zawiera docelową aplikację sklepu BookLoft serwowaną z root domeny `https://bookloft.pl/`. Stara statyczna wizytówka została usunięta z tej linii kodu.

## Zakres

- sklep pod `/`,
- panel administratora pod `/panel`,
- strony produktów pod `/product/:id/:slug`,
- API sklepu pod `/api`,
- logowanie administracyjne na podstawie zmiennych ENV,
- integracja z Base.com po stronie backendu,
- cache katalogu, cen, zdjęć, opisów i kategorii,
- przygotowane meta tagi, canonicale, dane strukturalne Product/Offer i sitemap pod przyszłe SEO.

Sklep jest obecnie celowo schowany za logowaniem i wysyła `X-Robots-Tag: noindex, nofollow, noarchive`. Po zdjęciu hasła kod jest przygotowany do indeksowania wszystkich aktywnych ofert, nie tylko nowości.

## Sekrety

W repo nie ma realnych tokenów, haseł ani kluczy. Wartości muszą być podawane wyłącznie przez ENV serwera albo lokalną powłokę.

Wymagane:

```bash
BASE_COM_TOKEN=...
BOOKLOFT_ADMIN_USER=...
BOOKLOFT_ADMIN_PASSWORD=...
BOOKLOFT_SESSION_SECRET=...
```

Zalecane produkcyjnie:

```bash
NODE_ENV=production
BOOKLOFT_HOST=127.0.0.1
BOOKLOFT_PORT=3205
BOOKLOFT_BASE_PATH=/
BOOKLOFT_COOKIE_SECURE=true
BOOKLOFT_DATA_DIR=/var/lib/bookloft-shop
BOOKLOFT_PUBLIC_ORIGIN=https://bookloft.pl
BASE_COM_PRICE_GROUP_NAME=Sklep
```

Opcjonalne:

```bash
BASE_COM_INVENTORY_ID=...
BASE_COM_PRICE_GROUP_ID=...
BASE_COM_WAREHOUSE_ID=...
BOOKLOFT_STOCK_REFRESH_MS=1800000
BOOKLOFT_CATALOG_REFRESH_MS=10800000
BASE_COM_REQUEST_TIMEOUT_MS=30000
BASE_COM_PRODUCTS_DATA_CHUNK_SIZE=100
```

## Cache

Cache jest trzymany w `BOOKLOFT_DATA_DIR`.

- `published-products.json` - aktywne produkty dopuszczone do sklepu,
- `stock-cache.json` - ostatnie stany z Base,
- `catalog-cache.json` - tytuły, opisy HTML, zdjęcia, ceny i kategorie aktywnych produktów,
- `storefront-cache.json` - gotowe dane dla frontendu,
- `cache-meta.json` - status ostatnich aktualizacji i błędów.

Zasady:

- stany magazynowe odświeżają się co 30 minut,
- katalog, ceny, opisy, zdjęcia i kategorie odświeżają się co 3 godziny,
- automatyczny refresh nie dodaje nowych produktów do sklepu,
- produkt ze stanem `0` znika ze sklepu,
- produkt, który wróci na stan `>= 1`, wraca po akcji `Dodaj nowe` w panelu.

## Frontend

- strona główna pokazuje 50 najnowszych aktywnych ofert,
- pełny katalog można przeszukiwać po tytule, autorze i kategorii,
- karty listingu pokazują zdjęcie, kategorię, tytuł, cenę i link do szczegółów,
- opisy HTML są ładowane dopiero na stronie produktu,
- sekcja `O BookLoft` opisuje sklep jako markę z 4-letnim doświadczeniem,
- układ jest responsywny dla desktopu, telefonu i webview w aplikacjach społecznościowych.

## Uruchomienie lokalne

```powershell
cd C:\Users\Właściciel\OneDrive\Pulpit\CODEX\bookloftpl-home-visual
$env:BASE_COM_TOKEN="..."
$env:BOOKLOFT_ADMIN_USER="..."
$env:BOOKLOFT_ADMIN_PASSWORD="..."
$env:BOOKLOFT_SESSION_SECRET="..."
$env:BOOKLOFT_COOKIE_SECURE="false"
$env:BOOKLOFT_PUBLIC_ORIGIN="http://127.0.0.1:3225"
$env:BOOKLOFT_PORT="3225"
npm install
npm start
```

Adres lokalny:

```text
http://127.0.0.1:3225/
```

## Deploy

Standard:

1. zmiana lokalna,
2. `git push`,
3. na Hetznerze: `cd /home/bookloftpl && git fetch && git switch ver-1.02 && git pull --ff-only`,
4. `npm ci --omit=dev`,
5. restart usługi sklepu,
6. reload Nginx tylko po zmianie konfiguracji Nginx,
7. smoke test domeny i lokalnego healthchecka.

Szczegóły operacyjne są w `docs/OPERATIONS.md`.
