# AGENTS.md

Fakturační nástroj "3m" — klikací tvorba faktur z ceníku, tisk do PDF, ukládání do Supabase. Vite + React 19 + TS + Tailwind v4 + shadcn/ui. Jednouživatelský interní nástroj pro Štěpána (české UI).

## Commands

```bash
bun install
bun run dev        # Vite dev server
bun run typecheck  # tsc --noEmit — the verification gate (no tests exist)
bun run build      # tsc -b && vite build
bun run format     # prettier --write "**/*.{ts,tsx}"
bun run lint       # eslint . — CURRENTLY FAILS on a pre-existing error (see below)
```

- **Bun, not npm/pnpm/yarn.** Lockfile is `bun.lock`.
- **There are no tests.** `bun run typecheck` is the primary verification; run `bun run build` before considering a change done.
- **`bun run lint` fails today** with a pre-existing `react-hooks/refs` error at `src/App.tsx:1306` (`isDraftDirty()` reads `lastSyncedDraftRef.current` during render). Don't treat it as your fault and don't "fix" it unless asked.

## Environment

- Env lives in `.env.local` (gitignored via `*.local`); template is `.env.example`. Only two vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- App runs without these vars but Supabase features (auth, save/load, bank import) are disabled — `src/lib/supabase.ts` exports `supabase = null` and `getSupabaseClient()` throws.

## Architecture

- **No router.** `src/App.tsx` (~2000 lines) is the single orchestrator and entry point — view switching via `useState` (`dashboard | invoices | editor | bank`), auth, all data handlers.
- **Domain logic is pure** in `src/lib/invoice.ts` (InvoiceDraft/InvoiceLine types, `calculateTotal`, formatting, payment QR, invariants like `assertInvoiceDraftInvariant`).
- **All Supabase access goes through `src/lib/invoice-repository.ts`** (list/save/load/delete invoices, bank transaction import/link). App code never queries Supabase directly.
- `src/lib/airbank-xml.ts` parses Air Bank XML (camt) statement exports — feed the raw XML in, get transactions out.
- Price catalog is hardcoded data in `src/data/price-list.ts`.
- `src/lib/app-ui-contracts.ts` / `app-ui-model.ts` define the contract/model types used by the redesigned UI components (`src/components/layout/AppShellV2.tsx`, `src/components/dashboard/`, `src/components/editor/`).

## Supabase schema

- Tables: `invoices`, `invoice_lines`, `bank_transactions`. Migrations live in `supabase/migrations/` (only one exists; schema is largely ad-hoc).
- **`src/lib/database.types.ts` is hand-maintained** (generated from supabase-js types, no CLI config in repo). Any DB column change must be mirrored in BOTH a new migration AND `database.types.ts`, or typecheck breaks.
- Auth is email/password via `supabase.auth.signInWithPassword`.

## Conventions

- **All UI copy and user-facing strings are Czech.** Keep them Czech; don't translate.
- TypeScript is strict with `verbatimModuleSyntax` and `erasableSyntaxOnly`: type-only imports must use `import type`; no enums/namespaces; no unused locals/params.
- Path alias `@/*` → `./src/*`. Always use it for imports.
- Prettier: no semicolons, double quotes, 2-space indent, `trailingComma: "es5"`, `printWidth: 80`, prettier-plugin-tailwindcss (tailwind classes sorted; `cn`/`cva` recognized).
- Tailwind v4 — no config file; theme in `src/index.css` via `@theme`. shadcn/ui components (style `radix-nova`) live in `src/components/ui/`.
- Commits use Conventional Commits with Czech/descriptive subjects (e.g. `feat(redesign): Fáze 5 – ...`).

## Design guidance

For UI work, follow `.impeccable.md` (user: Štěpán, calm/precise/utility-first, shadcn components, neutral base with green accent, print output must fit one A4 page, Czech defaults).
