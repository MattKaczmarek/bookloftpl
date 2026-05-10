# Operacje BookLoftPL

Stan dokumentu: `2026-05-10`.
Aktywny branch na DO: `main`.
Usluga: brak procesu aplikacyjnego, statyczne pliki serwuje `nginx.service`.

## Granice projektu

`bookloftpl` to publiczny landing page. Nie jest czescia runtime Asystenta i nie przechowuje danych operacyjnych.

Nie dotyczy:

- `storage/` Asystenta,
- ofert Andrzeja,
- API Jarka,
- Google Sheets pakowania,
- sesji uzytkownikow Asystenta.

## Relacje z innymi projektami

- `bookloft-asystent` dziala jako osobna aplikacja na `asystent.bookloft.pl` i `andrzej.bookloft.pl`.
- `bot-andrzej` dziala jako `bot-andrzej.service` i wysyla oferty do Asystenta.
- `bot-jaroslaw` dziala jako `bot-jarek.service` i ma lokalne API dla Asystenta.
- `bookloftpl` moze linkowac do zewnetrznych sklepow albo sociali, ale nie powinien importowac kodu ani danych tych uslug.

## Deploy

```bash
cd /home/bookloftpl
git fetch
git switch main
git pull
```

Nginx reload:

```bash
systemctl reload nginx.service
```

Reload Nginx jest potrzebny tylko po zmianie konfiguracji serwera, nie po zwyklym pullu statycznych plikow albo dokumentacji.

## Weryfikacja

```bash
systemctl is-active nginx.service
curl -s -o /dev/null -w "%{http_code}\n" https://bookloft.pl/
curl -s -o /dev/null -w "%{http_code}\n" https://www.bookloft.pl/
```

