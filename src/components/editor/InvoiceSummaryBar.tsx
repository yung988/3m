import type { ReactNode } from "react"
import { formatCurrency } from "@/lib/invoice"
import { Button } from "@/components/ui/button"
import { Save, Eye, List, Loader2 } from "lucide-react"

export type InvoiceSummaryBarProps = {
  total: number
  lineCount: number
  isSyncing: boolean
  authReady: boolean
  onSave: () => void
  onExport: () => void
  catalogTrigger?: ReactNode
}

export function InvoiceSummaryBar({
  total,
  lineCount,
  isSyncing,
  authReady,
  onSave,
  onExport,
  catalogTrigger,
}: InvoiceSummaryBarProps) {
  const itemLabel =
    lineCount === 1 ? "položka" : lineCount >= 2 && lineCount <= 4 ? "položky" : "položek"

  return (
    <div className="fixed bottom-[56px] left-0 right-0 z-30 lg:hidden bg-background/90 backdrop-blur-xl border-t pb-[env(safe-area-inset-bottom)]">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 max-w-lg mx-auto">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5 truncate">
            Celkem ({lineCount} {itemLabel})
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground truncate">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {catalogTrigger || (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shadow-sm"
            >
              <List className="h-4 w-4 text-primary" />
              <span className="sr-only">Ceník</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shadow-sm"
            onClick={onExport}
            disabled={isSyncing}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Náhled PDF</span>
          </Button>

          <Button
            className="h-10 px-4 rounded-full shadow-sm gap-1.5 text-xs font-semibold"
            onClick={onSave}
            disabled={!authReady || isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Uložit
          </Button>
        </div>
      </div>
    </div>
  )
}
