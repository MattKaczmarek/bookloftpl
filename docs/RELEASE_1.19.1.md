# BookLoft sklep 1.19.1

## Cel

Wersja `1.19.1` jest poprawka operacyjna bezpieczenstwa: proces sklepu nie
moze dzialac jako `root` i **nie moze dzielic UID z Asystentem** (`bookloft`).
Nie zmienia katalogu publicznego, SEO, Allegro, harmonogramu `22:00` ani
formatu cache.

## Problem

1. Produkcyjny unit `bookloft-shop.service` mial `User=root`.
2. Pierwsza propozycja w Git uzywala `User=bookloft` (ten sam UID co
   `bookloft-asystent`). Na Hetznerze konto `bookloft` czyta
   `/etc/bookloft-asystent/bookloft-asystent.env` (`640 root:bookloft`) oraz
   klucze w `/home/bookloft/.ssh/`. Shared UID nie jest akceptowalnym
   least privilege.

## Zmiana (skorygowana)

1. `deploy/bookloft-shop.service.example` ustawia:
   - **`User=bookloft-shop` / `Group=bookloft-shop`** (osobne konto uslugi)
   - `ExecStart=/usr/bin/node /home/bookloftpl/src/server.js`
   - hardening: `NoNewPrivileges`, `ProtectSystem=strict`,
     `ProtectHome=read-only`, `ReadWritePaths=/var/lib/bookloft-shop`,
     `UMask=0077`, puste capabilities
   - `InaccessiblePaths` obejmuje m.in. `/home/bookloft`,
     `/home/bookloft-asystent`, `/etc/bookloft-asystent` oraz katalogi botow
2. Numer wersji aplikacji: `1.19.1` (`package.json`, `src/config.js`).
3. Dokumentacja OPERATIONS/README opisuje `useradd` i uprawnienia plikow.

## Wymagane kroki na serwerze (przy deployu)

```bash
# 1. Osobne konto uslugi (jednorazowo)
id bookloft-shop 2>/dev/null || useradd --system --home /var/lib/bookloft-shop \
  --shell /usr/sbin/nologin --user-group bookloft-shop

# 2. ENV tylko dla sklepu — NIE root:bookloft
chown root:bookloft-shop /etc/bookloft-shop/bookloft-shop.env
chmod 640 /etc/bookloft-shop/bookloft-shop.env

# 3. Runtime
chown -R bookloft-shop:bookloft-shop /var/lib/bookloft-shop
chmod 750 /var/lib/bookloft-shop

# 4. Kod w /home/bookloftpl musi byc czytelny dla bookloft-shop
#    (typowe o+rX na plikach; WorkingDirectory bez zapisu)
#    Nie dawaj bookloft-shop wlasnosci /home/bookloft ani kluczy Asystenta.

# 5. Unit z repo
install -m 644 /home/bookloftpl/deploy/bookloft-shop.service.example \
  /etc/systemd/system/bookloft-shop.service
systemctl daemon-reload
systemctl restart bookloft-shop.service

# 6. Weryfikacja izolacji (same tak/nie — bez cat sekretow)
systemctl show bookloft-shop.service -p User -p Group --value
# oczekiwane: bookloft-shop
sudo -u bookloft-shop test -r /etc/bookloft-shop/bookloft-shop.env && echo shop_env_ok
sudo -u bookloft-shop test -r /etc/bookloft-asystent/bookloft-asystent.env \
  && echo FAIL_can_read_asystent_env || echo OK_cannot_read_asystent_env
sudo -u bookloft-shop test -r /home/bookloft/.ssh/centrum_ai_upload_cotombo_ed25519 \
  && echo FAIL_can_read_upload_key || echo OK_cannot_read_upload_key
curl -sS http://127.0.0.1:3205/health
```

Oczekiwane:

- proces Node sklepu jako **`bookloft-shop`**, nie `root` i nie `bookloft`
- health `ok`, wersja `1.19.1`
- `OK_cannot_read_asystent_env` i `OK_cannot_read_upload_key`
- `NRestarts=0` po stabilnym starcie

## Skrypt cache refresh

`systemd-run` do `refresh-production-cache.js` musi uzywac
`User=bookloft-shop` / `Group=bookloft-shop` (nie `bookloft`).

## Rollback

Przywroc poprzedni unit i commit `1.19.0`, `daemon-reload`, restart.
Po rollbacku przywroc wlasnosc runtime jesli zmieniales ja pod `bookloft-shop`.

## Poza zakresem

- hashowanie hasla admina panelu
- rate limit Nginx na `/login` sklepu
- zmiany storefront / SEO / Allegro
