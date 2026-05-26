# BookLoft sklep

Wersja sklepu: `1.13.8`.
Branch tej wersji: `ver-1.13`.

Repo zawiera aplikacje katalogu BookLoft serwowana z root domeny `https://bookloft.pl/`. Katalog jest oparty bezposrednio o aktywne oferty Allegro konta BookLoft.

## Zakres

- katalog pod `/`,
- strony kategorii pod `/kategoria/:id/:slug`,
- panel administratora pod `/panel`,
- strony ofert pod `/product/:id/:slug`,
- API katalogu pod `/api`,
- publiczny katalog bez logowania oraz panel administratora chroniony logowaniem na podstawie zmiennych ENV,
- OAuth Allegro dla konta sprzedawcy,
- cache ofert, cen, zdjec, stanow i kategorii z Allegro,
- linki `Kup na Allegro` prowadzace bezposrednio do `https://allegro.pl/oferta/:id`,
- osobna strona `/o-nas` z opisem BookLoft,
- strona informacyjna `/informacje-prawne` z danymi firmy, prywatnoscia, cookies i wyjasnieniem modelu zakupu przez Allegro,
- Google Analytics z obecnego bookloft.pl, uruchamiany po zgodzie na cookies analityczne,
- lokalnie hostowane fonty w `public/assets/fonts`,
- server-rendered HTML dla strony glownej, kategorii i kart ofert,
- meta tagi, canonicale, Open Graph, Twitter Card, dane strukturalne Product/Offer/ItemList/WebSite/Organization, `robots.txt` i publiczna sitemap.

Katalog jest publiczny i gotowy do indeksowania. Logowanie dotyczy tylko `/panel` oraz endpointow `/api/admin/*`; panel i ekran logowania pozostaja `noindex`.

## Sekrety

W repo nie ma realnych tokenow, hasel ani kluczy. Wartosci musza byc podawane wylacznie przez ENV serwera albo lokalna powloke.

Wymagane:

