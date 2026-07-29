# BookLoft sklep 1.19.2

## Cel

Wersja `1.19.2` usuwa przyczyne nocnego OOM sklepu i ogranicza koszt burstow
publicznych stron SSR. Nie zmienia katalogu, SEO, cen, Allegro, harmonogramu
ani formatu plikow runtime.

## Ustalona przyczyna

`2026-07-29 00:29 CEST` jeden klient z jednakowym user-agentem utrzymywal
`83` rownolegle requesty, w tym `78` stron produktow. Wszystkie zakonczyly sie
razem jako `502`, gdy proces Node przerwal prace z:

- heap V8 ok. `1893.4 MB`,
- `CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`,
- pik pamieci jednostki ok. `2 GiB`.

Produkcyjny `storefront-cache.json` mial `9 120 974` bajty. Strona produktu
wywolywala rownolegle `getProduct()` oraz `getStorefront()`, a `getProduct()`
ponownie wywolywal `getStorefront()`. Kazde wywolanie czytalo caly plik i
tworzylo osobny duzy graf obiektow. Burst zwielokrotnil te kopie do limitu
heap. Automat nowych ofert zakonczyl sie poprawnie o `22:00` i nie byl
przyczyna incydentu.

## Zmiany

1. `StoreCache` przechowuje jeden snapshot storefrontu w pamieci.
   Rownolegle odczyty dostaja ta sama referencje, a `rebuildStorefront()`
   wymienia ja dopiero po poprawnym atomowym zapisie pliku.
2. Nginx uzywa osobnego klucza tylko dla SSR `/`, `/product`, `/kategoria` i
   `/strona`: `5 r/s`, burst `20`, maksymalnie `16` jednoczesnych requestow z
   jednego adresu. Assety i API nie sa liczone.
3. `bookloft-shop.service` dostaje `MemoryHigh=768M`, `MemoryMax=1G`,
   `MemorySwapMax=256M` oraz `OOMPolicy=kill` jako granice ochronne hosta.
4. Lokalny `/health` pokazuje `rssBytes`, `heapUsedBytes`, `heapTotalBytes`,
   `externalBytes` i uptime. Publiczny health nadal zwraca tylko minimalny
   stan uslugi i wersje.

## Adekwatna walidacja

Wymagane sa tylko testy bezposrednich kontraktow:

- wspoldzielenie snapshotu przy rownoleglych odczytach i atomowa wymiana po
  przebudowie,
- statyczny kontrakt limitow Nginx, systemd i lokalnej telemetrii pamieci,
- wersja `1.19.2` i uruchomienie procesu z produkcyjnym ENV,
- po deployu kontrolowany burst stron produktu, health, pamiec, `NRestarts`,
  odpowiedzi `429` ponad limitem oraz journal.

Nie uruchamiaj pelnego zestawu testow sklepu: zmiana nie dotyka wyszukiwania,
SEO, galerii, Allegro ani harmonogramu.

Przed commitem przeszly `2/2` celowane testy: snapshot `200` rownoleglych
odczytow z atomowa wymiana oraz kontrakt Nginx/systemd/lokalnego health.

## Deploy

1. Przelacz produkcje na `ver-1.19.2` i wykonaj `npm ci --omit=dev` tylko gdy
   lockfile zmienia zaleznosci (sam numer wersji tego nie wymaga).
2. Zrob kopie aktualnego unitu, site Nginx i ewentualnego pliku
   `/etc/nginx/conf.d/bookloft-shop-rate-limits.conf`.
3. Zainstaluj `deploy/bookloft-shop.service.example` oraz
   `deploy/nginx-rate-limits.conf.example`.
4. Do produkcyjnego `location /` dla `bookloft.pl` dodaj cztery dyrektywy
   limitow z `deploy/nginx-root.conf.example`; nie nadpisuj sciezek Certbota.
5. Uruchom `systemd-analyze verify` i `nginx -t`. Przy bledzie przywroc caly
   poprzedni zestaw plikow przed jakimkolwiek reloadem/restartem.
6. Dopiero po poprawnej walidacji: `systemctl daemon-reload`, kontrolowany
   restart `bookloft-shop.service` i `systemctl reload nginx`.

## Rollback

Przywroc backup unitu i konfiguracji Nginx, wykonaj `daemon-reload`,
`nginx -t`, restart sklepu oraz reload Nginx, a checkout cofnij do
`bookloftpl-v1.19.1`. Format danych jest zgodny w obie strony; nie usuwaj ani
nie odswiezaj recznie cache.

## Status

Wdrozone `2026-07-29` na branchu `ver-1.19.2`, commit kodu `9e50073`, tag
`bookloftpl-v1.19.2`.

Preflight produkcyjnego ENV, `systemd-analyze verify` i `nginx -t` przeszly.
Po kontrolowanym restarcie health zwrocil `ok` i wersje `1.19.2`, a nowy unit
mial aktywne limity pamieci. Burst `60` rownoleglych requestow jednej strony
produktu zakonczyl sie `16 x 200` oraz `44 x 429`; proces zachowal PID,
`NRestarts=0`, a peak cgroup wyniosl ok. `273 MB` zamiast nocnych `2 GiB`.
Publiczny root zwracal `200`, checkout byl czysty, a journal aplikacji od
restartu nie zawieral warningow.
