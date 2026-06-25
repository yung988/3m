import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { Session } from "@supabase/supabase-js"
import * as QRCode from "qrcode"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  CloudIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  FilePlus2Icon,
  LayoutDashboardIcon,
  LogOutIcon,
  MinusIcon,
  PencilIcon,
  PlusCircleIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { priceCategories, priceList, type PriceItem } from "@/data/price-list"
import { cn } from "@/lib/utils"
import {
  buildPaymentQrString,
  calculateTotal,
  buildInvoicePdfFileName,
  createDefaultDraft,
  createEmptyLine,
  createLineFromPriceItem,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatHoursDisplay,
  formatQuantity,
  normalizeMoneyInput,
  parseHoursInput,
  payment,
  supplier,
  type InvoiceDraft,
  type InvoiceLine,
  type InvoiceStatus,
} from "@/lib/invoice"
import {
  deleteInvoice,
  getNextInvoiceNumber,
  listInvoices,
  loadInvoice,
  markInvoiceExported,
  saveInvoice,
  setInvoicePaid,
  type InvoiceSummary,
} from "@/lib/invoice-repository"
import { missingSupabaseEnv, supabase } from "@/lib/supabase"

const STORAGE_KEY = "faktury-pro-stepu:draft:v2"

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Rozpracováno",
  issued: "Vystaveno",
  paid: "Zaplaceno",
  overdue: "Po splatnosti",
  cancelled: "Storno",
}

type AppMessage = {
  title: string
  description: string
  variant?: "default" | "destructive"
}

type AppView = "dashboard" | "editor"

type FilteredPriceItem = {
  item: PriceItem
  selectedLine: InvoiceLine | undefined
}

function isLineForPriceItem(line: InvoiceLine, item: PriceItem) {
  return (
    line.description === item.name &&
    line.unitPrice === item.price &&
    line.unitLabel === item.billingUnit
  )
}

function findLineForPriceItem(lines: InvoiceLine[], item: PriceItem) {
  return lines.find((line) => isLineForPriceItem(line, item))
}

