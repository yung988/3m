import { type ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { BottomTabBar } from "@/components/layout/BottomTabBar"
import { MobileHeader } from "@/components/layout/MobileHeader"
import { cn } from "@/lib/utils"

export type AppView = "dashboard" | "invoices" | "editor" | "bank"

type AppShellProps = {
  /** Currently active view/tab */
  activeView: AppView
  /** Switch to a different view */
  onViewChange: (view: AppView) => void
  /** Page title shown in the mobile header */
  title: string
  /** Optional subtitle below the title */
  subtitle?: string
  /** Actions rendered on the right side of the header */
  headerRight?: ReactNode
  /** Actions rendered on the left side of the header (e.g. back button) */
  headerLeft?: ReactNode
  /** Invoice number currently being edited (shown on editor tab) */
  invoiceNumber?: string
  /** Whether the draft has unsaved changes */
  hasUnsavedChanges?: boolean
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
  title,
  subtitle,
  headerRight,
  headerLeft,
  invoiceNumber,
  hasUnsavedChanges,
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
          "flex-1 pb-20 lg:pb-0",
          className
        )}
      >
        {children}
      </main>

      {/* iOS-style bottom tab bar – mobile only */}
      <BottomTabBar
        activeView={activeView}
        onViewChange={(v) => onViewChange(v as AppView)}
        invoiceNumber={invoiceNumber}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <Toaster />
    </div>
  )
}
