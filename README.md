# BookLoft sklep

Wersja w tej galezi: `1.19.1` na branchu `ver-1.19`.
Ostatni deploy produkcyjny do czasu wdrozenia `1.19.1`: `1.19.0`
(`2026-07-24`, commit `3822480`, tag `bookloftpl-v1.19.0`).

- Automatyczne dodawanie ofert: `docs/RELEASE_1.19.0.md`
- Off-root systemd / hardening uslugi: `docs/RELEASE_1.19.1.md`

Repo zawiera aplikacje katalogu BookLoft serwowana z root domeny `https://bookloft.pl/`. Katalog jest oparty bezposrednio o aktywne oferty Allegro konta BookLoft.

## Zakres

- katalog pod `/`,
- strony kategorii pod `/kategoria/:id/:slug`,
- panel administratora pod `/panel`,
- strony ofert pod `/product/:id/:slug`,
- API katalogu pod `/api`,
- publiczny katalog bez logowania oraz panel administratora chroniony logowaniem na podstawie zmiennych ENV,
- OAuth Allegro dla konta sprzedawcy,
- automatyczne dodawanie nowych aktywnych ofert codziennie o `22:00`
  `Europe/Warsaw`, z zachowaniem recznej akcji w panelu,
- cache ofert, cen, zdjec, stanow i kategorii z Allegro,
- linki `Kup na Allegro` prowadzace bezposrednio do `https://allegro.pl/oferta/:id`,
- osobna strona `/o-nas` z opisem BookLoft,
- strona informacyjna `/informacje-prawne` z danymi firmy, prywatnoscia, cookies i wyjasnieniem modelu zakupu przez Allegro,
- Google Analytics z obecnego bookloft.pl, uruchamiany po zgodzie na cookies analityczne,
- lokalnie hostowane fonty w `public/assets/fonts`,
- server-rendered HTML dla strony glownej, kategorii i kart ofert,
- meta tagi, canonicale, Open Graph, Twitter Card, dane strukturalne `ItemList`/`WebSite`/`OnlineStore` oraz produktowe `Product`/`Offer` tylko na kartach ofert, `robots.txt` i publiczna sitemap.

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
BOOKLOFT_DAILY_ADD_NEW_ENABLED=true
BOOKLOFT_DAILY_ADD_NEW_HOUR=22
BOOKLOFT_DAILY_ADD_NEW_MINUTE=0
BOOKLOFT_DAILY_ADD_NEW_TIME_ZONE=Europe/Warsaw
ALLEGRO_REQUEST_TIMEOUT_MS=30000
ALLEGRO_SCOPE=allegro:api:sale:offers:read
```

## Bezpieczenstwo

- aplikacja wysyla podstawowe naglowki hardeningu: CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` i `Permissions-Policy`,
- publiczne `/health` zwraca tylko minimalny status i wersje; szczegolowy payload cache jest dostepny tylko przy lokalnym wywolaniu na `127.0.0.1` albo `localhost`,
- `POST /login` ma prosty limit nieudanych prob per IP w pamieci procesu.

## Polaczenie Allegro

Po deployu administrator wchodzi w `/panel`, klika `Polacz Allegro`, loguje konto BookLoft w Allegro i zatwierdza dostep aplikacji. Callback zapisuje token OAuth w `BOOKLOFT_DATA_DIR/allegro-auth.json`.

`Client ID`, `Client Secret`, `access_token` i `refresh_token` nigdy nie trafiaja do frontendu ani do repo.

## Cache

Cache jest trzymany w `BOOKLOFT_DATA_DIR`.

- `allegro-auth.json` - token OAuth i tymczasowe stany autoryzacji,
- `published-offers.json` - aktywne oferty dopuszczone do katalogu, znaczniki wycofania i lekkie snapshoty historycznych ofert,
- `allegro-offers-cache.json` - ostatni snapshot ofert i kategorii z Allegro,
- `storefront-cache.json` - gotowe dane dla frontendu,
- `cache-meta.json` - status ostatnich aktualizacji i bledow.

Zasady:

