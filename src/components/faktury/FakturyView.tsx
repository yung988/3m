import { useEffect, useLayoutEffect, useMemo } from "react"
import {
  Check,
  ChevronDown,
  Plus,
  Search as SearchIcon,
  X as XIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { InvoiceSummary } from "@/lib/invoice-repository"
import { FakturySummary } from "@/components/faktury/FakturySummary"
import { FakturyRow } from "@/components/faktury/FakturyRow"
import {
  FILTER_OPTIONS,
  getFilterLabel,
  getInvoiceMoneyState,
  matchesFilter,
  startOfToday,
  type FakturyFilter,
} from "@/components/faktury/invoice-states"

type FakturyViewProps = {
  invoices: InvoiceSummary[]
  isLoading: boolean
  query: string
  onQueryChange: (query: string) => void
  filter: FakturyFilter
  onFilterChange: (filter: FakturyFilter) => void
  scrollTopRef: { current: number }
  onLoad: (id: string) => void
  onNewInvoice: () => void
}

const CZECH_MONTHS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
]

function monthLabel(issueDate: string | null) {
  if (!issueDate) return "Bez data"
  const date = new Date(`${issueDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "Bez data"
  const name = CZECH_MONTHS[date.getMonth()]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}`
}

export function FakturyView({
  invoices,
  isLoading,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  scrollTopRef,
  onLoad,
  onNewInvoice,
}: FakturyViewProps) {
  const today = useMemo(() => startOfToday(), [])

  const groups = useMemo(() => {
    const filtered = invoices.filter((invoice) => {
      if (query) {
        const needle = query.toLowerCase()
        const haystack = [
          invoice.invoice_number,
          invoice.customer_name,
          invoice.project_title,
          invoice.project_subtitle,
          invoice.contact_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (!matchesFilter(invoice, filter, today)) return false
      return true
    })

    filtered.sort((a, b) =>
      (b.issue_date ?? "").localeCompare(a.issue_date ?? "")
    )

    const result: { label: string; invoices: InvoiceSummary[] }[] = []
    for (const invoice of filtered) {
      const label = monthLabel(invoice.issue_date)
      const last = result[result.length - 1]
      if (last && last.label === label) {
        last.invoices.push(invoice)
      } else {
        result.push({ label, invoices: [invoice] })
      }
    }
    return result
  }, [invoices, query, filter, today])

  useEffect(() => {
    const saveScroll = () => {
      scrollTopRef.current = window.scrollY
    }
    window.addEventListener("scroll", saveScroll, { passive: true })
    return () => window.removeEventListener("scroll", saveScroll)
  }, [scrollTopRef])

  useLayoutEffect(() => {
    window.scrollTo(0, scrollTopRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  return (
    <div className="bg-[#F2F2F7]">
      <div className="px-4 pt-3 pb-6">
        <div className="mb-3">
          <FakturySummary
            invoices={invoices}
            filter={filter}
            onFilterChange={onFilterChange}
          />
        </div>

        <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 -mx-4 border-b border-[rgba(60,60,67,0.18)] bg-[#F2F2F7]/95 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-[#8E8E93]" />
              <Input
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Hledat fakturu…"
                className="h-12 w-full rounded-lg border-transparent bg-[#F7F7FA] pr-9 pl-10 text-base focus-visible:ring-[#007AFF]/20"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Vymazat hledání"
                  onClick={() => onQueryChange("")}
                  className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8E8E93] transition-transform active:scale-90"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-12 shrink-0 items-center gap-1.5 rounded-lg bg-[#F7F7FA] px-3 text-sm font-medium text-[#1C1C1E] transition-transform active:scale-[0.98]"
                >
                  <span className="text-[#6E6E73]">Stav</span>
                  <span className="max-w-[96px] truncate">
                    {getFilterLabel(filter)}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {FILTER_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => onFilterChange(option.id)}
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      {option.label}
                      {filter === option.id ? (
                        <Check className="h-4 w-4 text-[#007AFF]" />
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3">
          {isLoading ? (
            <SkeletonRows />
          ) : invoices.length === 0 ? (
            <EmptyAccount onNewInvoice={onNewInvoice} />
          ) : groups.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-[#6E6E73]">
                Žádná faktura neodpovídá.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-1.5 px-1 text-xs font-semibold text-[#6E6E73]">
                    {group.label}
                  </h3>
                  <div className="divide-y divide-[rgba(60,60,67,0.18)] overflow-hidden rounded-xl bg-white">
                    {group.invoices.map((invoice) => (
                      <FakturyRow
                        key={invoice.id}
                        invoice={invoice}
                        state={getInvoiceMoneyState(invoice, today)}
                        onLoad={onLoad}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-[rgba(60,60,67,0.18)] overflow-hidden rounded-xl bg-white">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#F2F2F7]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#F2F2F7]" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-[#F2F2F7]" />
        </div>
      ))}
    </div>
  )
}

function EmptyAccount({ onNewInvoice }: { onNewInvoice: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-20 text-center">
      <p className="text-base text-[#6E6E73]">Zatím žádné faktury.</p>
      <Button
        onClick={onNewInvoice}
        className="h-11 rounded-lg bg-[#007AFF] px-5 text-base font-semibold text-white hover:bg-[#0062CC]"
      >
        <Plus />
        Nová faktura
      </Button>
    </div>
  )
}
