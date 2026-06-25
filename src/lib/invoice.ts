import type { PriceItem } from "@/data/price-list"

export type InvoiceLine = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  unitLabel: string
}

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "overdue"
  | "cancelled"

export type InvoiceDraft = {
  id?: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  projectTitle: string
  projectSubtitle: string
  customerName: string
  customerAddress: string
  customerCompanyId: string
  customerTaxId: string
  status: InvoiceStatus
  paidAt: string | null
  exportedAt: string | null
  exportCount: number
  lines: InvoiceLine[]
}

export const supplier = {
  name: "Štěpán Smutný",
  addressLines: ["Doubravník 288", "59261 Doubravník", "Česká republika"],
  companyId: "17303940",
  vatNote: "Nejsem plátce DPH.",
  email: "stepansmutny@gmail.com",
  phone: "+420 606 087 779",
}

export const payment = {
  accountNumber: "2991647014/3030",
  iban: "CZ4430300000002991647014",
  bic: "AIRACZPP",
  bank: "Air Bank a.s., Evropská 2690/17, 160 00 Praha 6",
}

const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatPlainCurrency(value: number) {
  return numberFormatter.format(value) + ",00 Kč"
}

export function formatDate(dateInput: string) {
  if (!dateInput) {
    return ""
  }

  return new Intl.DateTimeFormat("cs-CZ").format(
    new Date(`${dateInput}T00:00:00`)
  )
}

export function formatDateTime(dateInput: string) {
  if (!dateInput) {
    return ""
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateInput))
}

export function buildInvoicePdfFileName(draft: InvoiceDraft) {
  const parts = [
    `faktura-${draft.invoiceNumber}`,
    draft.projectTitle,
    draft.projectSubtitle,
    draft.issueDate,
  ].map(toSafeFileNamePart)

  return `${parts.filter(Boolean).join("_") || "faktura"}.pdf`
}

export function parseHoursInput(value: string): number {
  const trimmed = value.trim()
  const timeMatch = trimmed.match(/^(\d+):([0-5]\d)$/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10)
    const m = parseInt(timeMatch[2], 10)
    return h + m / 60
  }
  const n = Number(trimmed.replace(",", "."))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function formatHoursDisplay(value: number): string {
  if (value === 0) return "0"
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  if (minutes === 0) return String(hours)
  return `${hours}:${String(minutes).padStart(2, "0")}`
}

export function formatQuantity(quantity: number, unitLabel: string) {
  const amount =
    unitLabel === "hod"
      ? formatHoursDisplay(quantity)
      : numberFormatter.format(quantity)

  return unitLabel ? `${amount} ${unitLabel}` : amount
}

export function calculateTotal(lines: InvoiceLine[]) {
  return lines.reduce((total, line) => {
    return total + line.quantity * line.unitPrice
  }, 0)
}

export function createLineFromPriceItem(item: PriceItem): InvoiceLine {
  return {
    id: createId(),
    description: item.name,
    quantity: item.defaultQuantity,
    unitPrice: item.price,
    unitLabel: item.billingUnit,
  }
}

export function createEmptyLine(): InvoiceLine {
  return {
    id: createId(),
    description: "Vlastní položka",
    quantity: 1,
    unitPrice: 0,
    unitLabel: "",
  }
}

export function createDefaultDraft(): InvoiceDraft {
  const issueDate = toDateInput(new Date())
  const due = new Date()
  due.setDate(due.getDate() + 21)

  return {
    invoiceNumber: `${new Date().getFullYear()}0021`,
    issueDate,
    dueDate: toDateInput(due),
    projectTitle: "",
    projectSubtitle: "",
    customerName: "3M ENERGY s.r.o.",
    customerAddress: "Kaštanová 489/34\n62000 Brno\nČeská republika",
    customerCompanyId: "14054001",
    customerTaxId: "CZ14054001",
    status: "draft",
    paidAt: null,
    exportedAt: null,
    exportCount: 0,
    lines: [],
  }
}

export function buildPaymentQrString(draft: InvoiceDraft, total: number) {
  const message = sanitizeQrValue(`Faktura ${draft.invoiceNumber}`)

  return [
    "SPD*1.0",
    `ACC:${payment.iban}`,
    `AM:${total.toFixed(2)}`,
    "CC:CZK",
    `X-VS:${sanitizeQrValue(draft.invoiceNumber)}`,
    `MSG:${message}`,
  ].join("*")
}

export function normalizeMoneyInput(value: string) {
  const normalized = Number(value.replace(",", "."))

  return Number.isFinite(normalized) ? normalized : 0
}

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function createId() {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sanitizeQrValue(value: string) {
  return value.replaceAll("*", " ").replace(/\s+/g, " ").trim().slice(0, 60)
}

function toSafeFileNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
