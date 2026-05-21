# BookLoftPL

Publiczny statyczny landing page BookLoft.

Aktywny branch produkcyjny na Hetznerze: `main`.
Repo na Hetznerze: `/home/bookloftpl`.
Serwowanie: Nginx jako statyczne pliki.

## Zakres

Repo zawiera tylko publiczna strone firmowa:

- `index.html`
- `styles.css`
- `script.js`
- `images/`

Ta aplikacja nie jest `bookloft-asystent` i nie ma bezposredniej integracji z botami.

## Relacja do pozostalych repo

- `bookloft-asystent` - wewnetrzna aplikacja operacyjna pod `asystent.bookloft.pl` oraz webowy Andrzej pod `andrzej.bookloft.pl`.
- `bot-andrzej` - skaner Vinted/OLX, wysyla oferty do Asystenta.
- `bot-jaroslaw` - Telegram/API Jarka dla historii cen i czatu w Asystencie.
- `bookloftpl` - publiczna wizytowka, niezalezna od powyzszych runtime danych.

Zmiany w tym repo nie powinny dotykac storage Asystenta, konfiguracji botow ani uslug `bot-andrzej.service` / `bot-jarek.service`.

## Produkcja

Na Hetznerze:

- repo: `/home/bookloftpl`
- domena: `bookloft.pl` oraz `www.bookloft.pl`
- proces: brak procesu aplikacyjnego; statyczne pliki czyta `nginx.service`

DNS jest zarzadzany w Hetzner DNS. Delegacja domeny u rejestratora ma wskazywac:

- `hydrogen.ns.hetzner.com`
- `oxygen.ns.hetzner.com`
- `helium.ns.hetzner.de`

Rekordy produkcyjne:

- `A @ -> 178.105.196.178`
- `CNAME www -> bookloft.pl.`

## Deploy

Standard:

1. zmiana lokalna,
2. `git push`,
3. na Hetznerze: `cd /home/bookloftpl && git fetch && git switch main && git pull`,
4. reload Nginx tylko jesli zmieniala sie konfiguracja Nginx,
5. smoke test publicznej strony.

Zmiany dokumentacyjne nie wymagaja reloadu.

## Smoke test

```bash
curl -I https://bookloft.pl/
curl -I https://www.bookloft.pl/
```

