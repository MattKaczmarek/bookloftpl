# BookLoft.pl 1.15.2

Status: wdrozone produkcyjnie na branchu `ver-1.15`.

## Cel

Wersja dopracowuje hierarchie tekstu i kolor tla wynikow wyszukiwania po obserwacji produkcyjnego widoku `1.15.1`. Nie zmienia danych ofert, SEO aktywnych produktow ani logiki wyszukiwania.

## Zakres zmian

- Nad wynikami widoczna jest mala etykieta `Wyszukiwanie`, korzystajaca z tego samego stylu co `Nowosci z regalu`.
- Glowny naglowek ma spokojniejsza forme `Oferty dla „<fraza>”`, bez dwukropka i bez dodatkowego naglowka listy.
- Globalne tlo strony nie przechodzi juz przez zielonkawy kolor w srodku wysokosci dokumentu.
- Panel pustego wyniku korzysta z kremowego papierowego tla zamiast zielonego gradientu.
- Puste i niepuste wyniki zachowuja ten sam charakter kolorystyczny na desktopie i mobile.

## Weryfikacja

- `npm test`: komplet testow jednostkowych i tras.
- Playwright desktop `1440x1000`: porownanie wyniku niepustego i pustego.
- Playwright mobile `390x844`: etykieta, naglowek oraz pusty stan bez poziomego overflow i nakladania tekstu.
- Kontrola computed styles potwierdza brak zielonego gradientu `#f6fbf3` i `rgba(237, 246, 238, 0.9)` w tle pustego widoku.
