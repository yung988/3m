import type { ChangeEvent, ReactNode } from "react"

import type { PriceItem } from "@/data/price-list"
import type { InvoiceDraft, InvoiceLine, InvoiceStatus } from "@/lib/invoice"
import type {
  BankTransactionSummary,
  InvoiceSummary,
} from "@/lib/invoice-repository"
import type {
  DashboardMetricModel,
  EditorSummaryModel,
  InvoiceBasicsPanelModel,
  InvoiceLineEditorModel,
  InvoiceLinesPanelModel,
  InvoicePrimaryAction,
  MobileInvoiceDockModel,
  MobileLinesDrawerState,
  PriceCatalogPanelModel,
  WorkflowPanelModel,
} from "@/lib/app-ui-model"

export type AppShellContract = {
  actions?: ReactNode
  children: ReactNode
  userEmail?: string
}

export type DashboardCockpitContract = {
  metrics: DashboardMetricModel[]
  panels: WorkflowPanelModel[]
  invoices: InvoiceSummary[]
  bankTransactions: BankTransactionSummary[]
}

export type DashboardInvoiceAction = {
  invoice: InvoiceSummary
  action: InvoicePrimaryAction
}

export type DashboardActionHandlers = {
  onCopyReminder: (invoice: InvoiceSummary) => void
  onDeleteInvoice: (id: string) => void
  onDuplicateInvoice: (id: string) => void
  onLoadInvoice: (id: string) => void
  onMarkInvoiceSent: (id: string) => void
  onToggleInvoicePaid: (id: string, isPaid: boolean) => void
}

export type BankTransactionActionHandlers = {
  onCancelImport: () => void
  onConfirmImport: () => void
  onImportXml: (event: ChangeEvent<HTMLInputElement>) => void
  onLinkTransaction: (transactionId: string, invoiceId: string | null) => void
  onLoadInvoice: (invoiceId: string) => void
  onMarkPaid: (invoiceId: string) => void
}

export type InvoiceBasicsPanelContract = {
  draft: InvoiceDraft
  model: InvoiceBasicsPanelModel
  onStatusChange: (status: InvoiceStatus) => void
  onUpdateDraftField: <K extends keyof InvoiceDraft>(
    key: K,
    value: InvoiceDraft[K]
  ) => void
}

export type PriceCatalogActionHandlers = {
  onAddPriceItem: (item: PriceItem) => void
  onRemovePriceItem: (item: PriceItem) => void
  onSearchChange: (value: string) => void
  onSelectedCategoryChange: (value: string) => void
}

export type PriceCatalogPanelContract = {
  model: PriceCatalogPanelModel
  priceCategories: string[]
} & PriceCatalogActionHandlers

export type InvoiceLineActionHandlers = {
  onAddCustomLine: () => void
  onRemoveLine: (id: string) => void
  onUpdateLine: (id: string, changes: Partial<InvoiceLine>) => void
}

export type InvoiceLinesPanelContract = {
  model: InvoiceLinesPanelModel
} & InvoiceLineActionHandlers

export type MobileInvoiceDockContract = {
  model: MobileInvoiceDockModel
  onDrawerStateChange: (state: MobileLinesDrawerState) => void
  onExport: () => void
  onSave: () => void
}

export type MobileInvoiceLinesDrawerContract = {
  lines: InvoiceLineEditorModel[]
  state: MobileLinesDrawerState
  total: number
  onClose: () => void
} & InvoiceLineActionHandlers

export type EditorWorkspaceContract = {
  basics: InvoiceBasicsPanelContract
  catalog: PriceCatalogPanelContract
  lines: InvoiceLinesPanelContract
  mobileDock: MobileInvoiceDockContract
  summary: EditorSummaryModel
}
