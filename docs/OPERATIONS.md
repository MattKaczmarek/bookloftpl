# Operacje BookLoft sklep

Stan dokumentu: `2026-07-21`.
Wersja produkcyjna: `1.18.0`.
Branch produkcyjny: `ver-1.18`.
Stan produkcji: `1.18.0` na `ver-1.18`; commit kodu wydania `8be1f13`, tag `bookloftpl-v1.18.0`.
Repo na Hetznerze: `/home/bookloftpl`.
Usluga aplikacji: `bookloft-shop.service`.

## Wersja produkcyjna 1.18.0

- Wdrozona `2026-07-21` na branchu `ver-1.18`, commit kodu `8be1f13`, tag `bookloftpl-v1.18.0`.
- Usuwa blokujacy ekran startowy i jego timery oraz zapis w `sessionStorage`.
- Wlasciwa tresc katalogu i produktu pojawia sie od razu z krotkim, kaskadowym wejsciem CSS. Ustawienie `prefers-reduced-motion` wylacza ruch.
- Mobile ma serwerowo renderowany, przewijany pasek popularnych kategorii. Zmiana kategorii po stronie klienta synchronizuje aktywny link i `aria-current`.
- Dluzsze zapytania wyszukiwania maja spokojniejsza skale naglowka bez zmiany jego tekstu.
- Przycisk czyszczenia wyszukiwania, linki popularnych kategorii, strzalki galerii i przyciski cookies maja co najmniej `44 px` pola dotykowego. Strzalki galerii sa SVG.
- Nie zmieniono nazw ofert, `title`, meta title, meta description, canonicali, schema, sitemap, URL-i, cache, ENV ani integracji Allegro.
- Testy produkcyjne przeszly `22/22`. Health potwierdzil wersje `1.18.0`, aktywne Allegro, 1985 ofert, brak ostatniego bledu i `NRestarts=0`.
- Live-check przy `320`, `390` i `1440 px` potwierdzil brak overflow, bledow JavaScript i nieudanych requestow oraz poprawne dzialanie galerii, lightboxa, wyszukiwania, kategorii i ograniczonego ruchu.
- Pelny zakres, weryfikacja i rollback sa w `docs/RELEASE_1.18.0.md`.

## Wersja produkcyjna 1.17.3

- Wdrozona produkcyjnie `2026-07-18` na branchu `ver-1.17`, commit kodu `ffa4f6d`.
- Pierwszy listing i karta produktu wykorzystuja gotowy SSR bez natychmiastowego pobierania pelnego katalogu przez JavaScript.
- Pelny katalog jest pobierany dopiero przy wyszukiwaniu, sortowaniu, zmianie filtra albo infinite scrollu.
- Mobile produktu ma ruchomy pasek atutow i przyklejony pasek z nazwa, cena oraz przejsciem do zakupu na Allegro.
- Nieznane sciezki maja brandowany, wyszukiwalny ekran `404` z `noindex`; status HTTP pozostaje `404`.
- Refresh dostepnosci naprawia rozjazd, w ktorym oferta byla jeszcze widoczna w storefront, ale zniknela z listy aktywnych ID; taka wycofana oferta zachowuje snapshot i otrzymuje `410`.
- Ksiazkowe ISBN sa walidowane i publikowane jako ISBN-13 na typie `Product`/`Book`; filmy i pozostale produkty korzystaja z walidowanego EAN/GTIN bez pola ISBN.
- Wspolna `MerchantReturnPolicy` oraz kazdy `Offer` prowadza do zasad zwrotu obslugiwanych przez Allegro, bez deklarowania stalych warunkow BookLoft.
- Techniczne strony 2+ katalogu i kategorii pozostaja dostepne dla crawlerow, ale maja `noindex,follow` i nie sa juz wpisywane do sitemap.
- Nie ma migracji ENV, Nginx ani formatu cache. Deploy nie wymagal pelnego odswiezenia cache.
- Produkcyjny smoke test potwierdzil health `1.17.3`, aktywne polaczenie Allegro bez bledu, 2027 widocznych ofert, status 200 i prawidlowy `noindex,follow` na stronach 2, 3, 40 oraz paginacji kategorii Fantasy.
- Sitemap zawiera 2027 produktow oraz zero adresow paginacji katalogu i kategorii. Zostala ponownie zgloszona w Search Console ze stanem oczekujacym, 0 bledow i 0 ostrzezen.
- Usluga pozostala aktywna bez ostrzezen, bledow i automatycznych restartow.
- Live-check JSON-LD potwierdzil ksiazke z `Product`/`Book` i ISBN-13, film Shrek z `Product` i `gtin13`, canonicale oraz odwolanie zakupu i zwrotow do Allegro.
- Szczegolowy zakres, weryfikacja i rollback sa w dokumentach `docs/RELEASE_1.17.*.md`.

