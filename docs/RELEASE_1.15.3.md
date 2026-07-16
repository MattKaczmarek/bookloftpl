# BookLoft.pl 1.15.3

Status: wdrozone produkcyjnie na branchu `ver-1.15`.

## Cel

Wersja poprawia skutecznosc wyszukiwania i uzytecznosc pustego wyniku bez zmiany danych ofert, SEO aktywnych produktow ani zrodel katalogu.

## Inteligentniejsze wyszukiwanie

- Zapytanie i dane katalogu sa normalizowane bez polskich znakow i interpunkcji.
- Slowa zapytania moga wystepowac w innej kolejnosci niz w tytule lub danych oferty.
- Token od czterech znakow toleruje jedna zmiane, wstawienie lub usuniecie znaku oraz zamiane dwoch sasiednich znakow.
- Dokladna fraza ma wyzszy wynik niz dopasowanie tokenowe i przyblizone.
- Domyslne sortowanie wynikow uwzglednia najpierw trafnosc, a potem swiezosc oferty; wybrane recznie sortowanie po cenie albo nazwie nadal jest respektowane.

## Pusty wynik

- Selektory sortowania sa ukrywane, gdy lista wynikow jest pusta.
- Pod komunikatem widoczna jest nieobramowana sekcja `Najnowsze oferty` z maksymalnie czterema rzeczywistymi pozycjami katalogu.
- Przy aktywnej kategorii propozycje pochodza z tej kategorii.
- Wyczyszczenie wyszukiwania przywraca sortowanie i zwykly listing.

## Weryfikacja

- Testy jednostkowe obejmuja brak polskich znakow, odwrocona kolejnosc slow, literowke, zamiane sasiednich znakow, priorytet dokladnego wyniku i zapytanie z samej interpunkcji.
- Testy SSR potwierdzaja cztery aktualne sugestie oraz ukrycie obu selektorow sortowania.
- Pomiar calego katalogu 2043 ofert: do okolo 55 ms dla zapytania przyblizonego w srodowisku Node.
- Playwright desktop `1440x1000` i mobile `390x844`: wyszukiwanie przyblizone, pusty wynik, sugestie, reset i brak poziomego overflow.
