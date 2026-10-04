import { FileText, Landmark, Plus, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export type BottomTabBarProps = {
  activeView: string
  onViewChange: (view: string) => void
  onNewInvoice: () => void
}

export function BottomTabBar({
  activeView,
  onViewChange,
  onNewInvoice,
}: BottomTabBarProps) {
  const tabs = [
    { id: "invoices", label: "Faktury", icon: FileText },
    { id: "nova", label: "Nová", icon: Plus },
    { id: "bank", label: "Platby", icon: Landmark },
    { id: "settings", label: "Nastavení", icon: Settings },
  ]

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 flex border-t border-[rgba(60,60,67,0.18)] bg-[#F2F2F7]/80 pr-[env(safe-area-inset-right)] pb-[max(env(safe-area-inset-bottom),0.25rem)] pl-[env(safe-area-inset-left)] backdrop-blur-xl lg:hidden">
      {tabs.map((tab) => {
        const isActive = activeView === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (tab.id === "nova") {
                onNewInvoice()
              } else {
                onViewChange(tab.id)
              }
            }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex h-14 flex-1 flex-col items-center justify-center gap-[3px] transition-transform active:scale-95",
              isActive
                ? "text-[#007AFF]"
                : "text-[#6E6E73] hover:text-[#1C1C1E]"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] leading-none font-medium">
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
