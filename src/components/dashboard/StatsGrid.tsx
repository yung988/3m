import { useMemo } from "react"
import type { InvoiceSummary } from "@/lib/invoice-repository"
import { formatCurrency } from "@/lib/invoice"
import {
  TrendingUpIcon,
  AlertTriangleIcon,
  ClockIcon,
  CheckCircle2Icon,
  CalendarIcon,
  CoinsIcon,
} from "lucide-react"

type StatsGridProps = {
  invoices: InvoiceSummary[]
}

function calculateDashboardStats(invoices: InvoiceSummary[]) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let paidTotal = 0
  let paidCount = 0
  let overdueTotal = 0
  let overdueCount = 0
  let pendingSendTotal = 0
  let pendingSendCount = 0
  let waitingPaymentTotal = 0
  let waitingPaymentCount = 0
  let thisMonthTotal = 0
  let thisMonthCount = 0
  let thisYearTotal = 0
  let thisYearCount = 0

  invoices.forEach((inv) => {
    const amt = Number(inv.total_amount) || 0
    const issueDate = inv.issue_date ? new Date(inv.issue_date) : null
    const dueDate = inv.due_date ? new Date(inv.due_date) : null

    // Paid
    if (inv.status === "paid") {
      paidTotal += amt
      paidCount += 1
    }

    // Overdue check
    if (
      inv.status !== "draft" &&
      inv.status !== "paid" &&
      inv.status !== "cancelled" &&
      dueDate &&
      dueDate < now
    ) {
      overdueTotal += amt
      overdueCount += 1
    } else if (inv.status === "draft") {
      pendingSendTotal += amt
      pendingSendCount += 1
    } else if (inv.status === "issued") {
      waitingPaymentTotal += amt
      waitingPaymentCount += 1
    }

    // Month & Year totals
    if (issueDate) {
      if (issueDate.getFullYear() === currentYear) {
        thisYearTotal += amt
        thisYearCount += 1
        if (issueDate.getMonth() === currentMonth) {
          thisMonthTotal += amt
          thisMonthCount += 1
        }
      }
    }
  })

  return {
    paidTotal,
    paidCount,
    overdueTotal,
    overdueCount,
    pendingSendTotal,
    pendingSendCount,
    waitingPaymentTotal,
    waitingPaymentCount,
    thisMonthTotal,
    thisMonthCount,
    thisYearTotal,
    thisYearCount,
  }
}

export function StatsGrid({ invoices }: StatsGridProps) {
  const stats = useMemo(() => calculateDashboardStats(invoices), [invoices])

  const tiles = [
    {
      title: "Zaplaceno (Doma)",
      amount: stats.paidTotal,
      subtitle: `${stats.paidCount} faktur`,
      icon: CheckCircle2Icon,
      accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Po splatnosti",
      amount: stats.overdueTotal,
      subtitle: `${stats.overdueCount} faktur vyžaduje akci`,
      icon: AlertTriangleIcon,
      accent: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    {
      title: "Čeká na platbu",
      amount: stats.waitingPaymentTotal,
      subtitle: `${stats.waitingPaymentCount} vydaných faktur`,
      icon: ClockIcon,
      accent: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Rozpracováno",
      amount: stats.pendingSendTotal,
      subtitle: `${stats.pendingSendCount} v přípravě`,
      icon: CoinsIcon,
      accent: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      title: "Tento měsíc",
      amount: stats.thisMonthTotal,
      subtitle: `${stats.thisMonthCount} faktur celkem`,
      icon: CalendarIcon,
      accent: "from-purple-500/15 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20",
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      title: "Letos celkem",
      amount: stats.thisYearTotal,
      subtitle: `${stats.thisYearCount} vystaveno letos`,
      icon: TrendingUpIcon,
      accent: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400 border-sky-500/20",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <div
            key={tile.title}
            className={`relative flex flex-col justify-between p-4 rounded-2xl bg-gradient-to-b ${tile.accent} border bg-card shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all active:scale-[0.98]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tile.title}
              </span>
              <div className={`p-2 rounded-xl ${tile.iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {formatCurrency(tile.amount)}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1 truncate">
                {tile.subtitle}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
