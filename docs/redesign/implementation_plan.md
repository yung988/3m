# Redesign: Premium mobilní UX à la Apple

Štěpán si stěžuje, že se appka blbě používá. Cíl je přepracovat UI/UX tak, aby působila jako prémiová mobilní aplikace (Apple-like) – čistá, rychlá, intuitivní. Branch: `redesign/premium-mobile-ux`.

## Výchozí stav

- Celá aplikace je v jednom **App.tsx** (~4 500 řádků) – monolitní soubor se vším
- Dva pohledy: **Dashboard** (přehled + statistiky + banka) a **Editor** (formulář + ceník + náhled)
- 17 shadcn komponent už nainstalovaných (včetně vaul Drawer)
- Existující glassmorphism design system (`.app-cockpit`, `.app-panel`)
- Mobilní layout existuje, ale je to jen „schování desktopu" – ne mobile-first design

## User Review Required

> [!IMPORTANT]
> **Rozsah redesignu** – Tohle je velká přestavba. Navrhuju ji rozdělit do 5 fází, kde každá fáze je samostatně testovatelná. Můžeš schválit všechny najednou, nebo fázi po fázi.

> [!WARNING]
> **App.tsx monolith** – Soubor má 4 500 řádků. Při redesignu ho budu rozbíjet na menší komponenty. Logika (state, handlers, Supabase) zůstane, ale JSX se přesune do samostatných souborů.

## Open Questions

> [!IMPORTANT]
> **Dark mode vs Light mode?** – Appka má obojí. Apple mobilní appky jsou typicky light-first. Chceš aby default byl světlý, nebo nechat jak je?

> [!IMPORTANT]
> **Přehled faktur jako hlavní obrazovka?** – Teď se po přihlášení zobrazí dashboard se statistikami + seznam faktur + banka. Chceš to nechat, nebo by hlavní obrazovka měl být čistě seznam faktur a statistiky schovat do podstránky?

## Proposed Changes

### Fáze 1: Rozklad monolitu + iOS navigace

Základ pro všechno ostatní – extrahovat komponenty z App.tsx a přidat iOS-style bottom tab bar.

#### [NEW] `src/components/layout/BottomTabBar.tsx`
- iOS-style bottom navigation: **Přehled** | **Faktury** | **＋ Nová** | **Banka** | **Účet**
- Velké touch targets (min. 44×44px), safe-area padding pro iPhony
- Aktivní tab s jemnou animací (scale + barva)
- Skrytý na desktopu (`lg:hidden`), na desktopu zůstane stávající sidebar/header

#### [NEW] `src/components/layout/MobileHeader.tsx`
- Jednoduchý iOS-style header: název stránky uprostřed, akce vpravo
- Plynulé přechody titulku při navigaci
- Nahradí stávající komplikovaný header s dropdown menu

#### [NEW] `src/components/layout/AppShell.tsx`
- Wrapper komponent: header nahoře, content uprostřed (scroll), tab bar dole
- CSS `dvh` (dynamic viewport height) pro správné zobrazení na mobilech
- Animované přechody mezi views pomocí CSS transitions

#### [MODIFY] `src/App.tsx`
- Extrakce JSX do nových komponentů (App.tsx si nechá state management + handlers)
- Nahrazení inline renderování za `<AppShell>` + routované pohledy

---

### Fáze 2: Seznam faktur – mobilní karty

Přepracovat hlavní přehled faktur pro mobilní použití.

#### [NEW] `src/components/invoices/InvoiceCard.tsx`
- Větší, čistší kartičky s jasnou vizuální hierarchií
- Hlavní info: číslo + zákazník nahoře, částka výrazně vpravo
- Status jako barevný proužek na levé straně karty (ne jen badge)
- Swipe-to-action: swipe doprava = „Zaplaceno", swipe doleva = „Smazat"
- Tap = otevřít detail/editor

