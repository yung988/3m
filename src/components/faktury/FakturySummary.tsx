import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/invoice"
import type { InvoiceSummary } from "@/lib/invoice-repository"
import {
  getInvoiceMoneyState,
  startOfToday,
  type FakturyFilter,
  type InvoiceMoneyState,
} from "@/components/faktury/invoice-states"

type FakturySummaryProps = {
  invoices: InvoiceSummary[]
  filter: FakturyFilter
  onFilterChange: (filter: FakturyFilter) => void
}

const SEGMENTS: {
  key: Extract<InvoiceMoneyState, "overdue" | "awaiting" | "draft">
  label: string
  accent: string
}[] = [
  {
    key: "overdue",
    label: "Po splatnosti",
    accent: "text-[oklch(0.48_0.18_25)]",
  },
  { key: "awaiting", label: "Čeká na platbu", accent: "text-[#1C1C1E]" },
  { key: "draft", label: "Rozpracované", accent: "text-[oklch(0.48_0.12_55)]" },
]

export function FakturySummary({
  invoices,
  filter,
  onFilterChange,
}: FakturySummaryProps) {
  const today = startOfToday()

  const counts: Record<InvoiceMoneyState, number> = {
    draft: 0,
    awaiting: 0,
    overdue: 0,
    paid: 0,
    cancelled: 0,
  }
  const totals: Record<"draft" | "awaiting" | "overdue", number> = {
    draft: 0,
    awaiting: 0,
    overdue: 0,
  }

  for (const invoice of invoices) {
    const state = getInvoiceMoneyState(invoice, today)
    counts[state] += 1
    if (state === "draft" || state === "awaiting" || state === "overdue") {
      totals[state] += Number(invoice.total_amount || 0)
    }
  }

  const actionable = counts.overdue + counts.awaiting + counts.draft

  if (actionable === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-white px-4 py-3">
        <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[oklch(0.65_0.16_145)]" />
        <p className="text-base font-medium text-[#6E6E73]">Vše je vyřízeno</p>
      </div>
    )
  }

  return (
    <div className="flex divide-x divide-[rgba(60,60,67,0.18)] overflow-hidden rounded-xl bg-white">
      {SEGMENTS.map((segment) => {
        const selected = filter === segment.key
        return (
          <button
            key={segment.key}
            type="button"
            onClick={() => onFilterChange(segment.key)}
            aria-pressed={selected}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-3.5 transition-transform active:scale-[0.98]"
          >
            <span className="max-w-full truncate text-xs leading-tight font-medium text-[#6E6E73]">
              {segment.label}
            </span>
            <span
              className={cn(
                "text-[17px] leading-tight font-bold tabular-nums",
                selected ? "text-[#007AFF]" : segment.accent
              )}
            >
              {counts[segment.key]}
            </span>
            <span className="max-w-full truncate text-xs leading-tight text-[#8E8E93] tabular-nums">
              {formatCurrency(totals[segment.key])}
            </span>
          </button>
        )
      })}
    </div>
  )
}
