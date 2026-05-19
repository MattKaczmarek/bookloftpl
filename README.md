# BookLoftPL

Publiczny statyczny landing page BookLoft oraz izolowany testowy sklep pod `/test`.

Aktywny branch produkcyjnej wizytowki na DO: `main`.
Repo na DO: `/home/bookloftpl`.
Serwowanie wizytowki: Nginx jako statyczne pliki.
Branch testowego sklepu: `ver-1.00`.
Wersja testowego sklepu: `1.00`.

## Zakres

Repo zawiera tylko publiczna strone firmowa:

- `index.html`
- `styles.css`
- `script.js`
- `images/`

Nowy sklep testowy jest calkowicie wydzielony w katalogu `test/` i ma dzialac pod `https://bookloft.pl/test`. Glowny landing `https://bookloft.pl/` pozostaje bez zmian.

Ta aplikacja nie jest `bookloft-asystent` i nie ma bezposredniej integracji z botami.

## Relacja do pozostalych repo

- `bookloft-asystent` - wewnetrzna aplikacja operacyjna pod `asystent.bookloft.pl` oraz webowy Andrzej pod `andrzej.bookloft.pl`.
- `bot-andrzej` - skaner Vinted/OLX, wysyla oferty do Asystenta.
- `bot-jaroslaw` - Telegram/API Jarka dla historii cen i czatu w Asystencie.
- `bookloftpl` - publiczna wizytowka, niezalezna od powyzszych runtime danych.

Zmiany w tym repo nie powinny dotykac storage Asystenta, konfiguracji botow ani uslug `bot-andrzej.service` / `bot-jarek.service`.

## Produkcja

Na DO dla wizytowki:

- repo: `/home/bookloftpl`
- domena: `bookloft.pl` oraz `www.bookloft.pl`, jesli tak wskazuje Nginx/DNS
- proces: brak procesu aplikacyjnego; statyczne pliki czyta `nginx.service`

Sklep testowy `/test`:

- katalog aplikacji: `/home/bookloftpl/test`
- proces: `bookloft-test-shop.service`
- reverse proxy: Nginx location `/test/` do lokalnego procesu Node
- cache runtime: `BOOKLOFT_TEST_DATA_DIR`, produkcyjnie `/var/lib/bookloft-test-shop`
- integracja Base.com: backend przez `BASE_COM_TOKEN`, ceny z grupy cenowej `Sklep`
- dokumentacja szczegolowa: `test/README.md`

## Deploy

Standard:

1. zmiana lokalna,
2. `git push`,
3. na DO: `cd /home/bookloftpl && git fetch && git switch main && git pull`,
4. reload Nginx tylko jesli zmieniala sie konfiguracja Nginx,
5. smoke test publicznej strony.

Zmiany dokumentacyjne nie wymagaja reloadu.

## Smoke test

```bash
curl -I https://bookloft.pl/
curl -I https://www.bookloft.pl/
```
