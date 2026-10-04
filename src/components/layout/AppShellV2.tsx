import { type ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { BottomTabBar } from "@/components/layout/BottomTabBar"
import { MobileHeader } from "@/components/layout/MobileHeader"
import { cn } from "@/lib/utils"

export type AppView = "dashboard" | "invoices" | "editor" | "bank" | "settings"

type AppShellProps = {
  /** Currently active view/tab */
  activeView: AppView
  /** Switch to a different view */
  onViewChange: (view: AppView) => void
  /** Start a new invoice (Nový tab action) */
  onNewInvoice: () => void
  /** Page title shown in the mobile header */
  title: string
  /** Optional subtitle below the title */
  subtitle?: string
  /** Actions rendered on the right side of the header */
  headerRight?: ReactNode
  /** Actions rendered on the left side of the header (e.g. back button) */
  headerLeft?: ReactNode
  /** Hide the mobile bottom tab bar (focused flows: editor, preview, catalog) */
  hideTabBar?: boolean
  /** Main content */
  children: ReactNode
  /** Extra class names for the content wrapper */
  className?: string
}

/**
 * Top-level layout shell providing:
 * - iOS-style mobile header (sticky top)
 * - Main scrollable content area
 * - iOS-style bottom tab bar (mobile only)
 * - Toast notifications
 */
export function AppShellV2({
  activeView,
  onViewChange,
  onNewInvoice,
  title,
  subtitle,
  headerRight,
  headerLeft,
  hideTabBar = false,
  children,
  className,
}: AppShellProps) {
  return (
    <div className="app-cockpit flex min-h-svh flex-col text-foreground">
      {/* Mobile header */}
      <MobileHeader
        title={title}
        subtitle={subtitle}
        leftAction={headerLeft}
        rightAction={headerRight}
      />

      {/* Scrollable content – padded for bottom tab bar on mobile */}
      <main
        className={cn(
          "flex-1 pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0",
          className
        )}
      >
        {children}
      </main>

      {/* iOS-style bottom tab bar – mobile only, hidden during focused flows */}
      {hideTabBar ? null : (
        <BottomTabBar
          activeView={activeView}
          onViewChange={(v) => onViewChange(v as AppView)}
          onNewInvoice={onNewInvoice}
        />
      )}

      <Toaster />
    </div>
  )
}