#### [NEW] `src/components/invoices/InvoiceList.tsx`
- Pull-to-refresh gesto (nebo alespoň refresh tlačítko)
- Sticky search bar nahoře s filter chipy (Všechny / Nezaplacené / Po splatnosti)
- Sekce seskupené po měsících (červenec 2026, červen 2026, ...)
- Empty state s ilustrací a CTA „Vytvořit první fakturu"
- Skeleton loading state místo „Načítám faktury…" textu

#### [NEW] `src/components/ui/skeleton.tsx`
- Instalace přes shadcn: `bunx shadcn@latest add skeleton`

---

### Fáze 3: Editor faktury – mobile-first formulář

#### [NEW] `src/components/editor/InvoiceEditor.tsx`
- Sekcionovaný formulář s velkými touch-friendly inputy
- Sekce jako kolabovatelné karty: „Základní údaje", „Odběratel", „Položky", „Souhrn"
- Aktivní sekce zvýrazněná, ostatní collapsed s preview obsahu

#### [NEW] `src/components/editor/LineItemCard.tsx`
- Větší kartičky pro řádky faktury
- Stepper pro množství (+/−) s velkými tlačítky (min 44px)
- Swipe-to-delete
- Drag handle pro přeřazení (budoucí vylepšení)

#### [NEW] `src/components/editor/PriceCatalogSheet.tsx`
- Ceník jako full-screen bottom sheet (vaul Drawer)
- Sticky search + category tabs nahoře
- Velké kartičky pro položky ceníku s +/− stepperem
- Počítadlo vybraných položek v headeru sheetu

#### [NEW] `src/components/editor/InvoiceSummaryBar.tsx`
- Sticky bar dole na editoru: celková částka + „Náhled" + „Uložit"
- Nahradí stávající `MobileEditorActionBar`
- Jemná glassmorphism estetika

---

### Fáze 4: Dashboard – přehledné metriky

#### [NEW] `src/components/dashboard/StatsGrid.tsx`
- Apple Health-style grid s 2×2 nebo 2×3 kartičkami
- Hlavní metrika velkým písmem, popisek malým
- Jemné barevné gradienty podle typu (zelená pro zaplacené, červená pro po splatnosti)

#### [NEW] `src/components/dashboard/ActionList.tsx`
- Seznam urgentních akcí (po splatnosti, čeká na odeslání)
- Každá akce jako řádek s ikonou + popisem + CTA tlačítkem
- Swipe akce na mobilech

#### [MODIFY] Bankovní sekce
- Přesunout do samostatného tabu (tab „Banka" v bottom navigation)
- Upload XML jako full-screen flow, ne vložený do dashboardu

---

### Fáze 5: Polish – animace, typografie, detaily

#### [MODIFY] `src/index.css`
- Přepracovat spacing system – větší mezery na mobilech
- Větší font sizes pro touch (16px minimum pro body, 18px pro inputs)
- iOS-style spring animace pro přechody
- Haptic-style feedback efekty (subtle scale na tap)
- Vylepšení glassmorphism efektů

#### [NEW] Chybějící shadcn komponenty
- `Sheet` – pro off-canvas panely
- `Dialog` – pro potvrzovací modály  
- `Skeleton` – pro loading states
- `Switch` – pro toggle nastavení

#### [MODIFY] Celková estetika
- Více whitespace – vzdušnější layout
- Zaoblené rohy (rounded-2xl na kartách)
- Jemnější stíny (shadow-sm → custom subtle shadows)
- Konzistentní ikonografie (lucide-react už je)

---

## Verification Plan

### Automated Tests
- `bunx vite build` – ověřit, že se projekt buildí po každé fázi
- TypeScript kontrola bez chyb

### Manual Verification
- Testovat na mobilním Safari/Chrome (responsive mode v DevTools)
- Ověřit touch targets (min 44×44px)
- Ověřit safe-area na iPhonech
- Ověřit plynulost animací (60fps)
- Štěpán testuje na svém telefonu
