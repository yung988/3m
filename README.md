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

## Stránkování PDF

Náhled i tisk používají stejné stránky A4. Aplikace po načtení fontů změří skutečné
výšky obsahu a rozdělí položky mezi stránky. Na pokračování zopakuje číslo faktury,
název zakázky a hlavičku tabulky; součet je pouze na poslední straně. Běžné položky
zůstávají celé. Pokud je samotný popis delší než celá A4, pokračuje na dalších
stranách a množství i ceny se zobrazí jen jednou. Záhlaví, které by samo přesáhlo
A4, zobrazí chybu a export zablokuje.

PDF nadále vzniká přes tiskový dialog prohlížeče. Při ukládání použij formát A4,
měřítko 100 % a vypnutá záhlaví a zápatí prohlížeče.

Regresní testy skutečného rozložení a PDF v Chromiu:

```bash
bunx --bun playwright install chromium
bun run test:browser
```

Testy spouštějí vlastní lokální Vite server a pracují se syntetickými daty bez
připojení k Supabase. Výstupní PDF jsou v ignorovaném adresáři `test-results/`.
