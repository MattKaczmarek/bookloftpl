# Operacje BookLoft sklep

Stan dokumentu: `2026-07-16`.
Wersja produkcyjna: `1.15.1`.
Branch wersji: `ver-1.15`.
Stan produkcji: `1.15.1` na `ver-1.15`.
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

## Hardening

- publiczne `/health` powinno pokazywac tylko minimalny status i wersje; szczegolowy status cache sprawdzaj lokalnie przez `curl http://127.0.0.1:3205/health`,
- odpowiedzi HTTP maja naglowki CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` i `Permissions-Policy`,
- endpoint `POST /login` ogranicza nieudane proby logowania per IP; po przekroczeniu limitu zwraca `429` i naglowek `Retry-After`.

## OAuth Allegro

1. Administrator wchodzi na `https://bookloft.pl/panel`.
2. Klika `Polacz Allegro`.
3. Allegro odsyla przegladarke na `https://bookloft.pl/api/allegro/oauth/callback`.
4. Backend wymienia kod OAuth na tokeny i zapisuje je w `BOOKLOFT_DATA_DIR/allegro-auth.json`.

Jesli token wygasnie albo zostanie cofniety, w panelu pojawi sie blad i trzeba ponownie kliknac `Polacz Allegro`.

## Informacje prawne i cookies

- `/informacje-prawne` jest strona informacyjna dla katalogu prowadzacego do Allegro.
- `/o-nas` jest osobna strona o BookLoft; strona glowna pozostaje samym katalogiem bez sekcji `O nas`.
- Dane firmy: BookLoft Mateusz Kaczmarek, Pogórska Wola 334c, 33-152 Pogórska Wola, NIP 9930688202, REGON 522042224, bookloft.store@gmail.com, 518 104 941.
- BookLoft.pl nie ma koszyka ani platnosci; zakup, dostawa, zwroty i reklamacje odbywaja sie w Allegro.
- Google Analytics jest osadzony przez `public/assets/js/analytics.js` i włącza się dopiero po zgodzie na cookies analityczne; cofnięcie zgody jest dostępne na `/informacje-prawne`, wysyła `analytics_storage=denied` i usuwa cookies GA.
- Identyfikator GA jest domyslnie taki jak na dotychczasowym landingu (`G-NQH5FFJ8Y4`), ale moze byc nadpisany przez `BOOKLOFT_GA_ID`.

## SEO i rendering publiczny

- SSR listingu zostaje ograniczony do 50 produktow na strone; kolejne produkty laduja sie po scrollowaniu po stronie klienta.
- Katalog ma techniczna, indeksowalna paginacje HTML pod `/strona/:page`, a kategorie pod `/kategoria/:id/:slug/strona/:page`, z publicznymi canonicalami, linkami `prev`/`next`, wpisami w sitemap i realnymi linkami do ofert bez JavaScriptu. Paginacja jest ukryta w UI; dla uzytkownikow glowne przegladanie nadal dziala przez infinite scroll.
- Kontener technicznej paginacji ma `data-nosnippet`; linki pozostaja w SSR, ale ich numery i etykiety nie powinny byc uzywane przez Google jako snippet wyniku.
- Listing i kategorie maja tylko `ItemList`/`BreadcrumbList`; karty ofert nie maja microdata `Product`/`Offer`, zeby Search Console nie traktowal miniaturek jako niepelnych produktow.
- Strony produktow maja JSON-LD `Product`/`Offer`, `BreadcrumbList`, sprzedawce `OnlineStore` oraz `PropertyValue` i ISBN/EAN/GTIN budowane z parametrow Allegro, jesli sa dostepne w cache. Hydratacja laczy parametry ofertowe z `parameters` i produktowe z `productSet[].product.parameters`; `brand` preferuje rzeczywiste wydawnictwo, producenta albo marke, a przy braku znanej wartosci zachowuje fallback `BookLoft`.
- Meta description produktu jest skladane kontrolowanie z nazwy, kategorii, stanu i informacji o zakupie przez Allegro, bez wklejania surowego opisu z Allegro.
- Wersje `1.15.0` i `1.15.1` nie zmieniaja generatora tytulu ani meta description aktywnej oferty.
- Sitemap nie uzywa globalnego czasu przebudowy cache jako `lastmod`. Data jest opcjonalna i wyliczana osobno dla produktu na podstawie znanej istotnej zmiany, hydratacji szczegolow albo daty dodania.
- Blok informacyjny pod katalogiem przypomina, ze BookLoft.pl jest katalogiem ofert, a finalizacja zakupu odbywa sie na Allegro.

