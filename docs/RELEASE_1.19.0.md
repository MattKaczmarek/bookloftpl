# BookLoft sklep 1.19.0

## Cel

Nowe aktywne oferty Allegro maja byc automatycznie dodawane do katalogu
codziennie o `22:00` czasu polskiego. Dotychczasowa akcja `Dodaj nowe` w
`/panel` pozostaje dostepna i korzysta z tej samej logiki.

## Przeplyw

1. `DailyTaskScheduler` wylicza najblizsze `22:00` w strefie
   `Europe/Warsaw`, uwzgledniajac zmiane czasu letniego i zimowego.
2. O wyznaczonej porze wywoluje `StoreCache.addNewProducts("daily-schedule")`.
3. Zadanie trafia do tej samej kolejki `StoreCache`, co reczne dodawanie,
   odswiezanie stanow i przebudowa katalogu. Zapisy nie wykonuja sie
   rownolegle.
4. Mechanizm pobiera aktywne oferty Allegro, zachowuje ochrone przed
   podejrzanym masowym spadkiem liczby ofert i atomowo przebudowuje istniejace
   pliki cache.
5. Po zakonczeniu planowany jest kolejny termin. Blad jest zapisany w
   `cache-meta.json`, pokazany w chronionym statusie panelu i zalogowany, ale
   nie zatrzymuje procesu sklepu.

Jesli usluga byla wylaczona o `22:00`, pierwszy start po tej godzinie wykonuje
jedno nadrobienie, o ile automatyczna proba nie zostala jeszcze zapisana w
danym polskim dniu kalendarzowym.

## Konfiguracja

Funkcja jest domyslnie wlaczona:

```bash
BOOKLOFT_DAILY_ADD_NEW_ENABLED=true
BOOKLOFT_DAILY_ADD_NEW_HOUR=22
BOOKLOFT_DAILY_ADD_NEW_MINUTE=0
BOOKLOFT_DAILY_ADD_NEW_TIME_ZONE=Europe/Warsaw
```

Zmienne sa opcjonalne. Produkcja korzysta z powyzszych wartosci domyslnych,
wiec wdrozenie nie wymaga dopisania sekretu ani migracji ENV.

## Status i logi

Chroniony `GET /api/status` zwraca `automaticAddNew` z konfiguracja,
`nextRunAt`, ostatnia proba, ostatnim sukcesem, wynikiem i osobnym bledem
automatycznej akcji. Lokalny `/health` pokazuje ograniczony stan harmonogramu
bez tresci bledu.

Journal uslugi zawiera strukturalne zdarzenia:

- `bookloft.daily_add_new.scheduled`,
- `bookloft.daily_add_new.started`,
- `bookloft.daily_add_new.completed`,
- `bookloft.daily_add_new.failed`.

Zdarzenie sukcesu zapisuje tylko liczby ofert. Tokeny OAuth, hasla i
identyfikatory dodanych ofert nie sa logowane.

## Zgodnosc

- `POST /api/admin/add-new` i przycisk `Dodaj nowe` pozostaja bez zmian.
- Nie zmieniono formatu `published-offers.json`, danych ofert, tytulow,
  opisow, cen, zdjec, URL-i, canonicali, schema ani sitemap.
- `cache-meta.json` dostaje tylko addytywne pola stanu automatu; starsza wersja
  aplikacji ignoruje je przy rollbacku.
- Znane podatnosci tranzytywne zostaly usuniete przez aktualizacje
  `body-parser` do `1.20.6`, `postcss` do `8.5.23` i `nanoid` do `3.3.16`
  w lockfile, bez zmiany deklarowanych zaleznosci aplikacji.

## Weryfikacja przed wdrozeniem

- `npm test`: `27/27`,
- testy strefy czasu obejmuja rozpoczecie i zakonczenie czasu letniego w
  `Europe/Warsaw`,
- test kolejki potwierdza wykonanie zadania i zaplanowanie kolejnego dnia,
- test panelu potwierdza zachowanie przycisku i endpointu recznego,
- `npm audit --omit=dev`: `0` podatnosci,
- `git diff --check`: bez bledow.

## Weryfikacja po wdrozeniu

1. Lokalny `/health` ma zwracac `version=1.19.0`,
   `automaticAddNew.enabled=true`, strefe `Europe/Warsaw` i poprawny
   `nextRunAt`.
2. `journalctl -u bookloft-shop.service` ma zawierac zdarzenie
   `bookloft.daily_add_new.scheduled` bez bledu.
3. `bookloft-shop.service` ma pozostac `active` z `NRestarts=0`.
4. Publiczne `/`, `/panel` i `/health` maja odpowiadac zgodnie z istniejacymi
   zasadami dostepu.
5. Po pierwszym wykonaniu o `22:00` nalezy potwierdzic zdarzenia
   `started` i `completed` oraz zapis `lastSuccessAt`.

Wdrozenie `2026-07-24` na branchu `ver-1.19`, commit kodu `3822480`:

- produkcyjne testy `27/27`,
- `npm audit --omit=dev`: `0` podatnosci,
- lokalny health: `status=ok`, `version=1.19.0`, Allegro polaczone, brak
  bledu cache,
- harmonogram aktywny, `nextRunAt=2026-07-24T20:00:00.000Z`, czyli `22:00`
  `Europe/Warsaw`,
- chroniony `/api/status` i panel potwierdzily automat oraz zachowany reczny
  przycisk bez uruchamiania operacji,
- `bookloft-shop.service`: `active/running`, `NRestarts=0`, brak warningow od
  restartu.

## Rollback

Powrot do `ver-1.18` wylacza harmonogram. Istniejace pliki ofert pozostaja
zgodne. Addytywne pola w `cache-meta.json` nie wymagaja usuwania.
