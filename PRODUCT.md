# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Štěpán Smutný — sole user, internal tool. He is an FVE/solar installer (and general electrician, not a VAT payer). Primary usage scene: on his phone at job sites right after finishing work, sometimes desktop at home. The job he is doing: turn the work he just completed into a correct, printable invoice in seconds, and later know whether and when he got paid.

## Product Purpose

"3m" is a click-to-invoice tool: pick work items from a price catalog, adjust quantities/hours, and produce a clean PDF invoice that fits one A4 page, then save it to Supabase. Success means both equally: (1) producing a correct invoice fast — ideally before leaving the job site — and (2) truthful money tracking — knowing the real state of every invoice (issued, paid, overdue) and matching bank payments to invoices so nothing slips.

## Positioning

Not a general-purpose invoicing product — a personal work surface tuned to Štěpán's catalog and workflow: a fixed price list of electrical/FVE tasks, tap-to-add rows, a customer (default 3M ENERGY) that never changes, Czech payment QR, and an Air Bank statement import that links payments straight to invoices. A neighboring tool could not truthfully copy this coupling of his catalog + bank + invoice state.

## Operating Context

- Work is done first; invoicing happens at the site or shortly after, usually from a phone.
- Customer is almost always 3M ENERGY s.r.o.; the tool pre-fills it and hides detail editing until requested.
- Bank is Air Bank; statements are exported as XML (camt) and imported to auto-match payments.
- Invoices have one verifiable state: draft → issued → paid / overdue / cancelled. Follow-up reminders are copied to clipboard or sent via mailto.
- A draft autosaves to the browser (localStorage) even when logged out.

## Capabilities and Constraints

- Click-driven invoice building from the hardcoded price catalog (`src/data/price-list.ts`) with category filter, search, and quantity/hour adjustment; custom lines allowed.
- PDF output via browser print; must fit one A4 page and stay clean.
- Czech payment QR (SPD*1.0) with the invoice number as variable symbol.
- Supabase persistence behind `src/lib/invoice-repository.ts`: `invoices`, `invoice_lines`, `bank_transactions`. Offline/missing env means save and bank features are disabled.
- Invoice numbering is `YYYY####`; next number is derived from existing invoices (fallback `YYYY0021`).
- Not a VAT payer — no DPH/VAT lines anywhere. Currency is CZK only.
- All UI copy is Czech and must stay Czech.
- Single-user; default customer and supplier data are fixed.

## Brand Commitments

- Name: "3m" (repo/`package.json` name `fakturyprostepu`, remote `yung988/3m`).
- Supplier identity and payment details are real, binding product data defined in `src/lib/invoice.ts` (`supplier` and `payment` constants).
- Preserve those values exactly unless the user explicitly requests a change.
- Never expose them in logs, screenshots, examples, or generated documentation.
- User-confirmed: keep everything as-is — supplier, bank, Czech-only UI, one-A4 print rule, `YYYY####` numbering.

## Evidence on Hand

- Real price catalog: `src/data/price-list.ts` (FVE electrical work items with prices and hour billing).
- Real supplier/payment constants and PDF naming: `src/lib/invoice.ts`.
- Existing design guidance: `.impeccable.md` (user-confirmed brief — calm/precise/utility-first, neutral base with green accent, print fits one A4).
- No marketing materials, testimonials, or press exist — do not fabricate any.

## Product Principles

1. Speed to a correct invoice is the point: the common path (pick items → print) must take seconds and be usable one-handed on a phone at a job site.
2. The PDF is the product the customer sees — it must stay clean, complete, and on one A4 page.
3. Money truth over convenience: invoice state must be unambiguous and reconciled with the bank, never best-effort.
4. One user, one real workflow: optimize for Štěpán's actual day, not for generic invoicing features he will never use.
5. Numbers are sacrosanct: totals, quantities, dates, and the payment QR must be exact — an error costs real money.
