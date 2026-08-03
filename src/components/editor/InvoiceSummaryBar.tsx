import { formatCurrency } from "@/lib/invoice"
import { Button } from "@/components/ui/button"
import { Eye, Save, List, Loader2 } from "lucide-react"

export type InvoiceSummaryBarProps = {
  total: number
  lineCount: number
  isSyncing: boolean
  authReady: boolean
  onSave: () => void
  onExport: () => void
  onOpenCatalog?: () => void
}

export function InvoiceSummaryBar({
  total,
  lineCount,
  isSyncing,
  authReady,
  onSave,
  onExport,
  onOpenCatalog,
}: InvoiceSummaryBarProps) {
  // Czech pluralization for items
  const itemLabel =
    lineCount === 1 ? "položka" : lineCount >= 2 && lineCount <= 4 ? "položky" : "položek"

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/90 backdrop-blur-xl border-t pb-[env(safe-area-inset-bottom)]">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Total & Summary */}
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Celkem ({lineCount} {itemLabel})
          </span>
          <span className="text-xl font-bold tracking-tight text-foreground">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onOpenCatalog && (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-full shadow-sm"
              onClick={onOpenCatalog}
            >
              <List className="h-5 w-5" />
              <span className="sr-only">Ceník</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full shadow-sm"
            onClick={onExport}
          >
            <Eye className="h-5 w-5" />
            <span className="sr-only">Náhled PDF</span>
          </Button>

          <Button
            className="h-11 px-5 rounded-full shadow-sm"
            onClick={onSave}
            disabled={!authReady || isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Uložit
          </Button>
        </div>
      </div>
    </div>
  )
}
