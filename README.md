# 3m

Klikací fakturační nástroj pro tvorbu dokladů z ceníku prací, tisk do PDF a ukládání faktur do Supabase.

## Vývoj

```bash
bun install
bun run dev
```

Lokální env proměnné jsou v `.env.local`; vzor je v `.env.example`.

## Údaje dodavatele

Všechny údaje dodavatele jsou uloženy v Supabase Auth v
`auth.users.raw_user_meta_data.invoice_settings` a editují se v aplikaci přes
**Nastavení dodavatele**. Profil obsahuje `name`, `addressLines` (pole řádků adresy),
`companyId`, `vatNote`, `email`, `phone`, `accountNumber`, `iban`, `bank` a `bic`.
IBAN se při ukládání i načítání dopočítává z českého čísla účtu.

Aplikace nemá pevně nastaveného dodavatele ani výchozí bankovní účet. Před exportem
vyžaduje jméno, adresu, osmimístné IČO a platný český účet. Starší neúplné profily
je potřeba doplnit. Změna profilu se projeví také při novém exportu starší faktury;
samostatná historická kopie dodavatele u faktury se neukládá.
