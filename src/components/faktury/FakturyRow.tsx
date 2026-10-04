import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/invoice"
import type { InvoiceSummary } from "@/lib/invoice-repository"
import type { InvoiceMoneyState } from "@/components/faktury/invoice-states"

type FakturyRowProps = {
  invoice: InvoiceSummary
  state: InvoiceMoneyState
  onLoad: (id: string) => void
}

const STATUS_META: Record<
  InvoiceMoneyState,
  { label: string; className: string }
> = {
  draft: {
    label: "Rozpracováno",
    className: "bg-[oklch(0.75_0.15_55)] text-white",
  },
  awaiting: {
    label: "Čeká na platbu",
    className: "bg-[#6E6E73] text-white",
  },
  overdue: {
    label: "Po splatnosti",
    className: "bg-[oklch(0.6_0.2_25)] text-white",
  },
  paid: {
    label: "Zaplaceno",
    className: "bg-[oklch(0.7_0.17_145)] text-white",
  },
  cancelled: {
    label: "Storno",
    className: "bg-[rgba(60,60,67,0.18)] text-[#6E6E73]",
  },
}

function secondaryDateText(invoice: InvoiceSummary) {
  if (invoice.due_date) return `Splatnost: ${formatDate(invoice.due_date)}`
  if (invoice.issue_date) return `Vystaveno: ${formatDate(invoice.issue_date)}`
  if (invoice.updated_at)
    return `Aktualizováno: ${formatDate(invoice.updated_at)}`
  return ""
}

export function FakturyRow({ invoice, state, onLoad }: FakturyRowProps) {
  const meta = STATUS_META[state]
  const title = invoice.project_title || invoice.customer_name || "Bez názvu"
  const amount = formatCurrency(Number(invoice.total_amount || 0))
  const dateText = secondaryDateText(invoice)

  return (
    <button
      type="button"
      onClick={() => onLoad(invoice.id)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.98]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] leading-tight font-semibold text-[#1C1C1E]">
          {title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs leading-none font-semibold",
              meta.className
            )}
          >
            {meta.label}
          </span>
          {dateText ? (
            <span className="truncate text-xs text-[#6E6E73]">{dateText}</span>
          ) : null}
        </div>
        {invoice.invoice_number ? (
          <p className="mt-0.5 text-xs text-[#8E8E93] tabular-nums">
            {invoice.invoice_number}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-[17px] leading-tight font-bold text-[#1C1C1E] tabular-nums">
        {amount}
      </p>
    </button>
  )
}
