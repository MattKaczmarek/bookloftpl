# BookLoft.pl 1.18.0

Status: wdrozone produkcyjnie `2026-07-21` na branchu `ver-1.18`, commit kodu `8be1f13`, tag `bookloftpl-v1.18.0`.

## Cel

Usuniecie blokujacego ekranu startowego i unowoczesnienie pierwszego kontaktu z katalogiem bez opozniania dostepu do ofert oraz bez zmian w tytulach i SEO ofert.

## Zakres zmian

- SSR katalogu nie renderuje juz `#brand-intro`; `store.js` nie uzywa timera intro, fontowego oczekiwania ani klucza `bookloft_intro_seen`.
- Hero, panel wyszukiwania, nawigacja kategorii i zasadnicza tresc wchodza krotka animacja `opacity` + `transform`. Nie ma pelnoekranowej nakladki.
- Animacje dzialaja tylko w `prefers-reduced-motion: no-preference`. Przy ograniczonym ruchu tresc jest widoczna bez animowanego wejscia.
- Mobile renderuje popularne kategorie jako poziomy pasek linkow o polach dotykowych `44 px`. Wszystkie kategorie nadal sa dostepne w selekcie.
- Popularne kategorie sa wybierane serwerowo wedlug liczby aktywnych ofert, bez kategorii ogolnych i duplikatow. Aktywny link jest synchronizowany po stronie klienta.
- Dlugie naglowki wynikow wyszukiwania maja ograniczona skale i bezpieczne zawijanie. Tekst naglowka nie zostal zmieniony.
- Przycisk czyszczenia wyszukiwania i przyciski cookies maja minimum `44 px`. Strzalki galerii produktu i lightboxa korzystaja z SVG i maja minimum `44 x 44 px` na mobile.
- Wersja aplikacji i statycznych zasobow zostala podniesiona do `1.18.0`.

## Przeplyw funkcji

1. `renderStorePage()` zwraca od razu rzeczywisty katalog z klasa `catalog-page`.
2. `popularCategoryLinks()` filtruje, deduplikuje i sortuje widoczne kategorie wedlug liczby ofert.
3. `renderPopularCategoryLinks()` tworzy semantyczna nawigacje SSR z `aria-current` i linkami do indeksowalnych stron kategorii.
4. `syncCategoryButtons()` utrzymuje aktywny stan paska i drzewa po zmianie filtra bez przeladowania.
5. CSS uruchamia lekkie wejscie sekcji i zachowuje natychmiastowy render przy ograniczeniu ruchu.
6. `galleryArrowIcon()` tworzy te same ikony SVG dla galerii w SSR i lightboxa w JavaScript.

## Granice zmiany

Nie zmieniono:

- nazw ani opisow ofert,
- widocznych tytulow ofert i naglowkow produktow,
- meta title, meta description i Open Graph,
- canonicali, robots, sitemap i danych strukturalnych,
- routingu, API, formatu cache i danych Allegro,
- konfiguracji ENV, systemd ani Nginx.

## Weryfikacja

- `npm test`: 22/22 testy zaliczone.
- Kontrola skladni: `pageRoutes.js`, `store.js` i `product.js` bez bledow.
- Render przegladarkowy sprawdzony przy `320 x 740`, `390 x 844` i `1440 x 1000` dla strony glownej, wyszukiwania i karty produktu.
- We wszystkich sprawdzonych widokach: brak poziomego overflow, brak bledow strony i nieudanych requestow, brak elementu intro.
- Pole czyszczenia wyszukiwania zmierzone jako `44 x 44 px`; pasek kategorii jest widoczny tylko w ukladzie mobilnym.
- Zrzuty i tymczasowy serwer testowy zostaly usuniete po weryfikacji.

## Weryfikacja produkcyjna

- Repo Hetznera po deployu: branch `ver-1.18`, commit `8be1f13`, czysty status.
- `bookloft-shop.service`: `active/running`, `NRestarts=0`; journal od restartu bez warningow i bledow.
- Lokalny i publiczny health: `status=ok`, wersja `1.18.0`, Allegro polaczone, 1985 widocznych ofert i brak ostatniego bledu cache.
- Publiczne `/` zwraca `200`, prawidlowy canonical, zasoby `1.18.0`, semantyczny pasek kategorii i nie zawiera dawnego intro.
- Playwright przy `320`, `390` i `1440 px`: brak poziomego overflow, bledow JavaScript i nieudanych requestow.
- Galeria zmienia zdjecie, lightbox otwiera sie i zamyka, a strzalki SVG maja `44 x 44 px` na mobile.
- Czyszczenie wyszukiwania, przejscie do kategorii i `aria-current` dzialaja. Przy `prefers-reduced-motion: reduce` animacja jest wylaczona, a tresc od razu widoczna.
- Cache ofert zostal zachowany. Nie wykonywano pelnego odswiezenia cache, migracji danych, zmian ENV ani Nginx.
- Sitemap, canonicale i architektura URL nie zmienily sie, dlatego sitemap nie zostala ponownie wyslana do Search Console.
- `npm audit --omit=dev` raportuje jedna niska podatnosc posredniego `body-parser`; brak podatnosci moderate, high i critical. Nie byla zwiazana z zakresem wydania.

Wplyw na Search Analytics nalezy ocenic dopiero po zebraniu pelnych danych po wdrozeniu; obecny raport potwierdza stan techniczny, nie zmiane zasiegu organicznego.

## Rollback

Powrot do oznaczonego wydania `bookloftpl-v1.17.3` nie wymaga cofania danych ani cache. Po przywroceniu kodu nalezy zainstalowac zaleznosci, zrestartowac `bookloft-shop.service` i powtorzyc smoke test.
