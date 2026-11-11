---
name: 3m Faktury
description: Klikací tvorba faktur pro Štěpána — lehký, iOS-inspirovaný mobilní fakturační nástroj (target: Quiet Native Utility)
colors:
  system-blue: "#007AFF"
  system-blue-hover: "#0062CC"
  system-blue-pressed: "#0052C2"
  system-gray-canvas: "#F2F2F7"
  surface: "#FFFFFF"
  secondary-surface: "#F7F7FA"
  ink-primary: "#1C1C1E"
  ink-secondary: "#6E6E73"
  ink-tertiary: "#8E8E93"
  divider: "rgba(60, 60, 67, 0.18)"
  success: "oklch(0.7 0.17 145)"
  warning: "oklch(0.75 0.15 55)"
  danger: "oklch(0.6 0.2 25)"
typography:
  large-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.15
  section-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  navigation-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  row-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  secondary:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  "2xl": "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.system-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 20px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.system-blue-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.system-blue-pressed}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
    typography: "{typography.title}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  chip:
    backgroundColor: "{colors.secondary-surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0 12px"
    typography: "{typography.label}"
  chip-selected:
    backgroundColor: "{colors.system-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0 12px"
    typography: "{typography.label}"
---

# Design System: 3m Faktury

> **Migration note (normative context).** This document defines the **approved target visual system** for all future work. The current source code (`src/App.tsx`, `src/index.css`, `AppShellV2`, `InvoiceCard`, `PriceCatalogSheet`, …) has **not yet fully migrated**: it still renders the legacy green-tinted cockpit gradient, the lime accent, glass panels, card-heavy chrome, the four-tab bottom bar, the bottom-sheet catalog and the Geist Variable webfont. Those choices — including the Geist typeface — are **anti-reference** and are not preserved as allowed design rules here. Until each surface is rebuilt, the design detector may report findings against the legacy implementation — treat those as expected, not as regressions.

## Overview

**Creative North Star: "Quiet Native Utility"**

A light, iOS-inspired invoicing interface that feels calm, immediate and effortless to operate. Hierarchy comes from typography, spacing and the contrast between the System Gray canvas and white grouped surfaces — not from decorative cards, gradients or heavy borders. The interface should feel like a focused native productivity tool: compact, predictable, highly legible and optimized for fast one-handed use on a phone in the field.

This is a single-user tool for one electrician (Štěpán) who builds FVE systems and invoices from a price catalog while on site. Every screen is built for a thumb, sunlight, and speed: minimal taps between "idea" and "PDF sent". The system is quiet on purpose — the data (amounts, dates, statuses) is the loud thing, so it gets the type weight, the tabular numerals, and the only color that matters at the moment a decision is made. Czech is the only language; CZK is the only supported currency; dates, quantities and invoice numbers follow their documented Czech formats.

System Blue is the one interaction color and it is used sparingly — on the primary action of a screen, the active tab, a selected control, a link. Everything else is ink on the gray canvas and white surfaces, with subtle hairlines doing the separating. The printed A4 invoice stays a clean, monochrome-leaning document; the incumbent lime print accents are part of the legacy sheet and are pending migration.

**Key Characteristics:**

- Light System Gray canvas with white grouped surfaces; hierarchy from type + spacing, not cards.
- System Blue reserved for interaction; green exists only as the semantic paid/success state.
- Three stable tab-bar destinations — Faktury, Nová, Platby; focused flows (editor, preview, catalog) hide the tab bar.
- Invoices render as compact grouped-list rows — roughly five per phone viewport — with hairline separators.
- Compact density, 44px minimum touch targets, 16px input text.
- Flat at rest; no decorative shadows, gradients, or glass panels.
- Mobile-first, safe-area-aware, one-handed thumb-reach layout.
- Czech-only UI copy; tabular numerals for all money.

## Colors

A near-achromatic palette — one interaction blue, ink neutrals on gray and white — where the only saturated hues are semantic (status) or belong to category tags in the price catalog. The primary hierarchy comes from the relationship between the neutral gray canvas, white grouped surfaces, typography and subtle separators.

### Primary

