import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MobileHeaderProps = {
  title: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  className?: string;
};

export function MobileHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full pt-[env(safe-area-inset-top)]",
        "bg-background/80 backdrop-blur-xl border-b border-border/50",
        "transition-all duration-200",
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-2 relative">
        {/* Left Action */}
        <div className="flex items-center justify-start z-10 min-w-[44px] min-h-[44px] shrink-0">
          {leftAction}
        </div>

        {/* Title Area */}
        <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none md:static md:flex-1 md:items-start md:px-4 md:pointer-events-auto">
          <h1 className="text-lg font-semibold leading-tight text-foreground truncate px-14 md:px-0 max-w-full">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate px-14 md:px-0 max-w-full mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right Action */}
        <div className="flex items-center justify-end z-10 min-w-[44px] min-h-[44px] shrink-0">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
