import type { PriceItem } from "@/data/price-list"
import type { InvoiceLine, InvoiceStatus } from "@/lib/invoice"
import type {
  BankTransactionSummary,
  InvoiceSummary,
} from "@/lib/invoice-repository"

export type AppSurface = "dashboard" | "editor" | "preview"

export type SurfaceDensity = "compact" | "comfortable"

export type EditorWorkspaceRegion =
  | "invoice_basics"
  | "price_catalog"
  | "invoice_lines"
  | "mobile_lines_drawer"

export type MobileLinesDrawerState = "closed" | "peek" | "open"

export type VisualTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"

export type DashboardMetricId =
  | "paid"
  | "overdue"
  | "waiting_send"
  | "waiting_payment"
  | "this_month"
  | "this_year"

export type DashboardMetricModel = {
  id: DashboardMetricId
  label: string
  amount: number
  invoiceCount: number
  detail: string
  tone: VisualTone
}

export type WorkflowPanelId =
  | "follow_up"
  | "bank_transactions"
  | "saved_invoices"

export type WorkflowPanelModel = {
  id: WorkflowPanelId
  title: string
  description: string
  countLabel: string
  tone: VisualTone
}

export type InvoicePrimaryAction =
  | "open"
  | "finish"
  | "mark_sent"
  | "mark_paid"
  | "mark_unpaid"

export type InvoiceRowModel = {
  invoice: InvoiceSummary
  status: InvoiceStatus
  statusTone: VisualTone
  isActive: boolean
  isWaitingForSend: boolean
  primaryAction: InvoicePrimaryAction
}

export type InvoiceBasicsFieldGroup =
  | "document"
  | "project"
  | "customer"
  | "contact"
  | "status"

export type InvoiceBasicsPanelModel = {
  invoiceNumber: string
  status: InvoiceStatus
  paymentTone: VisualTone
  exportTone: VisualTone
  groups: InvoiceBasicsFieldGroup[]
  density: SurfaceDensity
}

export type BankTransactionUiCategory =
  | "ready"
  | "mismatch"
  | "unknown_symbol"
  | "missing_symbol"
  | "resolved"

export type BankTransactionUiModel = {
  transaction: BankTransactionSummary
  invoice: InvoiceSummary | null
  amountMatches: boolean
  category: BankTransactionUiCategory
  tone: VisualTone
}

export type PriceCatalogItemModel = {
  item: PriceItem
  selectedLine: InvoiceLine | null
  tone: "neutral" | "selected"
}

export type PriceCatalogPanelModel = {
  selectedCategory: string
  searchQuery: string
  visibleItems: PriceCatalogItemModel[]
  density: SurfaceDensity
}

export type InvoiceLineEditorModel = {
  line: InvoiceLine
  subtotal: number
  tone: VisualTone
}

export type InvoiceLinesPanelModel = {
  lines: InvoiceLineEditorModel[]
  lineCount: number
  total: number
  density: SurfaceDensity
}

export type EditorSummaryModel = {
  invoiceNumber: string
  status: InvoiceStatus
  paymentTone: VisualTone
  exportTone: VisualTone
  lineCount: number
  total: number
}

export type MobileInvoiceDockModel = {
  drawerState: MobileLinesDrawerState
  recentLines: InvoiceLineEditorModel[]
  lineCount: number
  total: number
}