- **System Blue** (#007AFF): The single interaction color. Primary actions (Uložit, Přidat, Pokračovat, Přihlásit), the active bottom-tab, selected filter chips, links and meaningful interactive states. Never used as a large decorative fill.

### Semantic

- **Success Green** (oklch(0.7 0.17 145)): The _only_ green in the system. Means paid / success / done ("Zaplaceno", synced state). Green must never be an interaction or brand accent again.
- **Warning Amber** (oklch(0.75 0.15 55)): Draft / in-progress and warning states ("Rozpracováno").
- **Danger Red** (oklch(0.6 0.2 25)): Overdue, destructive, and error states ("Po splatnosti", destructive actions).

### Neutral

- **System Gray Canvas** (#F2F2F7): The app background; the base layer every grouped surface sits on. Hierarchy comes from the contrast between this gray and white grouped content.
- **Surface White** (#FFFFFF): Grouped content — lists, forms, sheets. Never floats on a white background.
- **Secondary Grouped Surface** (#F7F7FA): Quiet fills within the gray family — unselected filter pills, search-field washes, inset group backgrounds.
- **Primary Ink** (#1C1C1E): Primary text, amounts, headings.
- **Secondary Ink** (#6E6E73): Secondary text, captions, row subtitles, invoice numbers.
- **Tertiary Ink** (#8E8E93): Placeholders and the least-emphasized text.
- **Divider** (rgba(60, 60, 67, 0.18)): Hairline separators between grouped rows; used at full or reduced opacity.

### Named Rules

**The System Blue Rule.** Blue touches only things you can press or select: primary actions, the active tab, selected pills, links, focus rings. It never fills large surfaces; on any given screen it should cover well under 10% of the pixels. Its rarity is the point — the eye lands on the next tap.

**The One Green Rule.** Green is a status, not a brand. The only legal green is the success/paid semantic; any gradient, glow, or lime accent on the canvas is legacy and forbidden on new surfaces.

## Typography

**Body Font:** The operating system's native UI font stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. No webfont is loaded for the interface; the app reads as native on whatever device runs it.

**Character:** The OS's own UI font renders the interface, so the app always feels native on the device it runs on. Hierarchy comes from weight, size and spacing — calm, precise, nothing decorative. Numerals matter: all money and quantities render with `tabular-nums`.

### Hierarchy

- **Large Title** (700, 34px, 1.15): Primary destination screens — Faktury and Platby. The one place the interface gets a big, decisive title.
- **Section Title** (600, 22px, 1.25): In-page section headings inside a screen.
- **Headline** (600, 18px, 1.3): Screen titles in compact flows, sheet titles.
- **Navigation Title** (600, 17px, 1.3): The title in focused editor and preview flows — a compact, native bar title.
- **Row Title** (600, 17px, 1.35): Invoice list rows and catalog item rows.
- **Title** (600, 16px, 1.4): Buttons and emphasized amounts.
- **Body** (400, 16px, 1.5): Inputs, form labels, item descriptions. Input text is always 16px to prevent iOS auto-zoom.
- **Secondary** (400, 14px, 1.4): Supporting copy, row subtitles, metadata.
- **Label** (600, 12px, 1.4): Tab labels, uppercase + wider-tracking eyebrows.
- **Caption** (500, 12px, 1.4): Status and due-date secondary row information.

### Named Rules

**The System-Font Rule.** The operating system's native UI font is the only typeface. No webfont is loaded and no second family is ever added; hierarchy comes from weight and size. Geist Variable belongs to the legacy implementation being replaced and must not reappear.

**The Title-of-Place Rule.** Large Title is reserved for primary destination screens such as Faktury and Platby. Focused editor and preview flows use the compact Navigation Title instead — a large title inside a focused flow would mislead the user about where they are.

## Layout

Mobile-first, single column, thumb-reach density. The shell is three stacked layers: a sticky translucent header (56px, `h-14`), a scrolling content column, and a fixed bottom tab bar (56px, mobile-only at `lg:hidden`). All fixed chrome pads with `env(safe-area-inset-*)` for the notch, home indicator, and edge insets (`viewport-fit=cover` in the document).

- Content side padding is 16px (`px-4`); vertical rhythm runs on a 4px grid with `sm` (8px) and `lg` (16px) gaps between blocks.
- Control height is 44px (`h-11`) for touch targets; the editor's main actions and catalog rows use 48px (`h-12`) for the most-thumbed targets.
- The invoice editor is a centered form column (`max-w-lg`); on `lg` it becomes a two-column grid `[minmax(320px,430px) minmax(0,1fr)]` with the form on the left and the live preview on the right.
- Long lists (invoices, catalog items) are grouped surfaces: one shared container radius with 1px Divider hairlines between rows — no per-row cards or gaps between them. The invoice list shows roughly five rows per phone viewport.
- Focused flows (invoice editor, preview, catalog) are full-screen and hide the main bottom navigation; a back/cancel affordance returns to Faktury.

### Named Rules

**The Three-Destination Rule.** The mobile tab bar holds exactly three stable destinations — Faktury, Nová, Platby — and Faktury is the default authenticated destination. The former dashboard lives inside Faktury as a compact summary. The invoice editor, preview and catalog are flows launched from those destinations, never additional tabs. An invoice number is never used as a navigation label.

## Elevation & Depth

**Flat, layered by tone — not by shadow.** Depth is conveyed by the contrast between the System Gray canvas and white grouped surfaces, plus hairline separators. Surfaces are flat at rest; there are no colored glows, no gradient panels, and no drop shadows on rows or containers in the target system.

The single retained "lift" is the native-iOS scrim: the header and bottom tab bar use a translucent canvas (`bg-background/80`) with a 24px backdrop blur so scrolling content passes quietly underneath. That is a functional reading scrim, not decoration.

### Named Rules

**The Quiet-At-Rest Rule.** Surfaces are flat at rest; the only depth cue is canvas-vs-white contrast plus hairlines. Shadows, glows, and glass panels are the signature of the legacy cockpit design and are the first thing a migration removes.

## Shapes

Gently curved, iOS-grouped corners from the token scale: `sm` (6px) for micro-elements, `lg` (10px) for controls and inputs, `xl` (14px) for grouped containers, `2xl` (18px) reserved for the largest grouped containers, `full` for pills and icon buttons. One radius per element level; never mixed arbitrarily.

- Hairline borders (1px, Divider) do the separating — between grouped rows, and at full or reduced opacity for inner edges.
- Recurring silhouettes: the pill (status chips, category filters, steppers, icon buttons) and the grouped-list container with hairline-separated rows sharing a single restrained radius.
- Press feedback is a subtle scale (`active:scale-[0.98]`); `-webkit-tap-highlight-color` is transparent.

## Components

For each component: shape, color assignment, states, and behavior.

### Buttons

- **Shape:** Gently curved (10px `lg`); pill (`full`) for icon-only and compact actions.
- **Primary:** System Blue fill, white text, 44px (or 48px for the editor's main action), 16px/600. Hover deepens to `#0062CC`, pressed to `#0052C2`; press scales to 0.98.
- **Outline / Secondary:** Surface White fill, Primary Ink text, 1px Divider hairline; hover darkens the hairline. Icon-only variants are `44×44px` circles.
- **Disabled:** Reduced opacity, no fill shift; primary actions (e.g. Uložit, Pokračovat) disable until their precondition (signed-in, not syncing, selection non-empty) is met.

### Inputs / Fields

- **Style:** Surface White, 1px Divider border, 10px radius, 44px height (search and editor inputs use 48px), 16px text.
- **Focus:** 2px System Blue ring at ~20% opacity; no border color shift on focus.
- **Search:** 40px leading icon, trailing clear button, `pl-10`; the catalog search sits on a Secondary Grouped Surface wash with a transparent border.

### Chips

- **Style:** Pill (32px tall), 12px/600 text.
- **States:** Status chips = colored fill (Success Green / Warning Amber / Danger Red per status) with white text. Category filter pills = Secondary Grouped Surface fill, Secondary Ink text at rest, System Blue fill + white text when selected. Catalog category pills additionally carry a 10px uppercase colored tag for each category.

### Grouped Lists & Containers

- **Container Corner Style:** restrained, shared radius — `xl` (14px) for grouped containers. Rows inside a container share the container's radius and carry no radius of their own.
- **Background:** Surface White on the gray canvas; Secondary Grouped Surface for inset groups.
- **Border:** 1px Divider hairlines between rows; the active row swaps to a 2px System Blue ring.
- **Internal Padding:** 16px (`p-4`) per row.
- **Invoice List Row (signature):** a compact grouped-list row, not a standalone card. Rows are Surface White, separated only by 1px Divider hairlines inside one shared container radius, so roughly five invoice entries fit a phone viewport. Amount (bold, tabular numerals, right-aligned) and the customer/job title (17px/600 Row Title) are the primary information; status and due date are secondary, in 12px Caption within Secondary/Tertiary Ink. No decorative shadow, no thick colored side strip, no nested card treatment. Taps open the editor as a focused flow with a 0.98 press scale.

### Navigation

- **Mobile bottom tab bar:** fixed, 56px, exactly three stable destinations — **Faktury** (default authenticated destination; the former dashboard lives here as a compact summary), **Nová** (starts a new invoice), **Platby**. 20px icon over a 10px/500 label. Active tab = System Blue + `aria-current="page"`; inactive = Secondary Ink, hovering to Primary Ink. Mobile-only (`lg:hidden`); desktop uses an in-page shell without a tab bar.
- **Focused flows:** the invoice editor and preview are focused flows, not persistent tab-bar destinations; the bottom navigation is hidden while they are active, and a back/cancel affordance returns to Faktury. An invoice number is never used as a navigation label.
- **Header:** sticky, translucent scrim over the canvas. Destination screens (Faktury, Platby) lead with a Large Title; focused editor and preview flows use a compact Navigation Title (17px/600) with 44px left/right action slots and a subtitle in 12px Secondary Ink.

### Focused Catalog Surface (signature)

On mobile, the catalog is a single consistent full-screen focused surface — not an 88svh bottom drawer. It hides the main bottom navigation while active and returns to the editor when dismissed. It contains:

- a compact search field on a Secondary Grouped Surface wash,
- accessible category filtering with contained, predictable overflow (hidden scrollbar + snap; a wrapped or clipped row), never uncontrolled overflow,
- grouped compact item rows inside a shared container radius: item name and price (with unit) as the primary information, category tag and quantity secondary,
- an inline plus control on each row, becoming a compact quantity stepper once the item has quantity — no full-width "Přidat" button inside every row,
- a custom-item action,
- a persistent bottom summary bar: selected-item count, running total, and a primary "Pokračovat" action.

Desktop may adapt the catalog to a side panel or sheet while preserving the same interaction model — search, category filter, inline add/stepper, and a summary with Pokračovat.

## Do's and Don'ts

### Do:

- **Do** keep the canvas System Gray and grouped content Surface White; the gray/white contrast is the hierarchy.
- **Do** reserve System Blue for interactive states only — primary action, active tab, selected pill, focus ring.
- **Do** keep the mobile tab bar to the three stable destinations — Faktury, Nová, Platby — with Faktury as the default authenticated destination.
- **Do** hide the bottom navigation during focused flows (editor, preview, catalog) and return to Faktury via a back/cancel affordance.
- **Do** build lists as compact grouped rows — one shared container radius, 1px hairline separators between rows, roughly five invoice rows per phone viewport.
- **Do** use an inline plus control (or compact stepper) for adding catalog items, backed by a persistent summary with Pokračovat.
- **Do** use 44px minimum touch targets and 16px input text on mobile.
- **Do** pad all fixed chrome (header, tab bar, summary bar, catalog surface) with `env(safe-area-inset-*)`.
- **Do** render money and quantities with `tabular-nums` and Czech formatting.
- **Do** keep every user-facing string in Czech.

### Don't:

- **Don't** use green or lime as a primary interaction or brand accent — the green cockpit gradient, glass panels, card shadows, the bottom-sheet catalog, and the Geist webfont are anti-reference, not allowed design rules.
- **Don't** make the editor, preview, or catalog persistent tab-bar destinations, and never use an invoice number as a navigation label.
- **Don't** render invoices as standalone cards with thick colored side strips, nested cards, per-row shadows, or per-row radii.
- **Don't** use a full-width "Přidat" button inside every catalog row — inline plus / stepper only.
- **Don't** add decorative gradients, colored glows, or `backdrop-blur` glass panels to new surfaces.
- **Don't** float white cards on a white background; there is always a gray canvas beneath grouped surfaces.
- **Don't** use shadows for depth — separate with canvas tone and hairline dividers.
- **Don't** mix radii arbitrarily; pick the token level for the element's rank.
- **Don't** load a webfont or add a second typeface — the OS native UI font is the only typeface — and don't drop tabular numerals for money.