- stany/ceny aktywnych ofert odswiezaja sie co 30 minut,
- katalog/kategorie odswiezaja sie co 3 godziny,
- cykliczny refresh stanow i katalogu nie publikuje nowych ID samodzielnie,
- oferta bez stanu `>= 1` albo nieaktywna znika z katalogu,
- nowe aktywne oferty sa dodawane codziennie o `22:00`
  `Europe/Warsaw`; po przestoju pierwsze uruchomienie po tej godzinie wykonuje
  jedno nadrobienie,
- przycisk `Dodaj nowe` w panelu pozostaje dostepny i korzysta z tej samej
  kolejki oraz logiki co automat,
- przy wycofaniu oferty zapisywane sa tylko dane potrzebne stronie `410`: identyfikator, nazwa, slug, pierwsze zdjecie, kategoria i data usuniecia; cena i opis nie sa utrwalane w historycznym snapshotcie,
- ponowne dodanie tej samej oferty usuwa jej znacznik wycofania i snapshot.
- pelne wzbogacenie cache laczy parametry ofertowe i produktowe Allegro w paczkach po 5 ofert; stary cache pozostaje dostepny do atomowego zapisu wyniku, a blad pojedynczej oferty zachowuje jej poprzednie dane,
- odswiezenie dostepnosci jest przerywane, gdy Allegro zwroci mniej niz 75% poprzedniego katalogu majacego co najmniej 20 ofert, co chroni przed masowym wycofaniem URL-i po niepelnej odpowiedzi API.

## Frontend

