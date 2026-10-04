import type { InvoiceSummary } from "@/lib/invoice-repository"

export type InvoiceMoneyState =
  | "draft"
  | "awaiting"
  | "overdue"
  | "paid"
  | "cancelled"

export type FakturyFilter = "all" | "awaiting" | "overdue" | "draft"

export const FILTER_OPTIONS: { id: FakturyFilter; label: string }[] = [
  { id: "all", label: "Vše" },
  { id: "awaiting", label: "Čeká na platbu" },
  { id: "overdue", label: "Po splatnosti" },
  { id: "draft", label: "Rozpracované" },
]

export function getFilterLabel(filter: FakturyFilter) {
  return FILTER_OPTIONS.find((option) => option.id === filter)?.label ?? "Vše"
}

export function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function getInvoiceMoneyState(
  invoice: InvoiceSummary,
  today: Date
): InvoiceMoneyState {
  if (invoice.status === "draft") return "draft"
  if (invoice.status === "paid") return "paid"
  if (invoice.status === "cancelled") return "cancelled"
  if (invoice.status === "overdue") return "overdue"
  if (invoice.due_date) {
    const due = new Date(`${invoice.due_date}T00:00:00`)
    if (!Number.isNaN(due.getTime()) && due < today) return "overdue"
  }
  return "awaiting"
}

export function matchesFilter(
  invoice: InvoiceSummary,
  filter: FakturyFilter,
  today: Date
) {
  switch (filter) {
    case "all":
      return true
    case "awaiting":
      return getInvoiceMoneyState(invoice, today) === "awaiting"
    case "overdue":
      return getInvoiceMoneyState(invoice, today) === "overdue"
    case "draft":
      return getInvoiceMoneyState(invoice, today) === "draft"
  }
}
