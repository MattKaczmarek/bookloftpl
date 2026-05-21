# Operacje BookLoft sklep

Stan dokumentu: `2026-05-21`.
Wersja sklepu: `1.02`.
Branch produkcyjny: `ver-1.02`.
Repo na Hetznerze: `/home/bookloftpl`.
Usługa aplikacji: `bookloft-shop.service`.

## Granice projektu

`bookloftpl` jest teraz aplikacją sklepu BookLoft serwowaną z root domeny `bookloft.pl`. Repo nie zawiera już osobnej statycznej wizytówki ani wydzielonego katalogu sklepu.

Nie dotyczy:

- `bookloft-asystent`,
- danych runtime Asystenta,
- ofert Andrzeja,
- API Jarka,
- Google Sheets pakowania,
- usług `bot-andrzej.service` i `bot-jarek.service`.

## ENV produkcyjny

Realne wartości sekretów są tylko na serwerze. Nie wolno wpisywać ich do repo, dokumentacji, logów ani frontendu.

Minimalny zestaw:

```bash
NODE_ENV=production
BASE_COM_TOKEN=...
BOOKLOFT_ADMIN_USER=...
BOOKLOFT_ADMIN_PASSWORD=...
BOOKLOFT_SESSION_SECRET=...
BOOKLOFT_HOST=127.0.0.1
BOOKLOFT_PORT=3205
BOOKLOFT_BASE_PATH=/
BOOKLOFT_COOKIE_SECURE=true
BOOKLOFT_DATA_DIR=/var/lib/bookloft-shop
BOOKLOFT_PUBLIC_ORIGIN=https://bookloft.pl
BASE_COM_PRICE_GROUP_NAME=Sklep
```

Opcjonalne identyfikatory Base:

```bash
BASE_COM_INVENTORY_ID=...
BASE_COM_PRICE_GROUP_ID=...
BASE_COM_WAREHOUSE_ID=...
```

## Deploy

```bash
cd /home/bookloftpl
git fetch
git switch ver-1.02
git pull --ff-only
npm ci --omit=dev
systemctl restart bookloft-shop.service
systemctl reload nginx.service
```

Reload Nginx jest potrzebny tylko po zmianie konfiguracji reverse proxy. Zwykłe zmiany UI/API wymagają restartu `bookloft-shop.service`.

## Nginx

Root domeny powinien być proxy do procesu Node:

```nginx
location / {
    proxy_pass http://127.0.0.1:3205;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Weryfikacja

```bash
systemctl is-active nginx.service
systemctl is-active bookloft-shop.service
curl -s http://127.0.0.1:3205/health
curl -I https://bookloft.pl/
curl -I https://www.bookloft.pl/
```

Oczekiwane publicznie, dopóki sklep jest za hasłem:

- `/` zwraca przekierowanie do `/login?next=...` albo ekran logowania,
- odpowiedź ma `X-Robots-Tag: noindex, nofollow, noarchive`,
- ekran logowania pokazuje komunikat `Strona w renowacji`,
- po zalogowaniu strona główna pokazuje nowości i katalog,
- `/sitemap.xml` pozostaje za logowaniem do czasu zdjęcia blokady indeksowania.

## Branch cleanup

Prawidłowe branche repo:

- `main`,
- `ver-1.00`,
- `ver-1.01`,
- `ver-1.02`.

Robocze branche z prefiksem `codex/` nie są linią wersji sklepu i po przeniesieniu zmian do `ver-1.02` powinny być usunięte lokalnie oraz z GitHuba.
