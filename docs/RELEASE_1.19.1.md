# BookLoft sklep 1.19.1

## Cel

Wersja `1.19.1` jest poprawka operacyjna bezpieczenstwa: proces sklepu nie
moze dzialac jako `root`. Nie zmienia katalogu publicznego, SEO, Allegro,
harmonogramu `22:00` ani formatu cache.

## Problem

Produkcyjny unit `bookloft-shop.service` oraz przykladowy plik w repo mialy
`User=root`. Kompromitacja procesu Node sklepu dawala uprawnienia roota na
Hetznerze. Asystent i boty juz dzialaja jako osobne konta uslugowe.

## Zmiana

1. `deploy/bookloft-shop.service.example` ustawia:
   - `User=bookloft` / `Group=bookloft`
   - `ExecStart=/usr/bin/node /home/bookloftpl/src/server.js` (bez `npm start`)
   - hardening zblizony do Asystenta: `NoNewPrivileges`, `ProtectSystem=strict`,
     `ProtectHome=read-only`, `ReadWritePaths=/var/lib/bookloft-shop`,
     `UMask=0077`, puste capabilities, ograniczone family adresow
2. Numer wersji aplikacji: `1.19.1` (`package.json`, `src/config.js`).
3. Dokumentacja OPERATIONS/README opisuje wymagane uprawnienia plikow przed
   restartem.

## Wymagane kroki na serwerze (przy deployu)

Przed `systemctl restart bookloft-shop` (kolejnosc wazna):

```bash
# 1. ENV czytelny dla uslugi, nie swiatowy
chown root:bookloft /etc/bookloft-shop/bookloft-shop.env
chmod 640 /etc/bookloft-shop/bookloft-shop.env

# 2. Runtime cache i OAuth wlasnoscia uslugi
chown -R bookloft:bookloft /var/lib/bookloft-shop
chmod 750 /var/lib/bookloft-shop

# 3. Kod w /home/bookloftpl musi byc czytelny dla bookloft
#    (obecnie katalog jest bookloft:bookloft; node_modules root:root OK jako
#    read-only dla bookloft jesli o+rX; w razie problemow: chown -R bookloft:bookloft)

# 4. Zainstaluj unit z repo
cp /home/bookloftpl/deploy/bookloft-shop.service.example \
  /etc/systemd/system/bookloft-shop.service
systemctl daemon-reload
systemctl restart bookloft-shop.service
systemctl status bookloft-shop.service --no-pager

# 5. Weryfikacja
ps -o user,pid,cmd -C node | grep bookloftpl || \
  ps -eo user,pid,cmd | grep 'node .*bookloftpl' | grep -v grep
curl -sS http://127.0.0.1:3205/health
```

Oczekiwane:

- proces Node sklepu jako `bookloft`, nie `root`
- health `ok`, wersja `1.19.1`
- `NRestarts=0` po stabilnym starcie
- katalog publiczny i panel bez regresji

## Rollback

Przywroc poprzedni unit (z `User=root` tylko awaryjnie) oraz poprzedni commit
`1.19.0`, potem `daemon-reload` i restart. Po rollbacku przywroc wlasnosc
`/var/lib/bookloft-shop` jesli zmieniales ja pod `bookloft`.

## Poza zakresem

- hashowanie hasla admina panelu
- rate limit Nginx na `/login` sklepu
- zmiany storefront / SEO / Allegro
