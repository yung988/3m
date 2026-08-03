import { useState, useMemo } from "react"
import type { ReactNode } from "react"
import { Search, Plus, Minus, ShoppingCart, X } from "lucide-react"

import { priceList, priceCategories, categoryColors } from "@/data/price-list"
import type { PriceItem } from "@/data/price-list"
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

export type PriceCatalogSheetProps = {
  lines: InvoiceLine[]
  onAddPriceItem: (item: PriceItem) => void
  onRemovePriceItem: (item: PriceItem) => void
  trigger?: ReactNode
}

export function PriceCatalogSheet({
  lines,
  onAddPriceItem,
  onRemovePriceItem,
  trigger,
}: PriceCatalogSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Calculate total items selected
  const totalSelected = lines.reduce((acc, line) => acc + (line.quantity || 0), 0)

  // Filter items
  const filteredItems = useMemo(() => {
    return priceList.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory ? item.category === selectedCategory : true
      return matchesSearch && matchesCategory
    })
  }, [searchQuery, selectedCategory])

  const getItemQuantity = (item: PriceItem) => {
    // We match by item description as that's how it's stored in invoice lines
    const line = lines.find((l) => l.description === item.name)
    return line ? line.quantity : 0
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full h-11 justify-start text-muted-foreground rounded-xl">
            <Search className="mr-2 h-4 w-4" />
            Hledat v ceníku...
          </Button>
        )}
      </DrawerTrigger>
      
      <DrawerContent className="max-h-[88svh] flex flex-col">
        <DrawerHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5" />
              Ceník
            </DrawerTitle>
            {totalSelected > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-medium">
                {totalSelected} {totalSelected === 1 ? 'položka' : totalSelected > 1 && totalSelected < 5 ? 'položky' : 'položek'}
              </Badge>
            )}
          </div>
          
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Hledat položku..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-12 text-base rounded-xl bg-muted/50 border-transparent focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mt-4 pt-1 no-scrollbar -mx-4 px-4 snap-x">
            <Badge 
              variant={selectedCategory === null ? "default" : "secondary"}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium cursor-pointer whitespace-nowrap transition-colors snap-start",
                selectedCategory === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent"
              )}
              onClick={() => setSelectedCategory(null)}
            >
              Vše
            </Badge>
            {priceCategories.map((category) => (
              <Badge 
                key={category}
                variant={selectedCategory === category ? "default" : "secondary"}
                className={cn(
                  "h-9 px-4 rounded-full text-sm font-medium cursor-pointer whitespace-nowrap transition-colors snap-start",
                  selectedCategory === category 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent"
                )}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe-offset-4">
          {filteredItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Search className="h-10 w-10 mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground">Nebyly nalezeny žádné položky</p>
              <p className="text-sm mt-1">Zkuste změnit hledaný výraz nebo kategorii</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const quantity = getItemQuantity(item)
              const hasQuantity = quantity > 0
              
              const colorClass = (categoryColors as Record<string, string>)[item.category] || "bg-muted"

              return (
                <div 
                  key={`${item.name}-${index}`}
                  className={cn(
                    "flex flex-col p-4 rounded-2xl border transition-all duration-200",
                    hasQuantity ? "border-primary/50 bg-primary/5 shadow-sm" : "border-transparent bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full text-white", colorClass)}>
                          {item.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-base leading-snug">{item.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1 flex gap-1 items-center">
                        <span className="font-semibold text-foreground">{formatCurrency(item.price)}</span>
                        <span className="opacity-50">/</span>
                        <span>{item.sourceUnit}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    {hasQuantity ? (
                      <div className="flex items-center bg-background rounded-full border shadow-sm w-full p-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-11 w-14 rounded-full shrink-0 text-foreground hover:bg-muted"
                          onClick={() => onRemovePriceItem(item)}
                        >
                          <Minus className="h-5 w-5" />
                        </Button>
                        <span className="flex-1 text-center font-bold text-lg tabular-nums tracking-tight">
                          {formatQuantity(quantity, item.billingUnit)}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-11 w-14 rounded-full shrink-0 text-foreground hover:bg-muted"
                          onClick={() => onAddPriceItem(item)}
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="secondary"
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base shadow-sm transition-transform active:scale-[0.98]"
                        onClick={() => onAddPriceItem(item)}
                      >
                        <Plus className="mr-2 h-5 w-5" />
                        Přidat
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