## Niedostepne oferty

- Aktywna oferta, ktora znika z Allegro, nadal otrzymuje `410 Gone` i `noindex`; nie jest przekierowywana na strone glowna.
- `published-offers.json` ma schemat `version: 3` i pole `removedOfferSnapshots`. Snapshot zawiera tylko identyfikator, nazwe, slug, pierwsze zdjecie, kategorie, `removedAt` i znany `sourceUpdatedAt`.
- Stare pliki `version: 2` sa uzupelniane przy pierwszym zapisie bez osobnego skryptu migracyjnego. Nieznane pola sa tolerowane przez wersje `1.14`, wiec format pozostaje zgodny z rollbackiem.
- Strona `410` pokazuje zapisany egzemplarz, wyszukiwarke i maksymalnie osiem aktywnych alternatyw. Pole formularza zawiera pierwsze dwa slowa oczyszczonego tytulu albo sluga URL; ranking alternatyw nadal korzysta z pelnej nazwy snapshotu.
- Ponowne dodanie identycznego ID oferty usuwa wpis z `removedByUnavailable` i `removedOfferSnapshots`.

## Deploy

```bash
cd /home/bookloftpl
git fetch
git switch ver-1.15
git pull --ff-only
npm ci --omit=dev
systemctl restart bookloft-shop.service
```

Reload Nginx jest potrzebny tylko po zmianie konfiguracji reverse proxy. Zwykle zmiany UI/API wymagaja restartu `bookloft-shop.service`.

## Pelne odswiezenie cache ofert

Po deployu wersji zmieniajacej schemat szczegolow ofert uruchom synchronizacje przez dzialajacy proces aplikacji:

```bash
systemd-run --quiet --wait --pipe --collect \
  -p User=bookloft \
  -p Group=bookloft \
  -p WorkingDirectory=/home/bookloftpl \
  -p EnvironmentFile=/etc/bookloft-shop/bookloft-shop.env \
  /usr/bin/node /home/bookloftpl/scripts/refresh-production-cache.js
```

Skrypt najpierw synchronizuje liste aktywnych ofert, a potem wzbogaca brakujace szczegoly paczkami po 5. Operacja odbywa sie wewnatrz kolejki procesu aplikacji, nie kasuje starego cache i zapisuje nowy katalog atomowo dopiero po przejsciu kontroli integralnosci. Blad pojedynczej oferty zachowuje jej poprzednie dane i jest automatycznie ponawiany jeden raz.

Zabezpieczenie dostepnosci przerywa zwykly refresh, gdy Allegro zwroci mniej niz 75% poprzedniej liczby aktywnych ofert przy katalogu majacym co najmniej 20 pozycji. Taki blad trzeba wyjasnic; nie obchodzic progu przez reczne kasowanie `published-offers.json`.

Postep pelnego wzbogacenia jest zapisywany co 100 ofert w `journalctl -u bookloft-shop.service`. Szczegolowy lokalny status `/health` i chroniony `/api/status` zawieraja ostatni wynik wzbogacenia.

## Nginx

Root domeny powinien byc proxy do procesu Node:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name www.bookloft.pl;
    return 301 https://bookloft.pl$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name bookloft.pl;

location / {
    proxy_pass http://127.0.0.1:3205;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
}
```

W `nginx.conf` powinien byc wlaczony gzip dla tekstowych assetow i JSON:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss image/svg+xml;
```

## Weryfikacja

```bash
systemctl is-active nginx.service
systemctl is-active bookloft-shop.service
curl -s http://127.0.0.1:3205/health
curl -I https://bookloft.pl/
curl -I https://www.bookloft.pl/
```

Oczekiwane publicznie:

