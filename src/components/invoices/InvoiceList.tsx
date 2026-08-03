import { useState, useMemo } from 'react'
import { Search as SearchIcon, X as XIcon } from 'lucide-react'
import { InvoiceCard } from '@/components/invoices/InvoiceCard'
import type { InvoiceSummary } from '@/lib/invoice-repository'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type InvoiceListProps = {
  invoices: InvoiceSummary[]
  isLoading: boolean
  activeInvoiceId?: string
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onMarkSent: (id: string) => void
  onTogglePaid: (id: string, isPaid: boolean) => void
}

const CZECH_MONTHS = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'
]

type FilterType = 'all' | 'unpaid' | 'overdue' | 'paid'

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Všechny' },
  { id: 'unpaid', label: 'Nezaplacené' },
  { id: 'overdue', label: 'Po splatnosti' },
  { id: 'paid', label: 'Zaplacené' },
]

export function InvoiceList({
  invoices,
  isLoading,
  activeInvoiceId,
  onLoad,
  onDelete,
  onDuplicate,
  onMarkSent,
  onTogglePaid,
}: InvoiceListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const filteredAndGroupedInvoices = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Filter
    const filtered = invoices.filter((inv) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchStr = `${inv.invoice_number} ${inv.customer_name || ''} ${inv.project_title || ''} ${inv.project_subtitle || ''}`.toLowerCase()
        if (!searchStr.includes(query)) return false
      }

      // Chip filters
      if (activeFilter === 'unpaid') {
        if (inv.status === 'paid' || inv.status === 'cancelled') return false
      }
      if (activeFilter === 'overdue') {
        if (inv.status === 'draft' || inv.status === 'paid' || inv.status === 'cancelled') return false
        if (!inv.due_date) return false
        const dueDate = new Date(inv.due_date)
        if (dueDate >= today) return false
      }
      if (activeFilter === 'paid') {
        if (inv.status !== 'paid') return false
      }

      return true
    })

    // 2. Sort (descending by issue_date)
    filtered.sort((a, b) => {
      const dateA = a.issue_date ? new Date(a.issue_date).getTime() : 0
      const dateB = b.issue_date ? new Date(b.issue_date).getTime() : 0
      return dateB - dateA
    })

    // 3. Group by month
    const groups: { label: string; invoices: InvoiceSummary[] }[] = []
    let currentGroupLabel = ''
    let currentGroupInvoices: InvoiceSummary[] = []

    filtered.forEach((inv) => {
      let label = 'Bez data'
      if (inv.issue_date) {
        const d = new Date(inv.issue_date)
        if (!isNaN(d.getTime())) {
          const monthName = CZECH_MONTHS[d.getMonth()]
          const year = d.getFullYear()
          // Capitalize first letter of month
          const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
          label = `${capitalizedMonth} ${year}`
        }
      }

      if (label !== currentGroupLabel) {
        if (currentGroupInvoices.length > 0) {
          groups.push({ label: currentGroupLabel, invoices: currentGroupInvoices })
        }
        currentGroupLabel = label
        currentGroupInvoices = [inv]
      } else {
        currentGroupInvoices.push(inv)
      }
    })

    if (currentGroupInvoices.length > 0) {
      groups.push({ label: currentGroupLabel, invoices: currentGroupInvoices })
    }

    return groups
  }, [invoices, searchQuery, activeFilter])

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Sticky Top Section: Search and Filters */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40 pb-3 pt-4 px-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Hledat fakturu…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 rounded-full h-11 text-base bg-secondary/30 border-transparent focus-visible:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-full"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 -mx-4 px-4 pb-1">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "whitespace-nowrap rounded-full min-h-[36px] px-4 text-sm font-medium transition-colors",
                activeFilter === filter.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background border border-border text-muted-foreground hover:bg-secondary/50"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 py-4 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <p>Zatím žádné faktury. Vytvoř první doklad.</p>
          </div>
        ) : filteredAndGroupedInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <p>Žádná faktura neodpovídá.</p>
          </div>
        ) : (
          filteredAndGroupedInvoices.map((group) => (
            <div key={group.label} className="space-y-3">
              {/* Month Header */}
              <div className="sticky top-[108px] z-10 py-1 bg-background/95 backdrop-blur-sm -mx-4 px-4 border-t border-border/40 first:border-t-0 mt-2 first:mt-0">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {group.label}
                </h3>
              </div>
              
              {/* Invoice Cards */}
              <div className="flex flex-col gap-3">
                {group.invoices.map((inv) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    isActive={inv.id === activeInvoiceId}
                    onTap={() => onLoad(inv.id)}
                    onMarkPaid={() => onTogglePaid(inv.id, true)}
                    onDelete={() => onDelete(inv.id)}
                    onDuplicate={() => onDuplicate(inv.id)}
                    onMarkSent={() => onMarkSent(inv.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
