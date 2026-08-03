import {
  LayoutDashboard,
  FileText,
  Pencil,
  Landmark,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type BottomTabBarProps = {
  activeView: string
  onViewChange: (view: string) => void
  invoiceNumber?: string
  hasUnsavedChanges?: boolean
}

export function BottomTabBar({
  activeView,
  onViewChange,
  invoiceNumber,
  hasUnsavedChanges,
}: BottomTabBarProps) {
  const tabs = [
    {
      id: "dashboard",
      label: "Přehled",
      icon: LayoutDashboard,
    },
    {
      id: "invoices",
      label: "Faktury",
      icon: FileText,
    },
    {
      id: "editor",
      label: invoiceNumber || "Editor",
      icon: Pencil,
      hasDot: hasUnsavedChanges,
    },
    {
      id: "bank",
      label: "Banka",
      icon: Landmark,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-background/80 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-xl lg:hidden">
      {tabs.map((tab) => {
        const isActive = activeView === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={cn(
              "relative flex h-[56px] flex-1 flex-col items-center justify-center gap-1 transition-transform active:scale-95",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {tab.hasDot && (
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
