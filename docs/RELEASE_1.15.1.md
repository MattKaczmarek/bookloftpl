# BookLoft.pl 1.15.1

Status: wdrozone produkcyjnie na branchu `ver-1.15`.

## Cel

Wersja upraszcza widok wyszukiwania i skrocona fraze proponowana na stronie sprzedanej oferty. Nie zmienia nazw ofert, tytulow HTML aktywnych produktow, ich meta description ani danych katalogu.

## Zakres zmian

- Wyniki wyszukiwania pokazuja jeden naglowek `Oferty dla: <fraza>`.
- Usunieto widoczne powtorzenia `Wyszukiwanie`, `Wyniki wyszukiwania w BookLoft` oraz `Wyniki: <fraza>`.
- Pusty wynik nie pokazuje dekoracyjnej litery `B` w kolku.
- Pole `Poszukaj podobnego tytulu` na stronie `410 Gone` zawiera pierwsze dwa slowa oczyszczonego tytulu, np. `Heartstopper 1-5`.
- Ranking kart alternatywnych nadal korzysta z pelnej nazwy zapisanego egzemplarza; skrocenie dotyczy tylko wartosci formularza wyszukiwania.
- Analogicznie uproszczono wspolne widoki `404`, usuwajac z nich ten sam dekoracyjny monogram.

## Weryfikacja

- `npm test`: 9/9 testow.
- Playwright desktop `1440x1000`: wyniki wyszukiwania i strona `410` bez poziomego overflow.
- Playwright mobile `390x844`: pusty wynik i strona `410` bez poziomego overflow ani nakladania tekstu.
- Test przegladarkowy potwierdza ukrycie pustej etykiety, opisu i drugiego naglowka wynikow oraz dokladnie dwa slowa w polu strony `410`.