```bash
ALLEGRO_CLIENT_ID=...
ALLEGRO_CLIENT_SECRET=...
ALLEGRO_REDIRECT_URI=https://bookloft.pl/api/allegro/oauth/callback
BOOKLOFT_ADMIN_USER=...
BOOKLOFT_ADMIN_PASSWORD=...
BOOKLOFT_SESSION_SECRET=...
BOOKLOFT_GA_ID=G-NQH5FFJ8Y4
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

## Polaczenie Allegro

Po deployu administrator wchodzi w `/panel`, klika `Polacz Allegro`, loguje konto BookLoft w Allegro i zatwierdza dostep aplikacji. Callback zapisuje token OAuth w `BOOKLOFT_DATA_DIR/allegro-auth.json`.

`Client ID`, `Client Secret`, `access_token` i `refresh_token` nigdy nie trafiaja do frontendu ani do repo.

## Cache

Cache jest trzymany w `BOOKLOFT_DATA_DIR`.

- `allegro-auth.json` - token OAuth i tymczasowe stany autoryzacji,
- `published-offers.json` - aktywne oferty dopuszczone do katalogu,
- `allegro-offers-cache.json` - ostatni snapshot ofert i kategorii z Allegro,
- `storefront-cache.json` - gotowe dane dla frontendu,
- `cache-meta.json` - status ostatnich aktualizacji i bledow.

Zasady:

- stany/ceny aktywnych ofert odswiezaja sie co 30 minut,
- katalog/kategorie odswiezaja sie co 3 godziny,
- automatyczny refresh nie dodaje nowych ofert do katalogu,
- oferta bez stanu `>= 1` albo nieaktywna znika z katalogu,
- nowa oferta aktywna na Allegro pojawia sie po akcji `Dodaj nowe` w panelu.

## Frontend

- strona glowna startuje od 50 najnowszych aktywnych ofert i automatycznie dociaga kolejne paczki po 50 podczas scrollowania,
- kategorie maja publiczne adresy `/kategoria/:id/:slug`, sa linkowane w HTML i trafiaja do sitemap,
- strony kategorii maja krotkie opisy tematyczne SEO oraz blok zaufania wyjasniajacy, ze katalog pokazuje realne egzemplarze i prowadzi do zakupu na Allegro,
- strona glowna jest katalogiem bez sekcji `O nas`; linki informacyjne sa dyskretne i prowadza do `/o-nas` oraz `/informacje-prawne`,
- gorny obszar strony glownej ma loftowy banner graficzny z logo i haslem `Przestrzen pelna ksiazek`; na waskich ekranach banner jest nizszy, szerszy i bardziej dopasowany do szerokosci ekranu,
- tlo strony i panele uzywaja subtelnej papierowej tekstury bez pionowych linii ani ciezkich dekoracji,
- lista ofert pokazuje dwie karty w rzedzie rowniez na bardzo waskich ekranach mobilnych,
- pelny katalog mozna przeszukiwac po tytule, SKU i kategorii,
- karty listingu pokazuja zdjecie, kategorie, tytul, cene i link `Zobacz`; okladki maja delikatne papierowe passe-partout i subtelny hover na desktopie,
- listing uzywa skalowanych wariantow obrazow Allegro (`s256`/`s400`/`s512`/`s720`) zamiast ciezkich oryginalow,
- katalog co pewien dystans scrollowania wplata niskie notki `Standard BookLoft` / `Drugi obieg`, ktore porzadkuja scroll bez robienia landing page'a,
- pole wyszukiwania uzywa tekstu pomocniczego `Sprawdz, czy mamy to, czego szukasz` bez osobnego widocznego naglowka `Szukaj`,
- pole wyszukiwania ma subtelny przycisk czyszczenia wpisanej frazy,
- pusty wynik wyszukiwania pokazuje dopracowany pusty stan z przyciskiem powrotu do wszystkich ofert,
- pierwsze ladowanie katalogu pokazuje lekkie skeletony kart,
- strona oferty pokazuje przycisk `Kup na Allegro`, informacje ze zakup, platnosc, dostawa, zwrot i reklamacja odbywaja sie w Allegro, pasek zalet BookLoft, galerie ze strzalkami bez tla i przewijaniem swipem, lekki podglad zdjec z przewijaniem swipem, zoomem kolkiem myszy, plynniejszym pinch-to-zoom na mobile i przesuwaniem po powiekszeniu oraz stopke `O nas`,
- strona oferty pokazuje najwazniejsze parametry z Allegro, jesli sa dostepne w cache, np. autora, wydawnictwo, rok wydania, serie, ISBN/EAN, oprawe, liczbe stron i jezyk,
- strona oferty nie pokazuje liczby dostepnych egzemplarzy, bo katalog zaklada pojedyncze egzemplarze ksiazek uzywanych,
- favicon i ikona Apple Touch korzystaja z monogramu `B` z transparentnymi rogami,
- opisy szczegolowe sa dociagane z Allegro na stronie oferty, jesli nie ma ich jeszcze w cache,
- uklad kategorii i filtrowania zostaje zgodny z poprzednia wersja sklepu,
- sekcja prawno-informacyjna wyjasnia, ze BookLoft.pl jest katalogiem, a zamowienie, platnosc, dostawa, zwrot i reklamacja odbywaja sie w Allegro.

## SEO

- `/`, `/kategoria/:id/:slug` i `/product/:id/:slug` sa renderowane po stronie serwera, z realnymi linkami do ofert bez wymagania JavaScriptu.
- SSR listingu pozostaje ograniczony do pierwszych 50 produktow, a reszta katalogu dociaga sie podczas scrollowania; to utrzymuje lekki HTML bez utraty publicznych adresow kategorii i produktow.
- Stare lub bledne slugi produktu i kategorii przekierowuja 301 na adres kanoniczny.
- Niedostepne historyczne oferty zwracaja `410 Gone`, a nieznane identyfikatory `404 Not Found`; obie odpowiedzi sa `noindex`.
- Nieznane publiczne sciezki HTML zwracaja `404` z `noindex`, zamiast przekierowywac crawlera na strone glowna.
- `/sitemap.xml` zawiera strone glowna, strony informacyjne, publiczne kategorie i aktywne produkty.
- Dane strukturalne obejmuja `Organization`, `WebSite`, `ItemList`, `Product`, `Offer`, `PropertyValue` dla parametrow produktu oraz `BreadcrumbList` dla kategorii i kart ofert.
- Publiczne API listingu zwraca tylko pierwsze zdjecie produktu, zeby ograniczyc wage `/api/storefront`; pelna galeria zostaje na `/api/products/:id`.
- Miniatury i karty uzywaja mniejszych wariantow obrazow Allegro, a pelny podglad zdjecia nadal korzysta z pelnego adresu obrazu.

## Informacje prawne i analityka

- Dane firmy na stronie: `BookLoft Mateusz Kaczmarek`, 334c, 33-152 Pogorska Wola, NIP `9930688202`, REGON `522042224`, `bookloft.store@gmail.com`, `518 104 941`.
- `/informacje-prawne` nie jest pelnym regulaminem samodzielnego sklepu, bo aplikacja nie ma koszyka ani platnosci.
- Google Analytics używa `BOOKLOFT_GA_ID`; domyślnie jest to identyfikator z dotychczasowego landingu.
- Skrypt `public/assets/js/analytics.js` startuje GA dopiero po akceptacji cookies analitycznych, obsługuje cofnięcie zgody z poziomu `/informacje-prawne`, czyści cookies GA i wysyła event kliknięcia w ofertę Allegro tylko po zgodzie.

## Uruchomienie lokalne

```powershell
cd C:\Users\Wlasciciel\OneDrive\Pulpit\CODEX\bookloftpl-home-visual
$env:ALLEGRO_CLIENT_ID="..."
$env:ALLEGRO_CLIENT_SECRET="..."
$env:ALLEGRO_REDIRECT_URI="http://127.0.0.1:3225/api/allegro/oauth/callback"
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
3. na Hetznerze: `cd /home/bookloftpl && git fetch && git switch ver-1.13 && git pull --ff-only`,
4. uzupelnienie ENV Allegro w `/etc/bookloft-shop/bookloft-shop.env`,
5. `npm ci --omit=dev`,
6. restart uslugi sklepu,
7. smoke test domeny i lokalnego healthchecka,
8. wejscie w `/panel` i `Polacz Allegro`, jesli token OAuth nie istnieje.

Szczegoly operacyjne sa w `docs/OPERATIONS.md`.