- strona glowna startuje od 50 najnowszych aktywnych ofert i automatycznie dociaga kolejne paczki po 50 podczas scrollowania,
- kategorie maja publiczne adresy `/kategoria/:id/:slug`, sa linkowane w HTML i trafiaja do sitemap,
- strony kategorii maja opis z aktualna liczba ofert, linki do powiazanych kategorii oraz blok zaufania wyjasniajacy, ze katalog pokazuje realne egzemplarze i prowadzi do zakupu na Allegro,
- strona glowna jest katalogiem bez sekcji `O nas`; linki informacyjne sa dyskretne i prowadza do `/o-nas` oraz `/informacje-prawne`,
- gorny obszar strony glownej ma loftowy banner graficzny z logo i haslem `Przestrzen pelna ksiazek`; na waskich ekranach banner jest nizszy, szerszy i bardziej dopasowany do szerokosci ekranu,
- tlo strony i panele uzywaja subtelnej papierowej tekstury bez pionowych linii ani ciezkich dekoracji,
- lista ofert pokazuje dwie karty w rzedzie rowniez na bardzo waskich ekranach mobilnych,
- pelny katalog mozna przeszukiwac po tytule, SKU i kategorii,
- listing domyslnie pokazuje najnowsze oferty; dodatkowo mozna sortowac po cenie i tytule dla calego katalogu, kategorii i wynikow wyszukiwania, a warianty z `sort` sa `noindex,follow` i nie sa dodawane do sitemap,
- karty listingu pokazuja zdjecie, kategorie, tytul, cene i link `Zobacz oferte`; okladki maja delikatne papierowe passe-partout i subtelny hover na desktopie,
- listing uzywa skalowanych wariantow obrazow Allegro (`s256`/`s400`/`s512`/`s720`) zamiast ciezkich oryginalow,
- banner uzywa WebP 92 KB na desktopie i osobnego wariantu 47 KB na telefonie, z JPEG jako fallbackiem; logo ma jawne wymiary, zeby ograniczyc przesuniecia ukladu,
- katalog wplata niskie rotujace notki bez naglowka, z losowym startem rotacji, tekstem glownym i krotkim dopiskiem po prawej; na desktopie mniej wiecej co 36 ofert, na mobile co 18 ofert,
- pole wyszukiwania uzywa tekstu pomocniczego `Sprawdz, czy mamy to, czego szukasz` bez osobnego widocznego naglowka `Szukaj`,
- pole wyszukiwania ma subtelny przycisk czyszczenia wpisanej frazy,
- wyniki wyszukiwania maja mala etykiete `Wyszukiwanie` w stylu pozostalych etykiet sekcji oraz jeden naglowek `Oferty dla „<fraza>”`, bez dodatkowych naglowkow wynikow,
- wyszukiwanie ignoruje polskie znaki i kolejnosc slow oraz toleruje pojedyncza drobna literowke w dluzszym slowie; trafienia dokladne pozostaja wyzej od przyblizonych,
- puste i niepuste wyniki zachowuja to samo kremowe tlo strony; pusty stan nie ma zielonego gradientu ani dekoracyjnego monogramu i pozwala wrocic do wszystkich ofert,
- przy pustym wyniku sortowanie jest ukryte, a pod komunikatem widoczne sa cztery rzeczywiste najnowsze oferty z katalogu,
- aktywny listing nie wysyla ukrytej tresci pustego wyniku w SSR; komunikat jest tworzony dopiero dla rzeczywiscie pustej listy,
- pierwsze 50 ofert pozostaje renderowane w HTML, a klient nie pobiera pelnego `/api/storefront` ani `/api/newest`, dopoki uzytkownik nie wyszuka, nie posortuje albo nie zblizy sie do konca pierwszej strony,
- strona oferty pokazuje przycisk `Kup na Allegro`, informacje ze zakup, platnosc, dostawa, zwrot i reklamacja odbywaja sie w Allegro, pasek zalet BookLoft, galerie ze strzalkami bez tla i przewijaniem swipem, lekki podglad zdjec z przewijaniem swipem, zoomem kolkiem myszy, plynniejszym pinch-to-zoom na mobile i przesuwaniem po powiekszeniu oraz stopke `O nas`,
- na telefonie strona oferty pokazuje nad galeria przyklejony pasek z nazwa, cena i przyciskiem `Kup na Allegro`; pasek zalet nadal przesuwa sie poziomo,
- strona oferty pokazuje najwazniejsze parametry z Allegro, jesli sa dostepne w cache, np. autora, wydawnictwo, rok wydania, serie, ISBN/EAN, oprawe i jezyk; liczba stron pozostaje ukryta w widocznej specyfikacji,
- podobne oferty sa sortowane wedlug zgodnosci tytulu, autora, serii, wydawnictwa i kategorii, a dopiero potem wedlug swiezosci,
- strona oferty nie pokazuje liczby dostepnych egzemplarzy, bo katalog zaklada pojedyncze egzemplarze ksiazek uzywanych,
- favicon i ikona Apple Touch korzystaja z monogramu `B` z transparentnymi rogami,
- opisy szczegolowe sa dociagane z Allegro na stronie oferty, jesli nie ma ich jeszcze w cache,
- uklad kategorii i filtrowania zostaje zgodny z poprzednia wersja sklepu,
- sekcja prawno-informacyjna wyjasnia, ze BookLoft.pl jest katalogiem, a zamowienie, platnosc, dostawa, zwrot i reklamacja odbywaja sie w Allegro.

## SEO