## Patch 1.16.1

- Wdrozony produkcyjnie `2026-07-17` na branchu `ver-1.16`.
- Usuwa powtorzenie nazwy kategorii z tekstu pod duzym naglowkiem, np. `Fantasy: 565 ofert...` zmienia na `565 ofert...`.
- Zmiana jest zgodna w SSR oraz po klientowej zmianie kategorii bez przeladowania.
- Nie zmienia meta title, meta description, URL-i, canonicali, danych ofert, cache ani integracji Allegro.
- Zakres, testy i rollback opisuje `docs/RELEASE_1.16.1.md`.

## Wersja produkcyjna 1.16.0

- Branch `ver-1.16` jest aktywnym branchem produkcyjnym od `2026-07-17`.
- Wersja nie wymaga migracji danych, zmiany ENV, odswiezenia cache ofert ani modyfikacji Nginx.
- Zmienia ranking podobnych ofert, linkowanie kategorii, zasady `lastmod` oraz statyczne zasoby bannera.
- Deploy zachowal dotychczasowy cache 2013 aktywnych ofert; pelne odswiezenie nie bylo potrzebne.
- Pelny zakres, przeplyw funkcji, testy produkcyjne i rollback opisuje `docs/RELEASE_1.16.0.md`.

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
- Katalog ma techniczna paginacje HTML pod `/strona/:page`, a kategorie pod `/kategoria/:id/:slug/strona/:page`, z publicznymi canonicalami, linkami do sasiednich stron i realnymi linkami do ofert bez JavaScriptu. Strony 2+ sa `noindex,follow` i nie trafiaja do sitemap, ale pozostaja crawlable jako zaplecze infinite scrolla. Paginacja jest ukryta w UI.
- Kontener technicznej paginacji ma `data-nosnippet`; linki pozostaja w SSR, ale ich numery i etykiety nie powinny byc uzywane przez Google jako snippet wyniku.
- Listing i kategorie maja tylko `ItemList`/`BreadcrumbList`; karty ofert nie maja microdata `Product`/`Offer`, zeby Search Console nie traktowal miniaturek jako niepelnych produktow.
- Strony produktow maja JSON-LD `Product`/`Offer`, `BreadcrumbList`, sprzedawce `OnlineStore` oraz `PropertyValue`. ISBN jest walidowany, konwertowany do ISBN-13 i publikowany na laczonym typie `Product`/`Book`; EAN/GTIN innych produktow jest publikowany tylko z poprawna dlugoscia i suma kontrolna. `OnlineStore` publikuje wspolna `MerchantReturnPolicy` z linkiem do Pomocy Allegro, a kazdy `Offer` wskazuje ja przez `@id`. Hydratacja laczy parametry ofertowe z `parameters` i produktowe z `productSet[].product.parameters`; `brand` preferuje rzeczywiste wydawnictwo, producenta albo marke, a przy braku znanej wartosci zachowuje fallback `BookLoft`.
- Meta description produktu jest skladane kontrolowanie z nazwy, kategorii, stanu i informacji o zakupie przez Allegro, bez wklejania surowego opisu z Allegro.
- Wersje `1.15.0`-`1.15.3` nie zmieniaja generatora tytulu ani meta description aktywnej oferty.
- Sitemap nie uzywa globalnego czasu przebudowy cache jako `lastmod`. Od wersji `1.16.0` data jest opcjonalna i wyliczana osobno na podstawie `contentUpdatedAt`, `sourceUpdatedAt`, `addedAt` i `sourceAddedAt`; samo techniczne pobranie opisu zapisane w `descriptionFetchedAt` nie zmienia `lastmod`.
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
git switch ver-1.17
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
- `/sitemap.xml` jest publiczne i zawiera strone glowna, strony informacyjne, pierwsze strony kategorii oraz produkty; techniczna paginacja jest wykluczona,
- niedostepna historyczna oferta zwraca `410 Gone`, a nieznany produkt `404 Not Found`,
- strona `410` zajmuje pelna dostepna szerokosc, nie ucina logo i pokazuje aktywne alternatywy na PC oraz mobile,
- aktywna strona katalogu nie zawiera w SSR tekstu `Nie znalezlismy pasujacych ofert`; tekst pojawia sie dopiero przy pustym wyniku,
- wpis produktu w sitemap ma jego wlasny `lastmod`, jesli data jest znana; strony agregujace nie dostaja daty kazdego technicznego odswiezenia cache,
- nieznane publiczne sciezki HTML zwracaja `404` z `noindex` zamiast przekierowania na strone glowna,
- fonty sa serwowane lokalnie z `public/assets/fonts` przez `public/assets/css/fonts.css`,
- gorny banner strony glownej uzywa `loft-hero.webp` na desktopie i `loft-hero-mobile.webp` na telefonie, z `loft-hero.jpg` jako fallbackiem; na waskich ekranach ma szerszy i nizszy layout z logo dopasowanym do mobilnego kadru,
- tlo strony ma subtelna papierowa teksture bez pionowych linii; karty i panele maja lekka fakture oraz oprawe okladek,
- lista ofert na mobile zachowuje dwie karty w rzedzie rowniez na ekranach okolo 320 px szerokosci,
- listing domyslnie pokazuje najnowsze oferty i ma klientowe oraz serwerowe sortowanie po cenie i tytule; parametr URL `sort` dziala na stronie glownej, w kategoriach i w wynikach wyszukiwania, ale warianty sortowania sa `noindex,follow` i nie trafiaja do sitemap,
- miniatury listingu i powiazanych ofert powinny uzywac wariantow Allegro `s256`/`s400`/`s512`/`s720`, a nie `/original/`,
- katalog moze wyswietlac pelnoszerokie rotujace notki bez naglowka miedzy ofertami, z losowym startem rotacji, mniej wiecej co 36 produktow na desktopie i co 18 produktow na mobile,
- pole wyszukiwania pokazuje tekst pomocniczy `Sprawdz, czy mamy to, czego szukasz` w samym polu zamiast widocznego naglowka `Szukaj`,
- wyniki wyszukiwania maja mala etykiete `Wyszukiwanie` i jeden widoczny naglowek `Oferty dla „<fraza>”`, bez dodatkowego naglowka listy,
- dopasowanie wyszukiwania normalizuje polskie znaki i interpunkcje, nie wymaga tej samej kolejnosci slow oraz dopuszcza jedna zmiane, wstawienie, usuniecie albo zamiane sasiednich znakow dla tokenow od czterech znakow; dopasowanie dokladne ma wyzszy wynik,
- pole wyszukiwania ma przycisk czyszczenia, pusty wynik zachowuje kremowe tlo strony, nie ma zielonego gradientu ani dekoracyjnego monogramu i pozwala wrocic do wszystkich ofert, a pierwszy render pokazuje skeletony kart,
- przy pustym wyniku oba selektory sortowania sa ukryte, a osobna nieobramowana sekcja `Najnowsze oferty` pokazuje maksymalnie cztery aktualne pozycje; przy aktywnej kategorii propozycje pozostaja w tej kategorii,
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
