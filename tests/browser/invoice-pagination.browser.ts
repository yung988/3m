import { expect, test, type Page } from "@playwright/test"
import { createDefaultDraft } from "../../src/lib/invoice"

const supplierSettings = {
  name: "Testovací dodavatel",
  addressLines: ["Ulice 1", "12345 Město", "Česká republika"],
  companyId: "12345678",
  vatNote: "Nejsem plátce DPH.",
  email: "test@example.com",
  phone: "+420 123 456 789",
  accountNumber: "2991647014/3030",
  iban: "CZ4430300000002991647014",
  bank: "Air Bank",
  bic: "AIRACZPP",
}

function fixture(count: number, long = false) {
  const lines = Array.from({ length: count }, (_, i) => ({
    id: `line-${i}`,
    description: `POLOŽKA-${i + 1} ${long && i === 1 ? "Dlouhý český popis práce žluťoučký kůň 🔧 ".repeat(800) : "Montáž a odborné práce v objektu zákazníka."}`,
    quantity: 1,
    unitPrice: 100 + i,
    unitLabel: "ks",
  }))
  return {
    draft: {
      ...createDefaultDraft(),
      invoiceNumber: "2026099",
      projectTitle: "Test stránkování",
      lines,
    },
    total: lines.reduce((n, line) => n + line.unitPrice, 0),
    supplierSettings,
    qrDataUrl: "",
  }
}

async function render(page: Page, props: ReturnType<typeof fixture>) {
  await page.evaluate(
    (props) =>
      window.dispatchEvent(new CustomEvent("invoice:test", { detail: props })),
    props
  )
  await expect(
    page.locator('#invoice-print[data-pagination="ready"]')
  ).toBeVisible()
}

async function layout(page: Page) {
  return page.locator("#invoice-print > article").evaluateAll((pages) =>
    pages.map((page) => ({
      footer: page.querySelector(".invoice-footer span")!.textContent,
      headers: page.querySelectorAll("thead").length,
      overflow:
        page.querySelector(".invoice-footer")!.getBoundingClientRect().bottom >
          page.getBoundingClientRect().bottom + 1 ||
        page.querySelector(".invoice-items")!.getBoundingClientRect().bottom >
          page.querySelector(".invoice-footer")!.getBoundingClientRect().top +
            1,
    }))
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/invoice.html")
  await expect(page.locator("html")).toHaveAttribute(
    "data-fixture-ready",
    "true"
  )
})

for (const scenario of [
  { name: "krátká faktura", count: 2, width: 1280, long: false },
  { name: "součet na hranici stránky", count: 35, width: 1280, long: false },
  { name: "90 položek", count: 90, width: 1280, long: false },
  { name: "popis přes celou A4", count: 3, width: 1280, long: true },
  { name: "90 položek na mobilu", count: 90, width: 390, long: false },
  { name: "prázdný náhled", count: 0, width: 1280, long: false },
]) {
  test(scenario.name, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setViewportSize({ width: scenario.width, height: 1000 })
    const props = fixture(scenario.count, scenario.long)
    await render(page, props)
    const screen = await layout(page)
    if (scenario.count <= 2) expect(screen).toHaveLength(1)
    else expect(screen.length).toBeGreaterThan(1)
    for (const [i, sheet] of screen.entries()) {
      expect(sheet.footer).toBe(`Strana ${i + 1} / ${screen.length}`)
      expect(sheet.headers).toBe(1)
      expect(sheet.overflow).toBe(false)
    }
    await expect(page.locator("#invoice-print .invoice-total")).toHaveCount(1)
    await expect(
      page.locator("#invoice-print > article:last-child .invoice-total")
    ).toHaveCount(1)
    for (const line of props.draft.lines) {
      const parts = await page
        .locator(`#invoice-print tr[data-line-id="${line.id}"]`)
        .evaluateAll((rows) =>
          rows.map((row) => ({
            text: row.firstElementChild!.textContent,
            hasAmount: Array.from(row.children)
              .slice(1)
              .some((cell) => cell.textContent),
          }))
        )
      expect(parts.map((part) => part.text).join("")).toBe(line.description)
      expect(parts.filter((part) => part.hasAmount)).toHaveLength(1)
    }
    await page.emulateMedia({ media: "print" })
    expect(await layout(page)).toEqual(screen)
    await expect(
      page.getByText("Ovládání aplikace se nesmí tisknout")
    ).toBeHidden()
    const pdf = await page.pdf({
      path: testInfo.outputPath("invoice.pdf"),
      preferCSSPageSize: true,
      printBackground: true,
    })
    // Chromium emits one /Page dictionary per physical PDF page. Check for
    // accidental blank sheets introduced by print margins or fragmentation.
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(
      screen.length
    )
    expect(errors).toEqual([])
  })
}

test("změna obsahu přepočítá stránky", async ({ page }) => {
  await render(page, fixture(90))
  expect((await layout(page)).length).toBeGreaterThan(1)
  await render(page, fixture(1))
  await expect(page.locator("#invoice-print > article")).toHaveCount(1)
  await expect(page.locator("#invoice-print .invoice-footer span")).toHaveText(
    "Strana 1 / 1"
  )
})

test("příliš dlouhé záhlaví zobrazí chybu místo oříznuté faktury", async ({
  page,
}) => {
  const props = fixture(1)
  props.supplierSettings = {
    ...supplierSettings,
    addressLines: Array(150).fill("Dlouhá adresa"),
  }
  await page.evaluate(
    (props) =>
      window.dispatchEvent(new CustomEvent("invoice:test", { detail: props })),
    props
  )
  await expect(page.locator("#invoice-print")).toHaveAttribute(
    "data-pagination",
    "error"
  )
  await expect(page.getByRole("status")).toContainText("příliš dlouhé")
  await expect(page.locator("#invoice-print > article")).toHaveCount(0)
})
