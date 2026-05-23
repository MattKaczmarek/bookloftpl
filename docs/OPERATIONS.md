# Operacje BookLoft sklep

Stan dokumentu: `2026-05-22`.
Wersja sklepu: `1.09.0`.
Branch wersji: `ver-1.09`.
Repo na Hetznerze: `/home/bookloftpl`.
Usluga aplikacji: `bookloft-shop.service`.

## Granice projektu

`bookloftpl` jest aplikacja katalogu BookLoft serwowana z root domeny `bookloft.pl`. Dane katalogu pochodza bezposrednio z Allegro REST API.

Nie dotyczy:

- `bookloft-asystent`,
- danych runtime Asystenta,
- ofert Andrzeja,
- API Jarka,
- Google Sheets pakowania,
- uslug `bot-andrzej.service` i `bot-jarek.service`.

## ENV produkcyjny

Realne wartosci sekretow sa tylko na serwerze. Nie wolno wpisywac ich do repo, dokumentacji, logow ani frontendu.

Minimalny zestaw:

```bash
NODE_ENV=production
ALLEGRO_CLIENT_ID=...
ALLEGRO_CLIENT_SECRET=...
ALLEGRO_REDIRECT_URI=https://bookloft.pl/api/allegro/oauth/callback
BOOKLOFT_ADMIN_USER=...
BOOKLOFT_ADMIN_PASSWORD=...
BOOKLOFT_SESSION_SECRET=...
BOOKLOFT_HOST=127.0.0.1
BOOKLOFT_PORT=3205
BOOKLOFT_BASE_PATH=/
BOOKLOFT_COOKIE_SECURE=true
BOOKLOFT_DATA_DIR=/var/lib/bookloft-shop
BOOKLOFT_PUBLIC_ORIGIN=https://bookloft.pl
BOOKLOFT_GA_ID=G-NQH5FFJ8Y4
ALLEGRO_MARKETPLACE_ID=allegro-pl
ALLEGRO_SELLING_FORMATS=BUY_NOW
```

Opcjonalne:

```bash
BOOKLOFT_STOCK_REFRESH_MS=1800000
BOOKLOFT_CATALOG_REFRESH_MS=10800000
ALLEGRO_REQUEST_TIMEOUT_MS=30000
ALLEGRO_SCOPE=allegro:api:sale:offers:read
```

## OAuth Allegro

1. Administrator wchodzi na `https://bookloft.pl/panel`.
2. Klika `Polacz Allegro`.
3. Allegro odsyla przegladarke na `https://bookloft.pl/api/allegro/oauth/callback`.
4. Backend wymienia kod OAuth na tokeny i zapisuje je w `BOOKLOFT_DATA_DIR/allegro-auth.json`.

Jesli token wygasnie albo zostanie cofniety, w panelu pojawi sie blad i trzeba ponownie kliknac `Polacz Allegro`.

## Informacje prawne i cookies

- `/informacje-prawne` jest strona informacyjna dla katalogu prowadzacego do Allegro.
- `/o-nas` jest osobna strona o BookLoft; strona glowna pozostaje samym katalogiem bez sekcji `O nas`.
- Dane firmy: BookLoft Mateusz Kaczmarek, 334c, 33-152 Pogorska Wola, NIP 9930688202, REGON 522042224, bookloft.store@gmail.com, 518 104 941.
- BookLoft.pl nie ma koszyka ani platnosci; zakup, dostawa, zwroty i reklamacje odbywaja sie w Allegro.
- Google Analytics jest osadzony przez `public/assets/js/analytics.js` i włącza się dopiero po zgodzie na cookies analityczne; cofnięcie zgody jest dostępne na `/informacje-prawne`, wysyła `analytics_storage=denied` i usuwa cookies GA.
- Identyfikator GA jest domyslnie taki jak na dotychczasowym landingu (`G-NQH5FFJ8Y4`), ale moze byc nadpisany przez `BOOKLOFT_GA_ID`.

## Deploy

```bash
cd /home/bookloftpl
git fetch
git switch ver-1.09
git pull --ff-only
npm ci --omit=dev
systemctl restart bookloft-shop.service
```

Reload Nginx jest potrzebny tylko po zmianie konfiguracji reverse proxy. Zwykle zmiany UI/API wymagaja restartu `bookloft-shop.service`.

## Nginx

Root domeny powinien byc proxy do procesu Node:

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

Oczekiwane publicznie, dopoki katalog jest za haslem:

- `/` zwraca przekierowanie do `/login?next=...` albo ekran logowania,
- odpowiedz ma `X-Robots-Tag: noindex, nofollow, noarchive`,
- ekran logowania pokazuje komunikat `Strona w renowacji`,
- po zalogowaniu strona glowna pokazuje nowosci i katalog, a kolejne oferty dociagaja sie automatycznie podczas scrollowania,
- gorny banner strony glownej uzywa statycznego assetu `public/assets/img/loft-hero.jpg`; na waskich ekranach ma zwezony layout i mniejsze logo,
- pole wyszukiwania pokazuje tekst pomocniczy w samym polu zamiast widocznego naglowka `Szukaj`,
- strona produktu ma galerie z subtelnymi strzalkami bez tla, lekki podglad zdjec po kliknieciu, zoom kolkiem myszy oraz obsluge `ArrowLeft`, `ArrowRight` i `Escape` w otwartym podgladzie,
- strona glowna linkuje subtelnie do `/o-nas` oraz `/informacje-prawne`, ale nie wyswietla sekcji `O nas`,
- strona produktu wyswietla stopke `O nas` pod sekcja powiazanych ofert,
- `/panel` pokazuje status polaczenia Allegro,
- `/sitemap.xml` pozostaje za logowaniem do czasu zdjecia blokady indeksowania.

## Branch cleanup

Prawidlowe branche repo:

- `main`,
- `ver-1.00`,
- `ver-1.01`,
- `ver-1.02`,
- `ver-1.03`,
- `ver-1.04`,
- `ver-1.05`,
- `ver-1.06`,
- `ver-1.07`,
- `ver-1.08`,
- `ver-1.09`.

Robocze branche z prefiksem `codex/` nie sa linia wersji sklepu i po przeniesieniu zmian do aktualnego brancha `ver-*` powinny byc usuniete lokalnie oraz z GitHuba.
