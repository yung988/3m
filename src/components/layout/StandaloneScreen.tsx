import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

type StandaloneScreenProps = {
  title: string
  children: ReactNode
  className?: string
}

export function StandaloneScreen({
  title,
  children,
  className,
}: StandaloneScreenProps) {
  return (
    <div className="app-cockpit min-h-dvh text-foreground">
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4",
          "pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]",
          "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <h1 className="text-center text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {children}
      </div>
      <Toaster />
    </div>
  )
}
