import { cn } from "@/lib/utils"
import type { InvoiceSummary } from "@/lib/invoice-repository"
import { formatCurrency, formatDate } from "@/lib/invoice"

type InvoiceCardProps = {
  invoice: InvoiceSummary
  isActive?: boolean
  onTap: (id: string) => void
  onMarkPaid?: (id: string) => void
  onDelete?: (id: string) => void
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rozpracováno', color: 'oklch(0.75 0.15 55)' },
  issued: { label: 'Odesláno', color: 'oklch(0.65 0.15 240)' },
  paid: { label: 'Zaplaceno', color: 'oklch(0.7 0.17 145)' },
  overdue: { label: 'Po splatnosti', color: 'oklch(0.6 0.2 25)' },
  cancelled: { label: 'Storno', color: 'oklch(0.5 0.02 260)' },
}

export function InvoiceCard({
  invoice,
  isActive = false,
  onTap,
}: InvoiceCardProps) {
  // Determine if the invoice is overdue
  let currentStatus = invoice.status;
  if (
    currentStatus !== 'draft' && 
    currentStatus !== 'paid' && 
    currentStatus !== 'cancelled' && 
    invoice.due_date
  ) {
    if (new Date(invoice.due_date) < new Date()) {
      currentStatus = 'overdue';
    }
  }

  const config = statusConfig[currentStatus] || statusConfig.draft;

  // Decide which date to show based on available data
  const displayDate = invoice.due_date 
    ? `Splatnost: ${formatDate(invoice.due_date)}`
    : invoice.issue_date 
      ? `Vystaveno: ${formatDate(invoice.issue_date)}`
      : `Aktualizováno: ${formatDate(invoice.updated_at)}`;

  return (
    <div
      onClick={() => onTap(invoice.id)}
      className={cn(
        "relative flex flex-col p-4 mb-3 rounded-2xl bg-card shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden",
        "border border-border/50 transition-all cursor-pointer active:scale-[0.98]",
        isActive ? "ring-2 ring-primary border-transparent" : "hover:border-border"
      )}
    >
      {/* LEFT EDGE STATUS STRIP */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1" 
        style={{ backgroundColor: config.color }} 
      />

      {/* TOP ROW */}
      <div className="flex justify-between items-center mb-2 pl-1">
        <span className="font-medium text-sm text-muted-foreground">
          {invoice.invoice_number || 'Nová faktura'}
        </span>
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(Number(invoice.total_amount || 0))}
        </span>
      </div>

      {/* MIDDLE: Project title / customer */}
      <div className="pl-1 mb-4 flex flex-col">
        <span className="font-semibold text-base text-foreground truncate">
          {invoice.project_title || invoice.customer_name || 'Bez názvu'}
        </span>
        {(invoice.project_subtitle || invoice.contact_name) && (
          <span className="text-sm text-muted-foreground truncate mt-0.5">
            {invoice.project_subtitle || invoice.contact_name}
          </span>
        )}
      </div>

      {/* BOTTOM ROW */}
      <div className="pl-1 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <span 
            className="px-2.5 py-0.5 text-xs font-semibold rounded-full text-white shadow-sm"
            style={{ backgroundColor: config.color }}
          >
            {config.label}
          </span>
          {isActive && (
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-secondary text-secondary-foreground">
              Otevřená
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {displayDate}
        </span>
      </div>
    </div>
  )
}