- `/` zwraca katalog bez logowania i nie wysyla `X-Robots-Tag: noindex`,
- `/panel` przekierowuje niezalogowanego uzytkownika do `/login?next=/panel`,
- `/login` i `/panel` pozostaja `noindex, nofollow, noarchive`,
- publiczne API katalogu `/api/storefront`, `/api/newest` i `/api/products/:id` dziala bez sesji,
- dynamiczne publiczne API katalogu wysyla `Cache-Control: no-cache`, zeby przegladarka rewalidowala listing po dodaniu ofert bez `Ctrl+F5`,
- `/api/status` i `/api/admin/*` wymagaja sesji administratora,
- strona glowna pokazuje nowosci i katalog, a kolejne oferty dociagaja sie automatycznie podczas scrollowania,
- strona glowna, kategorie i produkty maja server-rendered HTML z realnymi linkami widocznymi bez JavaScriptu,
- `robots.txt` dopuszcza katalog, blokuje panel/login/admin API i wskazuje publiczny `/sitemap.xml`,
- `/sitemap.xml` jest publiczne i zawiera strone glowna, strony informacyjne, kategorie, strony paginacji oraz produkty,
- niedostepna historyczna oferta zwraca `410 Gone`, a nieznany produkt `404 Not Found`,
- strona `410` zajmuje pelna dostepna szerokosc, nie ucina logo i pokazuje aktywne alternatywy na PC oraz mobile,
- aktywna strona katalogu nie zawiera w SSR tekstu `Nie znalezlismy pasujacych ofert`; tekst pojawia sie dopiero przy pustym wyniku,
- wpis produktu w sitemap ma jego wlasny `lastmod`, jesli data jest znana; strony agregujace nie dostaja daty kazdego technicznego odswiezenia cache,
- nieznane publiczne sciezki HTML zwracaja `404` z `noindex` zamiast przekierowania na strone glowna,
- fonty sa serwowane lokalnie z `public/assets/fonts` przez `public/assets/css/fonts.css`,
- gorny banner strony glownej uzywa statycznego assetu `public/assets/img/loft-hero.jpg`; na waskich ekranach ma szerszy i nizszy layout z logo dopasowanym do mobilnego kadru,
- tlo strony ma subtelna papierowa teksture bez pionowych linii; karty i panele maja lekka fakture oraz oprawe okladek,
- lista ofert na mobile zachowuje dwie karty w rzedzie rowniez na ekranach okolo 320 px szerokosci,
- listing domyslnie pokazuje najnowsze oferty i ma klientowe oraz serwerowe sortowanie po cenie i tytule; parametr URL `sort` dziala na stronie glownej, w kategoriach i w wynikach wyszukiwania, ale warianty sortowania sa `noindex,follow` i nie trafiaja do sitemap,
- miniatury listingu i powiazanych ofert powinny uzywac wariantow Allegro `s256`/`s400`/`s512`/`s720`, a nie `/original/`,
- katalog moze wyswietlac pelnoszerokie rotujace notki bez naglowka miedzy ofertami, z losowym startem rotacji, mniej wiecej co 36 produktow na desktopie i co 18 produktow na mobile,
- pole wyszukiwania pokazuje tekst pomocniczy `Sprawdz, czy mamy to, czego szukasz` w samym polu zamiast widocznego naglowka `Szukaj`,
- wyniki wyszukiwania maja jeden widoczny naglowek `Oferty dla: <fraza>` bez powtarzania slow `Wyszukiwanie` i `Wyniki`,
- pole wyszukiwania ma przycisk czyszczenia, pusty wynik nie ma dekoracyjnego monogramu i pozwala wrocic do wszystkich ofert, a pierwszy render pokazuje skeletony kart,
- formularz na stronie `410` uzupelnia sie maksymalnie dwoma pierwszymi slowami tytulu na desktopie i mobile,
- strona produktu ma galerie z subtelnymi strzalkami bez tla, przewijanie zdjec swipem, lekki podglad zdjec po kliknieciu, swipe w podgladzie, zoom kolkiem myszy, plynniejszy pinch-to-zoom na mobile zakotwiczony miedzy palcami, przesuwanie zdjecia po powiekszeniu oraz obsluge `ArrowLeft`, `ArrowRight` i `Escape` w otwartym podgladzie,
- strona produktu przy przycisku `Kup na Allegro` informuje, ze zakup, platnosc, dostawa, zwrot i reklamacja odbywaja sie w Allegro,
- strona produktu nie pokazuje widocznego stanu magazynowego przy cenie; informacja o dostepnosci zostaje tylko w danych strukturalnych,
- strona glowna linkuje subtelnie do `/o-nas` oraz `/informacje-prawne`, ale nie wyswietla sekcji `O nas`,
- strona produktu wyswietla stopke `O nas` pod sekcja powiazanych ofert,
- `/panel` pokazuje status polaczenia Allegro.

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
- `ver-1.09`,
- `ver-1.11`,
- `ver-1.12`,
- `ver-1.13`,
- `ver-1.14`,
- `ver-1.15` (produkcja).

Robocze branche z prefiksem `codex/` nie sa linia wersji sklepu i po przeniesieniu zmian do aktualnego brancha `ver-*` powinny byc usuniete lokalnie oraz z GitHuba.
