# Operacje BookLoftPL

Stan dokumentu: `2026-05-10`.
Aktywny branch na DO: `main`.
Usluga: brak procesu aplikacyjnego, statyczne pliki serwuje `nginx.service`.

## Granice projektu

`bookloftpl` to publiczny landing page. Nie jest czescia runtime Asystenta i nie przechowuje danych operacyjnych Asystenta.

Od brancha `ver-1.00` repo zawiera tez izolowany sklep testowy w katalogu `test/`, serwowany pod `/test`. Glowna wizytowka pod `/` pozostaje statyczna i nie powinna byc zmieniana przy pracach nad sklepem.

Nie dotyczy:

- `storage/` Asystenta,
- ofert Andrzeja,
- API Jarka,
- Google Sheets pakowania,
- sesji uzytkownikow Asystenta.

## Relacje z innymi projektami

- `bookloft-asystent` dziala jako osobna aplikacja na `asystent.bookloft.pl` i `andrzej.bookloft.pl`.
- `bot-andrzej` dziala jako `bot-andrzej.service` i wysyla oferty do Asystenta.
- `bot-jaroslaw` dziala jako `bot-jarek.service` i ma lokalne API dla Asystenta.
- `bookloftpl` moze linkowac do zewnetrznych sklepow albo sociali, ale nie powinien importowac kodu ani danych tych uslug.

## Deploy

### Wizytowka

```bash
cd /home/bookloftpl
git fetch
git switch main
git pull
```

Nginx reload:

```bash
systemctl reload nginx.service
```

Reload Nginx jest potrzebny tylko po zmianie konfiguracji serwera, nie po zwyklym pullu statycznych plikow albo dokumentacji.

### Sklep testowy `/test`

Branch sklepu: `ver-1.00`.
Wersja sklepu: `1.00`.

Minimalny deploy sklepu:

```bash
cd /home/bookloftpl
git fetch
git switch ver-1.00
git pull --ff-only
cd test
npm install --omit=dev
systemctl restart bookloft-test-shop.service
systemctl reload nginx.service
```

Wymagane ENV uslugi:

```bash
BASE_COM_TOKEN=...
BOOKLOFT_TEST_ADMIN_USER=admin
BOOKLOFT_TEST_ADMIN_PASSWORD=...
BOOKLOFT_TEST_SESSION_SECRET=...
BOOKLOFT_TEST_DATA_DIR=/var/lib/bookloft-test-shop
BASE_COM_PRICE_GROUP_NAME=Sklep
```

Sekrety nie moga trafic do frontendu, logow ani dokumentacji z realnymi wartosciami.

Cache sklepu:

- stany magazynowe co 30 minut,
- katalog, ceny, opisy HTML, tytuly, zdjecia i kategorie co 3 godziny,
- automatyczny refresh nie dodaje nowych produktow,
- produkt ze stanem `0` wypada ze sklepu i wraca tylko po akcji `Dodaj nowe` w panelu,
- puste kategorie sa usuwane z drzewa kategorii sklepu.

## Weryfikacja

```bash
systemctl is-active nginx.service
systemctl is-active bookloft-test-shop.service
curl -s -o /dev/null -w "%{http_code}\n" https://bookloft.pl/
curl -s -o /dev/null -w "%{http_code}\n" https://www.bookloft.pl/
curl -s -o /dev/null -w "%{http_code}\n" https://bookloft.pl/test/
curl -s http://127.0.0.1:3205/test/health
```
