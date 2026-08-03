import { useState, useMemo, type ReactNode } from "react"
import {
  SearchIcon,
  PlusIcon,
  MinusIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react"
import { categoryColors, priceCategories, priceList, type PriceItem } from "@/data/price-list"
import type { InvoiceLine } from "@/lib/invoice"
import { formatCurrency, formatQuantity } from "@/lib/invoice"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type PriceCatalogSheetProps = {
  lines: InvoiceLine[]
  onAddPriceItem: (item: PriceItem) => void
  onRemovePriceItem: (item: PriceItem) => void
  trigger?: ReactNode
}

function findLineForPriceItem(lines: InvoiceLine[], item: PriceItem) {
  return lines.find(
    (line) => line.description === item.name && line.unitPrice === item.price
  )
}

export function PriceCatalogSheet({
  lines,
  onAddPriceItem,
  onRemovePriceItem,
  trigger,
}: PriceCatalogSheetProps) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("cs-CZ")

    return priceList
      .map((item, index) => ({
        index,
        item,
        selectedLine: findLineForPriceItem(lines, item),
      }))
      .filter(({ item }) => {
        const categoryMatches =
          selectedCategory === "all" || item.category === selectedCategory
        const queryMatches =
          query.length === 0 ||
          item.name.toLocaleLowerCase("cs-CZ").includes(query) ||
          item.category.toLocaleLowerCase("cs-CZ").includes(query)

        return categoryMatches && queryMatches
      })
      .sort((a, b) => {
        const selectedOrder =
          Number(Boolean(b.selectedLine)) - Number(Boolean(a.selectedLine))

        return selectedOrder || a.index - b.index
      })
  }, [lines, search, selectedCategory])

  const totalSelectedCount = useMemo(() => {
    return lines.filter((l) =>
      priceList.some((p) => p.name === l.description && p.price === l.unitPrice)
    ).length
  }, [lines])

  return (
    <Drawer>
      <DrawerTrigger asChild>
        {trigger || (
          <Button size="lg" variant="outline" className="gap-2 rounded-full shadow-sm">
            <ShoppingCartIcon className="h-5 w-5 text-primary" />
            <span>Ceník</span>
            {totalSelectedCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs font-bold">
                {totalSelectedCount}
              </Badge>
            )}
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[90svh] focus:outline-none">
        <DrawerHeader className="px-4 pt-2 pb-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingCartIcon className="h-5 w-5 text-primary" />
              Ceník prací a služeb
            </DrawerTitle>
            <Badge variant="outline" className="font-semibold">
              {filteredItems.length} položek
            </Badge>
          </div>
        </DrawerHeader>

        {/* Sticky Search and Filter Row */}
        <div className="px-4 py-3 space-y-3 border-b border-border/40">
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Hledat v ceníku..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 rounded-full h-10 bg-secondary/30 border-transparent focus-visible:ring-primary/20 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex overflow-x-auto hide-scrollbar gap-1.5 pb-1 -mx-4 px-4">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors min-h-[32px]",
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              Vše
            </button>
            {priceCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors min-h-[32px]",
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Items List */}
        <div className="overflow-y-auto p-4 space-y-2.5 max-h-[60svh] pb-8">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Žádná položka neodpovídá hledání.
            </div>
          ) : (
            filteredItems.map(({ item, selectedLine }) => {
              const isSelected = Boolean(selectedLine)
              const categoryColor = categoryColors[item.category]

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-2xl transition-all shadow-sm",
                    isSelected ? "ring-2 ring-white/60" : "hover:opacity-95"
                  )}
                  style={{
                    background: categoryColor,
                    borderColor: `color-mix(in oklch, ${categoryColor}, black 20%)`,
                  }}
                >
                  <div className="min-w-0 pr-3 flex-1">
                    <p className="text-sm font-semibold text-white leading-snug drop-shadow-sm">
                      {item.name}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-black/20 text-white font-medium">
                        {item.sourceUnit}
                      </span>
                      <span className="text-base font-bold text-white tabular-nums drop-shadow-sm">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  </div>

                  {/* Add / Stepper Actions */}
                  {selectedLine ? (
                    <div className="flex items-center gap-1 rounded-full bg-black/25 p-1 border border-white/30 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full text-white hover:bg-white/20 active:scale-95"
                        onClick={() => onRemovePriceItem(item)}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[32px] text-center text-sm font-bold text-white tabular-nums">
                        {formatQuantity(selectedLine.quantity, item.billingUnit)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full text-white hover:bg-white/20 active:scale-95"
                        onClick={() => onAddPriceItem(item)}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 active:scale-95 shrink-0"
                      onClick={() => onAddPriceItem(item)}
                    >
                      <PlusIcon className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