- `/`, `/strona/:page`, `/kategoria/:id/:slug`, `/kategoria/:id/:slug/strona/:page` i `/product/:id/:slug` sa renderowane po stronie serwera, z realnymi linkami do ofert bez wymagania JavaScriptu.
- SSR listingu pozostaje ograniczony do 50 produktow na strone. Katalog i kategorie maja techniczna paginacje HTML z realnymi linkami, ale strony 2+ sa `noindex,follow` i nie trafiaja do sitemap. Dla uzytkownikow glowne przegladanie nadal dziala przez infinite scroll po stronie klienta.
- Stare lub bledne slugi produktu i kategorii przekierowuja 301 na adres kanoniczny.
- Niedostepne historyczne oferty zwracaja `410 Gone`, a nieznane identyfikatory `404 Not Found`; obie odpowiedzi sa `noindex`.
- Strona `410` ma pelnoszerokosciowy uklad na PC i mobile, pokazuje zachowane dane egzemplarza, wyszukiwarke oraz maksymalnie osiem trafnych aktywnych ofert. Pole wyszukiwania jest uzupelniane pierwszymi dwoma slowami oczyszczonego tytulu; ranking alternatyw nadal korzysta z pelnej nazwy snapshotu. Starsze wpisy bez snapshotu buduja fraze ze sluga URL i rowniez skracaja ja do dwoch slow.
- Nieznane publiczne sciezki HTML zwracaja `404` z `noindex`, zamiast przekierowywac crawlera na strone glowna.
- Strona `404` zachowuje identyfikacje BookLoft, ma wyszukiwarke katalogu oraz link do wszystkich aktualnych ofert.
- Strona produktu korzysta bezposrednio z SSR i nie zastepuje gotowego HTML ani nie pobiera pelnego katalogu tylko po to, by uruchomic galerie.
- `/sitemap.xml` zawiera strone glowna, strony informacyjne, pierwsze strony publicznych kategorii i aktywne produkty. Nie zawiera technicznej paginacji. `lastmod` jest podawany tylko dla produktu z wiarygodna data istotnej zmiany; techniczne pobranie opisu i globalne odswiezenie cache nie zmieniaja tej daty.
- Dane strukturalne na listingach obejmuja `Organization`, `WebSite`, `ItemList` oraz `BreadcrumbList`; karty ofert nie udaja osobnych `Product`/`Offer`, zeby Google nie raportowal brakow z miniaturek.
- Pelne dane `Product`/`Offer` sa tylko na stronach `/product/:id/:slug`; zawieraja sprzedawce `OnlineStore`, opis, cene, dostepnosc i stan. Ksiazkowy ISBN jest walidowany, konwertowany do ISBN-13 i publikowany na laczonym typie `Product`/`Book`; pozostale EAN/GTIN trafiaja do pola zgodnego z dlugoscia dopiero po kontroli sumy. `brand` korzysta najpierw z wydawnictwa, producenta albo marki pobranej z parametrow produktowych Allegro, a przy braku znanej wartosci zachowuje fallback `BookLoft`.
- `OnlineStore` ma wspolna `MerchantReturnPolicy`, a kazdy `Offer` wskazuje ja przez `@id`; polityka prowadzi do instrukcji zwrotow Allegro bez deklarowania sztucznych, wspolnych kosztow ani terminow BookLoft.
- Techniczna paginacja pozostaje linkowalna dla crawlerow, ale ma `noindex,follow` i `data-nosnippet`, zeby strony oraz ich numery nie pojawialy sie jako osobne wyniki Google.
- Publiczne API listingu zwraca tylko pierwsze zdjecie produktu, zeby ograniczyc wage `/api/storefront`; pelna galeria zostaje na `/api/products/:id`.
- Dynamiczne publiczne API katalogu (`/api/storefront`, `/api/newest`, `/api/products/:id`) wysyla `Cache-Control: no-cache`, zeby zwykle odswiezenie strony po dodaniu ofert rewalidowalo dane bez wymuszania `Ctrl+F5`.
- Miniatury i karty uzywaja mniejszych wariantow obrazow Allegro, a pelny podglad zdjecia nadal korzysta z pelnego adresu obrazu.

## Informacje prawne i analityka

- Dane firmy na stronie: `BookLoft Mateusz Kaczmarek`, Pogórska Wola 334c, 33-152 Pogórska Wola, NIP `9930688202`, REGON `522042224`, `bookloft.store@gmail.com`, `518 104 941`.
- `/informacje-prawne` nie jest pelnym regulaminem samodzielnego sklepu, bo aplikacja nie ma koszyka ani platnosci.
- `/informacje-prawne#zwroty-dostawa` opisuje, ze finalne metody, koszty i terminy dostawy oraz zwroty/reklamacje sa potwierdzane w konkretnej ofercie Allegro; schema.org podaje link do instrukcji Allegro, ale nie wpisuje sztucznych wspolnych kosztow ani terminow.
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
npm test
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
3. na Hetznerze: `cd /home/bookloftpl && git fetch && git switch ver-1.19 && git pull --ff-only`,
4. uzupelnienie ENV Allegro w `/etc/bookloft-shop/bookloft-shop.env`,
5. `npm ci --omit=dev`,
6. restart uslugi sklepu,
7. smoke test domeny i lokalnego healthchecka,
8. wejscie w `/panel` i `Polacz Allegro`, jesli token OAuth nie istnieje.

Szczegoly operacyjne sa w `docs/OPERATIONS.md`.