function App() {
  const [draft, setDraft] = useState<InvoiceDraft>(() => readStoredDraft())
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [savedInvoices, setSavedInvoices] = useState<InvoiceSummary[]>([])
  const [savedInvoicesLoading, setSavedInvoicesLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<AppMessage | null>(null)
  const [view, setView] = useState<AppView>("dashboard")
  const [previewVisible, setPreviewVisible] = useState(false)

  const total = useMemo(() => calculateTotal(draft.lines), [draft.lines])
  const user = session?.user ?? null
  const databaseIsConfigured = supabase !== null
  const exportFileName = useMemo(() => buildInvoicePdfFileName(draft), [draft])
  const paymentQrString = useMemo(
    () => buildPaymentQrString(draft, total),
    [draft, total]
  )

  const filteredItems = useMemo<FilteredPriceItem[]>(() => {
    const query = search.trim().toLocaleLowerCase("cs-CZ")

    return priceList
      .map((item, index) => ({
        index,
        item,
        selectedLine: findLineForPriceItem(draft.lines, item),
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
      .map(({ item, selectedLine }) => ({ item, selectedLine }))
  }, [draft.lines, search, selectedCategory])

  const showError = useCallback((title: string, error: unknown) => {
    setMessage({
      title,
      description:
        error instanceof Error ? error.message : "Zkus akci zopakovat.",
      variant: "destructive",
    })
  }, [])

  const refreshSavedInvoices = useCallback(async () => {
    try {
      setSavedInvoicesLoading(true)
      setSavedInvoices(await listInvoices())
    } catch (error) {
      showError("Nepodařilo se načíst faktury", error)
    } finally {
      setSavedInvoicesLoading(false)
    }
  }, [showError])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      setSession(data.session)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
      if (!nextSession) {
        setSavedInvoices([])
        setView("dashboard")
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user) {
      void Promise.resolve().then(refreshSavedInvoices)
    }
  }, [refreshSavedInvoices, user])

  useEffect(() => {
    let isCurrent = true

    QRCode.toDataURL(paymentQrString, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    })
      .then((url) => {
        if (isCurrent) {
          setQrDataUrl(url)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setQrDataUrl("")
        }
      })

    return () => {
      isCurrent = false
    }
  }, [paymentQrString])

  function updateDraftField<K extends keyof InvoiceDraft>(
    key: K,
    value: InvoiceDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function updateInvoiceStatus(status: InvoiceStatus) {
    const nextPaidAt =
      status === "paid"
        ? draft.paidAt || new Date().toISOString().slice(0, 10)
        : null

    setDraft((current) => ({
      ...current,
      status,
      paidAt: nextPaidAt,
    }))
  }

  function addLine(line: InvoiceLine) {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, line],
    }))
  }

  function addPriceItem(item: PriceItem) {
    setDraft((current) => {
      const existingLine = findLineForPriceItem(current.lines, item)

      if (!existingLine) {
        return {
          ...current,
          lines: [...current.lines, createLineFromPriceItem(item)],
        }
      }

      return {
        ...current,
        lines: current.lines.map((line) =>
          line.id === existingLine.id
            ? { ...line, quantity: line.quantity + item.defaultQuantity }
            : line
        ),
      }
    })
  }

  function removePriceItem(item: PriceItem) {
    setDraft((current) => {
      const existingLine = findLineForPriceItem(current.lines, item)

      if (!existingLine) {
        return current
      }

      const nextQuantity = existingLine.quantity - item.defaultQuantity

      if (nextQuantity <= 0) {
        return {
          ...current,
          lines: current.lines.filter((line) => line.id !== existingLine.id),
        }
      }

      return {
        ...current,
        lines: current.lines.map((line) =>
          line.id === existingLine.id
            ? { ...line, quantity: nextQuantity }
            : line
        ),
      }
    })
  }

  function updateLine(id: string, changes: Partial<InvoiceLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.id === id ? { ...line, ...changes } : line
      ),
    }))
  }

  function removeLine(id: string) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== id),
    }))
  }

  function resetDraft() {
    if (
      window.confirm("Vrátit prázdnou novou fakturu a smazat rozepsané změny?")
    ) {
      setDraft(createDefaultDraft())
    }
  }

  async function handleAuth() {
    if (!supabase) {
      setMessage({
        title: "Chybí nastavení Supabase",
        description: `Doplň env proměnné ${missingSupabaseEnv.join(", ")} a znovu nasaď aplikaci.`,
        variant: "destructive",
      })
      return
    }

    setAuthLoading(true)
    setMessage(null)

    try {
      const credentials = {
        email: authEmail.trim(),
        password: authPassword,
      }
      const { error } = await supabase.auth.signInWithPassword(credentials)

      if (error) {
        throw error
      }

      setMessage({
        title: "Přihlášeno",
        description: "Faktury se teď můžou ukládat do Supabase.",
      })
    } catch (error) {
      showError("Přihlášení selhalo", error)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      showError("Odhlášení selhalo", error)
      return
    }

    setMessage({
      title: "Odhlášeno",
      description: "Rozpracovaná faktura zůstává uložená lokálně v prohlížeči.",
    })
  }

  async function handleSaveInvoice() {
    if (!user) {
      setMessage({
        title: databaseIsConfigured
          ? "Nejdřív se přihlas"
          : "Chybí nastavení Supabase",
        description: databaseIsConfigured
          ? "Bez přihlášení můžeš fakturu sestavit a tisknout, ale ne uložit do databáze."
          : `Bez env proměnných ${missingSupabaseEnv.join(", ")} nejde ukládat do databáze.`,
        variant: "destructive",
      })
      return
    }

    try {
      setSyncing(true)
      const savedDraft = await saveInvoice(draft, user)
      setDraft(savedDraft)
      await refreshSavedInvoices()
      setMessage({
        title: "Faktura uložena",
        description: `Doklad ${savedDraft.invoiceNumber} je uložený v Supabase.`,
      })
    } catch (error) {
      showError("Uložení faktury selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleLoadInvoice(id: string) {
    try {
      setSyncing(true)
      setDraft(await loadInvoice(id))
      setView("editor")
      setPreviewVisible(false)
      setMessage({
        title: "Faktura načtena",
        description: "Uložený doklad se propsal do editoru.",
      })
    } catch (error) {
      showError("Načtení faktury selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDeleteInvoice(id: string) {
    if (!window.confirm("Smazat uloženou fakturu z databáze?")) {
      return
    }

    try {
      setSyncing(true)
      await deleteInvoice(id)

      if (draft.id === id) {
        setDraft(createDefaultDraft())
        setView("dashboard")
      }

      await refreshSavedInvoices()
      setMessage({
        title: "Faktura smazána",
        description: "Doklad a jeho řádky byly odstraněné ze Supabase.",
      })
    } catch (error) {
      showError("Mazání faktury selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleTogglePaid(id: string, isPaid: boolean) {
    try {
      setSyncing(true)
      const updatedDraft = await setInvoicePaid(id, isPaid)

      if (draft.id === id) {
        setDraft(updatedDraft)
      }

      await refreshSavedInvoices()
      setMessage({
        title: isPaid
          ? "Faktura označena jako zaplacená"
          : "Faktura označena jako nezaplacená",
        description: `Doklad ${updatedDraft.invoiceNumber} byl aktualizovaný.`,
      })
    } catch (error) {
      showError("Změna platby selhala", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleExportInvoice() {
    if (!previewVisible) {
      setPreviewVisible(true)
      setMessage({
        title: "Zkontroluj náhled",
        description:
          "Faktura je teď zobrazená přes celou obrazovku. Pokud sedí, klikni v náhledu na Export / PDF.",
      })
      return
    }

    if (!user) {
      setMessage({
        title: "Export bez databázového záznamu",
        description:
          "Tisk se spustí, ale stav exportu se uloží až u přihlášené a uložené faktury.",
      })
      printInvoicePdf(draft)
      return
    }

    try {
      setSyncing(true)
      const savedDraft = await saveInvoice(draft, user)
      const exportedDraft = await markInvoiceExported(savedDraft.id!)
      setDraft(exportedDraft)
      await refreshSavedInvoices()
      setMessage({
        title: "Faktura označena jako exportovaná",
        description: `Doklad ${exportedDraft.invoiceNumber} má uložený čas exportu. Název PDF: ${buildInvoicePdfFileName(exportedDraft)}`,
      })
      printInvoicePdf(exportedDraft)
    } catch (error) {
      showError("Export faktury selhal", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleNewInvoice() {
    const nextDraft = createDefaultDraft()
    try {
      nextDraft.invoiceNumber = await getNextInvoiceNumber()
    } catch {
      // fallback — already set in createDefaultDraft
    }
    setDraft(nextDraft)
    setView("editor")
    setPreviewVisible(false)
    setMessage({
      title: "Nová faktura",
      description: `Editor je připravený pro doklad ${nextDraft.invoiceNumber}.`,
    })
  }

  async function handleDuplicateInvoice(id: string) {
    try {
      setSyncing(true)
      const loaded = await loadInvoice(id)
      let nextNumber = loaded.invoiceNumber
      try {
        nextNumber = await getNextInvoiceNumber()
      } catch {
        // fallback
      }
      const issueDate = new Date().toISOString().slice(0, 10)
      const due = new Date()
      due.setDate(due.getDate() + 21)
      setDraft({
        ...loaded,
        id: undefined,
        invoiceNumber: nextNumber,
        issueDate,
        dueDate: due.toISOString().slice(0, 10),
        status: "draft",
        paidAt: null,
        exportedAt: null,
        exportCount: 0,
      })
      setView("editor")
      setPreviewVisible(false)
      setMessage({
        title: "Faktura duplikována",
        description: `Kopie dokladu je připravená v editoru jako ${nextNumber}.`,
      })
    } catch (error) {
      showError("Duplikování faktury selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  const dashboardActions = user ? (
    <>
      <Button onClick={handleNewInvoice}>
        <PlusCircleIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Nová faktura</span>
        <span className="sm:hidden">Nová</span>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" onClick={handleSignOut}>
            <LogOutIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Odhlásit</TooltipContent>
      </Tooltip>
    </>
  ) : null

  const editorActions = user ? (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView("dashboard")}
          >
            <LayoutDashboardIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Přehled faktur</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" onClick={handleNewInvoice}>
            <PlusCircleIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Nová faktura</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPreviewVisible((current) => !current)}
          >
            {previewVisible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {previewVisible ? "Skrýt náhled" : "Zobrazit náhled"}
        </TooltipContent>
      </Tooltip>
      <Button onClick={handleSaveInvoice} disabled={syncing || !authReady}>
        <SaveIcon data-icon="inline-start" />
        {syncing ? "Ukládám…" : "Uložit"}
      </Button>
      <Button onClick={handleExportInvoice} disabled={syncing}>
        <PrinterIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Export / PDF</span>
        <span className="sm:hidden">PDF</span>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" onClick={resetDraft}>
            <RotateCcwIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset faktury</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" onClick={handleSignOut}>
            <LogOutIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Odhlásit</TooltipContent>
      </Tooltip>
    </>
  ) : null

  if (!authReady) {
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[calc(100svh-88px)] max-w-lg flex-col justify-center p-4">
          <Card>
            <CardHeader>
              <CardTitle>Načítám přihlášení</CardTitle>
              <CardDescription>
                Kontroluji relaci Supabase v prohlížeči.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </AppShell>
    )
  }

  if (!user) {
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[calc(100svh-88px)] max-w-lg flex-col justify-center gap-4 p-4">
          {message ? <MessageAlert message={message} /> : null}
          <AuthCard
            email={authEmail}
            isLoading={authLoading}
            missingEnv={missingSupabaseEnv}
            onEmailChange={setAuthEmail}
            onPasswordChange={setAuthPassword}
            onSubmit={handleAuth}
            password={authPassword}
          />
        </main>
      </AppShell>
    )
  }

  if (view === "dashboard") {
    return (
      <AppShell actions={dashboardActions} userEmail={user.email}>
        <main className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
          {message ? <MessageAlert message={message} /> : null}
          <InvoiceStatsCard invoices={savedInvoices} />
          <SavedInvoicesCard
            activeInvoiceId={draft.id}
            invoices={savedInvoices}
            isLoading={savedInvoicesLoading}
            onDelete={handleDeleteInvoice}
            onDuplicate={handleDuplicateInvoice}
            onLoad={handleLoadInvoice}
            onTogglePaid={handleTogglePaid}
          />
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell actions={editorActions} userEmail={user.email}>
      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        {/* Invoice form — DOM first so mobile shows it before the price list */}
        <Card className="no-print h-fit lg:order-2">
          <CardHeader>
            <CardTitle>Rozpis faktury</CardTitle>
            <CardDescription>
              Čísla a texty se ukládají do Supabase po kliknutí na Uložit.
            </CardDescription>
            <CardAction>
              <div className="flex gap-2">
                <a
                  href="#cenik-sekce"
                  className="lg:hidden inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                >
                  <ShoppingCartIcon className="size-4" />
                  Ceník
                </a>
                <Button
                  variant="outline"
                  onClick={() => addLine(createEmptyLine())}
                >
                  <FilePlus2Icon data-icon="inline-start" />
                  <span className="hidden sm:inline">Vlastní položka</span>
                  <span className="sm:hidden">Vlastní</span>
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {message ? (
              <Alert variant={message.variant}>
                <AlertTitle>{message.title}</AlertTitle>
                <AlertDescription>{message.description}</AlertDescription>
              </Alert>
            ) : null}

            <FieldSet>
              <FieldGroup className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="invoice-number">
                    Číslo faktury
                  </FieldLabel>
                  <Input
                    id="invoice-number"
                    value={draft.invoiceNumber}
                    onChange={(event) =>
                      updateDraftField("invoiceNumber", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="issue-date">Vystaveno</FieldLabel>
                  <Input
                    id="issue-date"
                    type="date"
                    value={draft.issueDate}
                    onChange={(event) =>
                      updateDraftField("issueDate", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="due-date">Splatnost</FieldLabel>
                  <Input
                    id="due-date"
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) =>
                      updateDraftField("dueDate", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Stav</FieldLabel>
                  <Select
                    value={draft.status}
                    onValueChange={(value) =>
                      updateInvoiceStatus(value as InvoiceStatus)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Vybrat stav" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="project-title">
                    Text fakturace
                  </FieldLabel>
                  <Input
                    id="project-title"
                    value={draft.projectTitle}
                    onChange={(event) =>
                      updateDraftField("projectTitle", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-subtitle">
                    Místo / doplněk
                  </FieldLabel>
                  <Input
                    id="project-subtitle"
                    value={draft.projectSubtitle}
                    onChange={(event) =>
                      updateDraftField("projectSubtitle", event.target.value)
                    }
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="grid gap-3 grid-cols-2">
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BanknoteIcon data-icon="inline-start" />
                  Platba
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {draft.status === "paid"
                    ? `Zaplaceno${draft.paidAt ? ` ${formatDate(draft.paidAt)}` : ""}`
                    : "Nezaplaceno"}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PrinterIcon data-icon="inline-start" />
                  Export
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {draft.exportedAt
                    ? `${formatDateTime(draft.exportedAt)}`
                    : "Neexportováno"}
                </p>
              </div>
            </div>

            <Separator />

            <FieldSet>
              <FieldGroup className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Field>
                  <FieldLabel htmlFor="customer-name">Odběratel</FieldLabel>
                  <Input
                    id="customer-name"
                    value={draft.customerName}
                    onChange={(event) =>
                      updateDraftField("customerName", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customer-address">Adresa</FieldLabel>
                  <Textarea
                    id="customer-address"
                    value={draft.customerAddress}
                    className="min-h-20 resize-y"
                    onChange={(event) =>
                      updateDraftField("customerAddress", event.target.value)
                    }
                  />
                </Field>
              </FieldGroup>
              <FieldGroup className="grid gap-4 grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="customer-id">IČO</FieldLabel>
                  <Input
                    id="customer-id"
                    value={draft.customerCompanyId}
                    onChange={(event) =>
                      updateDraftField("customerCompanyId", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customer-tax-id">DIČ</FieldLabel>
                  <Input
                    id="customer-tax-id"
                    value={draft.customerTaxId}
                    onChange={(event) =>
                      updateDraftField("customerTaxId", event.target.value)
                    }
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-medium">Položky</h2>
                <Badge variant="secondary">{draft.lines.length} položek</Badge>
              </div>

              {draft.lines.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Přidej položku z ceníku nebo vlastní řádek.
                </div>
              ) : null}

              {/* Mobile: card per line item */}
              {draft.lines.length > 0 ? (
                <div className="flex flex-col gap-3 md:hidden">
                  {draft.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex flex-col gap-3 rounded-lg border p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Textarea
                          value={line.description}
                          className="min-h-14 flex-1 resize-y text-sm"
                          onChange={(event) =>
                            updateLine(line.id, {
                              description: event.target.value,
                            })
                          }
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          aria-label="Odebrat položku"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Field>
                          <FieldLabel>
                            {line.unitLabel === "hod" ? "h:mm" : "Množství"}
                          </FieldLabel>
                          {line.unitLabel === "hod" ? (
                            <HoursInput
                              value={line.quantity}
                              className="text-right"
                              onChange={(v) =>
                                updateLine(line.id, { quantity: v })
                              }
                            />
                          ) : (
                            <Input
                              inputMode="decimal"
                              value={line.quantity}
                              className="text-right"
                              onChange={(event) =>
                                updateLine(line.id, {
                                  quantity: normalizeMoneyInput(
                                    event.target.value
                                  ),
                                })
                              }
                            />
                          )}
                        </Field>
                        <Field>
                          <FieldLabel>Jedn.</FieldLabel>
                          <Input
                            value={line.unitLabel}
                            placeholder="ks"
                            onChange={(event) =>
                              updateLine(line.id, {
                                unitLabel: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Cena / j.</FieldLabel>
                          <Input
                            inputMode="decimal"
                            value={line.unitPrice}
                            className="text-right"
                            onChange={(event) =>
                              updateLine(line.id, {
                                unitPrice: normalizeMoneyInput(
                                  event.target.value
                                ),
                              })
                            }
                          />
                        </Field>
                      </div>
                      <p className="text-right text-sm font-medium">
                        Celkem:{" "}
                        {formatCurrency(line.quantity * line.unitPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Desktop: table */}
              {draft.lines.length > 0 ? (
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-80">Popis</TableHead>
                        <TableHead className="w-24 text-right">
                          Množství
                        </TableHead>
                        <TableHead className="w-20">Jedn.</TableHead>
                        <TableHead className="w-32 text-right">Cena</TableHead>
                        <TableHead className="w-32 text-right">
                          Celkem
                        </TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="min-w-80 whitespace-normal">
                            <Textarea
                              value={line.description}
                              className="min-h-16 resize-y"
                              onChange={(event) =>
                                updateLine(line.id, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {line.unitLabel === "hod" ? (
                              <HoursInput
                                value={line.quantity}
                                className="text-right"
                                onChange={(v) =>
                                  updateLine(line.id, { quantity: v })
                                }
                              />
                            ) : (
                              <Input
                                inputMode="decimal"
                                value={line.quantity}
                                className="text-right"
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    quantity: normalizeMoneyInput(
                                      event.target.value
                                    ),
                                  })
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.unitLabel}
                              placeholder="ks"
                              onChange={(event) =>
                                updateLine(line.id, {
                                  unitLabel: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              value={line.unitPrice}
                              className="text-right"
                              onChange={(event) =>
                                updateLine(line.id, {
                                  unitPrice: normalizeMoneyInput(
                                    event.target.value
                                  ),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(line.quantity * line.unitPrice)}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Odebrat položku"
                                  onClick={() => removeLine(line.id)}
                                >
                                  <Trash2Icon data-icon="inline-start" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Odebrat</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-1 rounded-lg bg-secondary p-4 text-right">
              <span className="text-sm text-muted-foreground">K úhradě</span>
              <strong className="text-3xl font-semibold">
                {formatCurrency(total)}
              </strong>
            </div>
          </CardContent>
        </Card>

        {/* Price list — DOM second so mobile shows it after the form */}
        <div
          id="cenik-sekce"
          className="no-print flex h-fit flex-col gap-4 scroll-mt-20 lg:order-1 lg:sticky lg:top-24"
        >
          <Card>
            <CardHeader>
              <CardTitle>Ceník úkonů</CardTitle>
              <CardDescription>
                Položka se přidá na fakturu jedním kliknutím.
              </CardDescription>
              <CardAction>
                <a
                  href="#invoice-number"
                  className="lg:hidden inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                >
                  ↑ Zpět
                </a>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="price-search">Hledat</FieldLabel>
                  <Input
                    id="price-search"
                    value={search}
                    placeholder="např. SSR, doprava, EMR"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Kategorie</FieldLabel>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Vybrat kategorii" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Všechny položky</SelectItem>
                        {priceCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <div className="lg:max-h-[62svh] lg:overflow-y-auto pr-1">
                {filteredItems.length > 0 ? (
                  <ul className="flex flex-col">
                    {filteredItems.map(({ item, selectedLine }) => {
                      const isSelected = Boolean(selectedLine)

                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-2 py-3 last:border-b-0",
                            isSelected && "bg-muted/45"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm leading-snug font-medium">
                              {item.name}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{item.sourceUnit}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(item.price)}
                              </span>
                              {selectedLine ? (
                                <Badge variant="secondary">na faktuře</Badge>
                              ) : null}
                            </div>
                          </div>
                          {selectedLine ? (
                            <div className="flex h-10 shrink-0 items-center gap-1 rounded-md border bg-background p-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Ubrat: ${item.name}`}
                                onClick={() => removePriceItem(item)}
                              >
                                <MinusIcon data-icon="inline-start" />
                              </Button>
                              <span className="min-w-12 text-center text-sm font-semibold tabular-nums">
                                {formatQuantity(
                                  selectedLine.quantity,
                                  item.billingUnit
                                )}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Přidat: ${item.name}`}
                                onClick={() => addPriceItem(item)}
                              >
                                <PlusIcon data-icon="inline-start" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="outline"
                              aria-label={`Přidat: ${item.name}`}
                              onClick={() => addPriceItem(item)}
                            >
                              <PlusIcon data-icon="inline-start" />
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Nic nenalezeno. Zkus kratší hledaný výraz nebo jinou
                    kategorii.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      {previewVisible ? (
        <InvoicePreviewOverlay
          draft={draft}
          fileName={exportFileName}
          isExporting={syncing}
          qrDataUrl={qrDataUrl}
          total={total}
          onClose={() => setPreviewVisible(false)}
          onExport={handleExportInvoice}
        />
      ) : null}
    </AppShell>
  )
}

function AppShell({
  actions,
  children,
  userEmail,
}: {
  actions?: ReactNode
  children: ReactNode
  userEmail?: string
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 shrink">
            <div className="flex items-center gap-2">
              <h1 className="text-lg leading-tight font-semibold sm:text-2xl">
                Faktury pro Štěpu
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                3M ENERGY
              </Badge>
            </div>
            {userEmail ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {userEmail}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  )
}

function MessageAlert({ message }: { message: AppMessage }) {
  return (
    <Alert variant={message.variant}>
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>{message.description}</AlertDescription>
    </Alert>
  )
}

function AuthCard({
  email,
  isLoading,
  missingEnv,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  password,
}: {
  email: string
  isLoading: boolean
  missingEnv: string[]
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  password: string
}) {
  const hasMissingEnv = missingEnv.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Databáze</CardTitle>
        <CardDescription>
          Přihlášení zapne ukládání faktur do Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasMissingEnv ? (
          <Alert variant="destructive">
            <AlertTitle>Chybí env proměnné</AlertTitle>
            <AlertDescription>
              Na Vercelu doplň {missingEnv.join(", ")} a spusť nový deploy.
              Editor půjde používat lokálně, ale ukládání do databáze nebude
              dostupné.
            </AlertDescription>
          </Alert>
        ) : null}
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="auth-email">E-mail</FieldLabel>
              <Input
                id="auth-email"
                autoComplete="email"
                inputMode="email"
                required
                type="email"
                value={email}
                disabled={hasMissingEnv}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="auth-password">Heslo</FieldLabel>
              <Input
                id="auth-password"
                autoComplete="current-password"
                minLength={6}
                required
                type="password"
                value={password}
                disabled={hasMissingEnv}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={isLoading || hasMissingEnv}>
            <CloudIcon data-icon="inline-start" />
            Přihlásit
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function InvoiceStatsCard({ invoices }: { invoices: InvoiceSummary[] }) {
  const stats = useMemo(() => createInvoiceStats(invoices), [invoices])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDollarSignIcon data-icon="inline-start" />
          Přehled
        </CardTitle>
        <CardDescription>Rychlý stav uložených faktur.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Doma"
            value={formatCurrency(stats.paidTotal)}
            detail={`${formatInvoiceCount(stats.paidCount)} zaplaceno`}
          />
          <StatTile
            label="Nezaplaceno"
            value={formatCurrency(stats.unpaidTotal)}
            detail={`${formatInvoiceCount(stats.unpaidCount)} otevřeno`}
          />
          <StatTile
            label="Čeká na export"
            value={formatCurrency(stats.waitingExportTotal)}
            detail={formatInvoiceCount(stats.waitingExportCount)}
          />
          <StatTile
            label="Čeká na platbu"
            value={formatCurrency(stats.waitingPaymentTotal)}
            detail={formatInvoiceCount(stats.waitingPaymentCount)}
          />
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {formatInvoiceCount(invoices.length)} celkem
          </Badge>
          <Badge variant="outline">
            {formatInvoiceCount(stats.cancelledCount)} storno
          </Badge>
          <Badge variant="outline">
            {formatCurrency(stats.activeTotal)} aktivně v oběhu
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function StatTile({
  detail,
  label,
  value,
}: {
  detail: string
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-base leading-tight font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

type SortKey =
  | "invoice_number"
  | "project_title"
  | "project_subtitle"
  | "issue_date"
  | "due_date"
  | "total_amount"
  | "status"
  | "exported_at"

type SortDir = "asc" | "desc"

const statusVariant: Record<
  InvoiceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  issued: "secondary",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button
      type="button"
      className="flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : (
          <ArrowDownIcon className="size-3.5" />
        )
      ) : (
        <ArrowUpDownIcon className="size-3.5 opacity-40" />
      )}
    </button>
  )
}

function SavedInvoicesCard({
  activeInvoiceId,
  invoices,
  isLoading,
  onDelete,
  onDuplicate,
  onLoad,
  onTogglePaid,
}: {
  activeInvoiceId?: string
  invoices: InvoiceSummary[]
  isLoading: boolean
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onLoad: (id: string) => void
  onTogglePaid: (id: string, isPaid: boolean) => void
}) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("issue_date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("cs-CZ")
    const list = q
      ? invoices.filter(
          (inv) =>
            inv.invoice_number.toLocaleLowerCase("cs-CZ").includes(q) ||
            (inv.project_title ?? "").toLocaleLowerCase("cs-CZ").includes(q) ||
            (inv.project_subtitle ?? "").toLocaleLowerCase("cs-CZ").includes(q) ||
            statusLabels[inv.status as InvoiceStatus]
              ?.toLocaleLowerCase("cs-CZ")
              .includes(q)
        )
      : invoices

    return [...list].sort((a, b) => {
      let av: string | number = ""
      let bv: string | number = ""

      if (sortKey === "total_amount") {
        av = Number(a.total_amount) || 0
        bv = Number(b.total_amount) || 0
      } else {
        av = (a[sortKey] ?? "") as string
        bv = (b[sortKey] ?? "") as string
      }

      const cmp =
        typeof av === "number"
          ? av - (bv as number)
          : (av as string).localeCompare(bv as string, "cs-CZ")

      return sortDir === "asc" ? cmp : -cmp
    })
  }, [invoices, search, sortKey, sortDir])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uložené faktury</CardTitle>
        <CardDescription>
          Kliknutí otevře fakturu v editoru. Pravé tlačítko myši zobrazí
          možnosti.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{invoices.length} faktur</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 pr-8"
            placeholder="Hledat fakturu, odběratele, stav…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Vymazat hledání"
              onClick={() => setSearch("")}
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Načítám faktury…
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Zatím nic uloženého. Klikni na Nová faktura a vytvoř první doklad.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Žádná faktura neodpovídá hledání.
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="flex flex-col gap-2 md:hidden">
              {filtered.map((invoice) => {
                const isPaid = invoice.status === "paid"
                const isActive = activeInvoiceId === invoice.id
                return (
                  <li
                    key={invoice.id}
                    className={cn(
                      "rounded-lg border bg-card",
                      isActive && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full p-3 text-left"
                      onClick={() => onLoad(invoice.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">
                          {invoice.invoice_number}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatCurrency(Number(invoice.total_amount))}
                        </span>
                      </div>
                      {invoice.project_title ? (
                        <p className="mt-0.5 truncate text-sm font-medium">
                          {invoice.project_title}
                        </p>
                      ) : null}
                      {invoice.project_subtitle ? (
                        <p className="mt-0 truncate text-xs text-muted-foreground">
                          {invoice.project_subtitle}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            statusVariant[invoice.status as InvoiceStatus] ??
                            "outline"
                          }
                        >
                          {statusLabels[invoice.status as InvoiceStatus] ??
                            invoice.status}
                        </Badge>
                        {invoice.exported_at ? (
                          <Badge variant="secondary">exportováno</Badge>
                        ) : null}
                        {isActive ? (
                          <Badge variant="secondary">otevřená</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {invoice.issue_date
                            ? formatDate(invoice.issue_date)
                            : null}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 border-t px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 flex-1"
                        onClick={() => onLoad(invoice.id)}
                      >
                        <PencilIcon className="size-4" />
                        Upravit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 flex-1"
                        onClick={() => onTogglePaid(invoice.id, !isPaid)}
                      >
                        <CheckCircle2Icon className="size-4" />
                        {isPaid ? "Zaplaceno" : "Zaplatit"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0"
                            aria-label="Další možnosti"
                          >
                            <EllipsisIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>
                            {invoice.invoice_number}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDuplicate(invoice.id)}
                          >
                            <CopyIcon className="size-4" />
                            Duplikovat
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(invoice.id)}
                          >
                            <Trash2Icon className="size-4" />
                            Smazat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Desktop: sortable table with context menu */}
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="text-muted-foreground">
                    <TableHead>
                      <SortHeader
                        label="Číslo"
                        sortKey="invoice_number"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Název"
                        sortKey="project_title"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Místo"
                        sortKey="project_subtitle"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Vystaveno"
                        sortKey="issue_date"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Splatnost"
                        sortKey="due_date"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortHeader
                        label="Částka"
                        sortKey="total_amount"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Stav"
                        sortKey="status"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Export"
                        sortKey="exported_at"
                        current={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((invoice) => {
                    const isPaid = invoice.status === "paid"
                    return (
                      <ContextMenu key={invoice.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50 data-[active=true]:bg-muted"
                            data-active={activeInvoiceId === invoice.id}
                            onClick={() => onLoad(invoice.id)}
                          >
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-2">
                                {invoice.invoice_number}
                                {activeInvoiceId === invoice.id ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    otevřená
                                  </Badge>
                                ) : null}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-52 truncate">
                              {invoice.project_title || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-36 truncate text-muted-foreground">
                              {invoice.project_subtitle || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {invoice.issue_date
                                ? formatDate(invoice.issue_date)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {invoice.due_date
                                ? formatDate(invoice.due_date)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(Number(invoice.total_amount))}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  statusVariant[
                                    invoice.status as InvoiceStatus
                                  ] ?? "outline"
                                }
                              >
                                {statusLabels[
                                  invoice.status as InvoiceStatus
                                ] ?? invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {invoice.exported_at ? (
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(invoice.exported_at)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-52">
                          <ContextMenuLabel>
                            {invoice.invoice_number}
                          </ContextMenuLabel>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => onLoad(invoice.id)}>
                            <PencilIcon className="size-4" />
                            Otevřít / upravit
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => onDuplicate(invoice.id)}
                          >
                            <CopyIcon className="size-4" />
                            Duplikovat
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={() => onTogglePaid(invoice.id, !isPaid)}
                          >
                            <CheckCircle2Icon className="size-4" />
                            {isPaid
                              ? "Označit jako nezaplaceno"
                              : "Označit jako zaplaceno"}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            onClick={() => onDelete(invoice.id)}
                          >
                            <Trash2Icon className="size-4" />
                            Smazat
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function InvoicePreviewOverlay({
  draft,
  fileName,
  isExporting,
  onClose,
  onExport,
  qrDataUrl,
  total,
}: {
  draft: InvoiceDraft
  fileName: string
  isExporting: boolean
  onClose: () => void
  onExport: () => void
  qrDataUrl: string
  total: number
}) {
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="no-print flex flex-col gap-3 border-b bg-background px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Náhled faktury</h2>
            <Badge variant="secondary">{draft.invoiceNumber}</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{fileName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            <EyeOffIcon data-icon="inline-start" />
            Zavřít náhled
          </Button>
          <Button onClick={onExport} disabled={isExporting}>
            <PrinterIcon data-icon="inline-start" />
            {isExporting ? "Exportuji" : "Export / PDF"}
          </Button>
        </div>
      </div>
      <div className="invoice-stage invoice-preview-stage">
        <InvoiceDocument draft={draft} qrDataUrl={qrDataUrl} total={total} />
      </div>
    </section>
  )
}

function InvoiceDocument({
  draft,
  qrDataUrl,
  total,
}: {
  draft: InvoiceDraft
  qrDataUrl: string
  total: number
}) {
  const customerAddress = draft.customerAddress
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <article id="invoice-print" className="invoice-sheet">
      <header className="invoice-top">
        <span>FAKTURA</span>
        <strong>{draft.invoiceNumber}</strong>
      </header>

      <section className="invoice-payment">
        <div className="invoice-payment-copy">
          <span>Prosím o zaplacení</span>
          <strong>{formatCurrency(total)}</strong>
          <dl>
            <div>
              <dt>Forma úhrady:</dt>
              <dd>bankovním převodem</dd>
            </div>
            <div>
              <dt>Číslo účtu:</dt>
              <dd>{payment.accountNumber}</dd>
            </div>
            <div>
              <dt>Variabilní symbol:</dt>
              <dd>{draft.invoiceNumber}</dd>
            </div>
            <div>
              <dt>Datum vystavení:</dt>
              <dd>{formatDate(draft.issueDate)}</dd>
            </div>
            <div>
              <dt>Datum splatnosti:</dt>
              <dd>{formatDate(draft.dueDate)}</dd>
            </div>
          </dl>
          <dl className="invoice-bank">
            <div>
              <dt>Banka:</dt>
              <dd>{payment.bank}</dd>
            </div>
            <div>
              <dt>BIC/SWIFT:</dt>
              <dd>{payment.bic}</dd>
            </div>
            <div>
              <dt>IBAN:</dt>
              <dd>{payment.iban}</dd>
            </div>
          </dl>
        </div>
        <div className="invoice-qr">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR platba" />
          ) : (
            <span>QR</span>
          )}
        </div>
      </section>

      <section className="invoice-parties">
        <div>
          <h2>Dodavatel</h2>
          <strong>{supplier.name}</strong>
          {supplier.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          <p>
            IČO: {supplier.companyId}
            <br />
            {supplier.vatNote}
          </p>
        </div>
        <div>
          <h2>Odběratel</h2>
          <strong>{draft.customerName}</strong>
          {customerAddress.map((line) => (
            <span key={line}>{line}</span>
          ))}
          <p>
            IČO: {draft.customerCompanyId}
            <br />
            DIČ: {draft.customerTaxId}
          </p>
        </div>
      </section>

      <p className="invoice-legal">
        Úřad příslušný podle § 71 odst. 2 živnostenského zákona: Fyzická osoba
        podnikající dle živnostenského zákona.
      </p>

      <section className="invoice-items">
        <h2>
          Fakturuji Vám za {draft.projectTitle}
          {draft.projectSubtitle ? ` (${draft.projectSubtitle})` : ""}
        </h2>
        <table>
          <thead>
            <tr>
              <th>Popis</th>
              <th>Množství</th>
              <th>Za jednotku</th>
              <th>Celkem</th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>{formatQuantity(line.quantity, line.unitLabel)}</td>
                <td>{formatCurrency(line.unitPrice)}</td>
                <td>{formatCurrency(line.quantity * line.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-total">
          <span>Celkem zaplaťte:</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </section>

      <footer className="invoice-footer">
        <span>Strana 1 / 1</span>
        <strong>
          {supplier.email}
          <br />
          {supplier.phone}
        </strong>
      </footer>
    </article>
  )
}

function printInvoicePdf(draft: InvoiceDraft) {
  const previousTitle = document.title
  const pdfTitle = buildInvoicePdfFileName(draft).replace(/\.pdf$/i, "")
  let didRestoreTitle = false

  function restoreTitle() {
    if (didRestoreTitle) {
      return
    }

    didRestoreTitle = true
    document.title = previousTitle
    window.removeEventListener("afterprint", restoreTitle)
  }

  document.title = pdfTitle
  window.addEventListener("afterprint", restoreTitle, { once: true })
  window.print()
  window.setTimeout(restoreTitle, 3000)
}

function createInvoiceStats(invoices: InvoiceSummary[]) {
  return invoices.reduce(
    (stats, invoice) => {
      const amount = Number(invoice.total_amount) || 0
      const isCancelled = invoice.status === "cancelled"
      const isPaid = invoice.status === "paid"

      if (isCancelled) {
        stats.cancelledCount += 1
        return stats
      }

      if (isPaid) {
        stats.paidCount += 1
        stats.paidTotal += amount
        return stats
      }

      stats.unpaidCount += 1
      stats.unpaidTotal += amount
      stats.activeTotal += amount

      if (invoice.exported_at) {
        stats.waitingPaymentCount += 1
        stats.waitingPaymentTotal += amount
      } else {
        stats.waitingExportCount += 1
        stats.waitingExportTotal += amount
      }

      return stats
    },
    {
      activeTotal: 0,
      cancelledCount: 0,
      paidCount: 0,
      paidTotal: 0,
      unpaidCount: 0,
      unpaidTotal: 0,
      waitingExportCount: 0,
      waitingExportTotal: 0,
      waitingPaymentCount: 0,
      waitingPaymentTotal: 0,
    }
  )
}

function formatInvoiceCount(count: number) {
  if (count === 1) {
    return "1 faktura"
  }

  if (count > 1 && count < 5) {
    return `${count} faktury`
  }

  return `${count} faktur`
}

function HoursInput({
  className,
  value,
  onChange,
}: {
  className?: string
  value: number
  onChange: (value: number) => void
}) {
  const [raw, setRaw] = useState(() => formatHoursDisplay(value))

  useEffect(() => {
    setRaw(formatHoursDisplay(value))
  }, [value])

  return (
    <Input
      inputMode="decimal"
      placeholder="0:30"
      className={className}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        const parsed = parseHoursInput(raw)
        onChange(parsed)
        setRaw(formatHoursDisplay(parsed))
      }}
    />
  )
}

function readStoredDraft() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return createDefaultDraft()
    }

    const parsed = JSON.parse(stored) as Partial<InvoiceDraft>
    const fallback = createDefaultDraft()

    return {
      ...fallback,
      ...parsed,
      lines: Array.isArray(parsed.lines) ? parsed.lines : fallback.lines,
    }
  } catch {
    return createDefaultDraft()
  }
}

export default App
