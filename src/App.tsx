import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { Session } from "@supabase/supabase-js"
import * as QRCode from "qrcode"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClipboardCopyIcon,
  Clock3Icon,
  CloudIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  FilePlus2Icon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  MessageSquareTextIcon,
  MinusIcon,
  PencilIcon,
  PhoneCallIcon,
  PlusCircleIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import { Toaster } from "@/components/ui/sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { categoryColors, priceCategories, priceList, type PriceItem } from "@/data/price-list"
import {
  parseAirBankXml,
  type ParsedAirBankTransaction,
} from "@/lib/airbank-xml"
import { cn } from "@/lib/utils"
import { AppShellV2 } from "@/components/layout/AppShellV2"
import type { AppView } from "@/components/layout/AppShellV2"
import { InvoiceList } from "@/components/invoices/InvoiceList"
import {
  assertInvoiceDraftInvariant,
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
  type BankTransactionImport,
  type BankTransactionSummary,
  deleteInvoice,
  getNextInvoiceNumber,
  importBankTransactions,
  linkBankTransactionToInvoice,
  listBankTransactions,
  listInvoices,
  loadInvoice,
  markInvoiceExported,
  markInvoiceReminded,
  markInvoiceSent,
  saveInvoice,
  setInvoicePaid,
  type InvoiceSummary,
} from "@/lib/invoice-repository"
import { missingSupabaseEnv, supabase } from "@/lib/supabase"

function useScrollHide() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      if (Math.abs(y - lastY.current) < 8) return
      setHidden(y > lastY.current && y > 56)
      lastY.current = y
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return hidden
}

const STORAGE_KEY = "faktury-pro-stepu:draft:v2"
const FOLLOW_UP_SOON_DAYS = 7

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Rozpracováno",
  issued: "Odesláno",
  paid: "Zaplaceno",
  overdue: "Po splatnosti",
  cancelled: "Storno",
}

type AppMessage = {
  title: string
  description: string
  variant?: "default" | "destructive"
}


type FilteredPriceItem = {
  item: PriceItem
  selectedLine: InvoiceLine | undefined
}

type InvoiceValidationIssue = {
  label: string
  detail: string
}

type InvoiceFollowUpItem = {
  invoice: InvoiceSummary
  daysUntilDue: number
  urgency: "overdue" | "soon"
}

type BankImportPreviewItem = {
  transaction: ParsedAirBankTransaction
  invoice: InvoiceSummary | null
  amountMatches: boolean
}

type BankImportPreview = {
  fileName: string
  items: BankImportPreviewItem[]
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

function getInvoiceValidationIssues(
  draft: InvoiceDraft,
  total: number
): InvoiceValidationIssue[] {
  const issues: InvoiceValidationIssue[] = []

  if (!draft.invoiceNumber.trim()) {
    issues.push({
      label: "Číslo faktury",
      detail: "Doplň číslo dokladu.",
    })
  }

  if (!draft.projectTitle.trim()) {
    issues.push({
      label: "Text fakturace",
      detail: "Doplň, za jakou práci fakturuješ.",
    })
  }

  if (!draft.customerName.trim()) {
    issues.push({
      label: "Odběratel",
      detail: "Doplň firmu nebo člověka, komu faktura jde.",
    })
  }

  if (!draft.customerAddress.trim()) {
    issues.push({
      label: "Adresa odběratele",
      detail: "Doplň adresu odběratele pro PDF.",
    })
  }

  if (!draft.issueDate || !draft.dueDate) {
    issues.push({
      label: "Datum",
      detail: "Doplň datum vystavení i splatnosti.",
    })
  } else if (new Date(draft.dueDate) < new Date(draft.issueDate)) {
    issues.push({
      label: "Splatnost",
      detail: "Splatnost nemá být dřív než vystavení.",
    })
  }

  if (draft.lines.length === 0) {
    issues.push({
      label: "Položky",
      detail: "Přidej aspoň jednu položku z ceníku nebo vlastní řádek.",
    })
  }

  draft.lines.forEach((line, index) => {
    const rowLabel = `Položka ${index + 1}`

    if (!line.description.trim()) {
      issues.push({
        label: rowLabel,
        detail: "Popis položky nesmí být prázdný.",
      })
    }

    if (line.quantity <= 0) {
      issues.push({
        label: rowLabel,
        detail: "Množství musí být větší než nula.",
      })
    }

    if (line.unitPrice < 0) {
      issues.push({
        label: rowLabel,
        detail: "Cena nesmí být záporná.",
      })
    }
  })

  if (total <= 0) {
    issues.push({
      label: "Částka",
      detail: "Celková částka musí být větší než 0 Kč.",
    })
  }

  return issues
}

function getDraftPaymentStateText(draft: InvoiceDraft) {
  if (draft.status === "paid") {
    return `Zaplaceno${draft.paidAt ? ` ${formatDate(draft.paidAt)}` : ""}`
  }

  if (draft.status === "issued") {
    return "Odesláno, čeká na platbu"
  }

  if (draft.status === "overdue") {
    return "Po splatnosti"
  }

  if (draft.status === "cancelled") {
    return "Storno"
  }

  return "Rozpracováno"
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
  const [bankTransactions, setBankTransactions] = useState<
    BankTransactionSummary[]
  >([])
  const [bankTransactionsLoading, setBankTransactionsLoading] = useState(false)
  const [bankImporting, setBankImporting] = useState(false)
  const [bankImportPreview, setBankImportPreview] =
    useState<BankImportPreview | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [view, setView] = useState<AppView>("invoices")
  const [previewVisible, setPreviewVisible] = useState(false)
  const [showExportIssues, setShowExportIssues] = useState(false)
  const [mobileBasicsOpen, setMobileBasicsOpen] = useState(false)
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false)
  const lastSyncedDraftRef = useRef<string>(JSON.stringify(draft))

  const total = useMemo(() => calculateTotal(draft.lines), [draft.lines])
  const invoiceValidationIssues = useMemo(
    () => getInvoiceValidationIssues(draft, total),
    [draft, total]
  )
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

  const notify = useCallback((message: AppMessage) => {
    if (message.variant === "destructive") {
      toast.error(message.title, { description: message.description })
    } else {
      toast(message.title, { description: message.description })
    }
  }, [])

  const showError = useCallback(
    (title: string, error: unknown) => {
      notify({
        title,
        description:
          error instanceof Error ? error.message : "Zkus akci zopakovat.",
        variant: "destructive",
      })
    },
    [notify]
  )

  const applySyncedDraft = useCallback((next: InvoiceDraft) => {
    lastSyncedDraftRef.current = JSON.stringify(next)
    setDraft(next)
  }, [])

  function isDraftDirty() {
    const hasContent =
      draft.lines.length > 0 || Boolean(draft.projectTitle.trim())

    if (!hasContent) {
      return false
    }

    if (!draft.id) {
      return true
    }

    return JSON.stringify(draft) !== lastSyncedDraftRef.current
  }

  function confirmDiscardDraft() {
    if (!isDraftDirty()) {
      return true
    }

    return window.confirm(
      `Faktura ${draft.invoiceNumber} má neuložené změny. Zahodit je a pokračovat?`
    )
  }

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

  const refreshBankTransactions = useCallback(async () => {
    try {
      setBankTransactionsLoading(true)
      setBankTransactions(await listBankTransactions())
    } catch (error) {
      showError("Nepodařilo se načíst platby", error)
    } finally {
      setBankTransactionsLoading(false)
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
        setBankTransactions([])
        setBankImportPreview(null)
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
      void Promise.resolve().then(async () => {
        await Promise.all([refreshSavedInvoices(), refreshBankTransactions()])
      })
    }
  }, [refreshBankTransactions, refreshSavedInvoices, user])

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
    if (confirmDiscardDraft()) {
      applySyncedDraft(createDefaultDraft())
    }
  }

  async function handleAuth() {
    if (!supabase) {
      notify({
        title: "Chybí nastavení Supabase",
        description: `Doplň env proměnné ${missingSupabaseEnv.join(", ")} a znovu nasaď aplikaci.`,
        variant: "destructive",
      })
      return
    }

    setAuthLoading(true)

    try {
      const credentials = {
        email: authEmail.trim(),
        password: authPassword,
      }
      const { error } = await supabase.auth.signInWithPassword(credentials)

      if (error) {
        throw error
      }
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

    notify({
      title: "Odhlášeno",
      description: "Rozpracovaná faktura zůstává uložená lokálně v prohlížeči.",
    })
  }

  async function handleSaveInvoice() {
    if (!user) {
      notify({
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
      applySyncedDraft(savedDraft)
      await refreshSavedInvoices()
      notify({
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
    if (!confirmDiscardDraft()) {
      return
    }

    try {
      setSyncing(true)
      applySyncedDraft(await loadInvoice(id))
      setView("editor")
      setPreviewVisible(false)
      setShowExportIssues(false)
      notify({
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
        applySyncedDraft(createDefaultDraft())
        setView("dashboard")
        setShowExportIssues(false)
      }

      await refreshSavedInvoices()
      notify({
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
        applySyncedDraft(updatedDraft)
      }

      await refreshSavedInvoices()
      notify({
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

  async function handleMarkSent(id: string) {
    try {
      setSyncing(true)
      const updatedDraft = await markInvoiceSent(id)

      if (draft.id === id) {
        applySyncedDraft(updatedDraft)
      }

      await refreshSavedInvoices()
      notify({
        title: "Faktura označena jako odeslaná",
        description: `Doklad ${updatedDraft.invoiceNumber} teď čeká na platbu.`,
      })
    } catch (error) {
      showError("Označení odeslání selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleCopyReminder(invoice: InvoiceSummary) {
    try {
      await copyTextToClipboard(buildPaymentReminderText(invoice))
    } catch (error) {
      showError("Kopírování upomínky selhalo", error)
      return
    }

    try {
      setSyncing(true)
      const updatedDraft = await markInvoiceReminded(invoice.id)

      if (draft.id === invoice.id) {
        applySyncedDraft(updatedDraft)
      }

      await refreshSavedInvoices()
      notify({
        title: "Upomínka zkopírována",
        description: `Text pro fakturu ${invoice.invoice_number} je ve schránce a doklad je označený jako upomenutý.`,
      })
    } catch (error) {
      showError("Upomínka je ve schránce, ale označení selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handlePreviewBankXml(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    if (!user) {
      notify({
        title: "Nejdřív se přihlas",
        description: "Bankovní výpis jde uložit až pod přihlášeným účtem.",
        variant: "destructive",
      })
      return
    }

    try {
      setBankImporting(true)
      setBankImportPreview(null)
      const parsed = parseAirBankXml(await file.text())
      const items = createBankImportPreviewItems(parsed, savedInvoices)
      const stats = createBankImportPreviewStats(items)

      setBankImportPreview({
        fileName: file.name,
        items,
      })

      notify({
        title: "Výpis připraven ke kontrole",
        description: `${items.length} pohybů načteno. ${stats.readyCount} připraveno ke spárování, ${stats.amountMismatchCount} s nesedící částkou.`,
      })
    } catch (error) {
      showError("Načtení bankovního XML selhalo", error)
    } finally {
      setBankImporting(false)
    }
  }

  async function handleConfirmBankImport() {
    if (!bankImportPreview || !user) {
      return
    }

    try {
      setBankImporting(true)
      const rows = bankImportPreview.items.map(toBankTransactionImport)
      const imported = await importBankTransactions(rows, user)
      await refreshBankTransactions()

      const stats = createBankImportPreviewStats(bankImportPreview.items)
      setBankImportPreview(null)
      notify({
        title: "Bankovní výpis importován",
        description: `${imported.length} pohybů uloženo nebo aktualizováno. ${stats.matchedCount} z nich je spárovaných s fakturami.`,
      })
    } catch (error) {
      showError("Import bankovního XML selhal", error)
    } finally {
      setBankImporting(false)
    }
  }

  async function handleLinkTransaction(
    transactionId: string,
    invoiceId: string | null
  ) {
    try {
      await linkBankTransactionToInvoice(transactionId, invoiceId)
      await refreshBankTransactions()
    } catch (error) {
      showError("Přiřazení faktury k platbě selhalo", error)
    }
  }

  async function handleMarkCurrentSent() {
    if (invoiceValidationIssues.length > 0) {
      setPreviewVisible(false)
      setShowExportIssues(true)
      notify({
        title: "Fakturu zatím nejde označit jako odeslanou",
        description: "Oprav checklist v editoru a potom akci zopakuj.",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      notify({
        title: databaseIsConfigured
          ? "Nejdřív se přihlas"
          : "Chybí nastavení Supabase",
        description: databaseIsConfigured
          ? "Odeslání faktury se ukládá do databáze až po přihlášení."
          : `Bez env proměnných ${missingSupabaseEnv.join(", ")} nejde ukládat do databáze.`,
        variant: "destructive",
      })
      return
    }

    if (draft.status === "paid" || draft.status === "cancelled") {
      notify({
        title: "Stav nejde změnit na odesláno",
        description:
          "Zaplacenou nebo stornovanou fakturu nech tak, případně nejdřív změň stav ručně.",
        variant: "destructive",
      })
      return
    }

    try {
      setSyncing(true)
      const savedDraft = await saveInvoice({ ...draft, status: "issued" }, user)
      const updatedDraft = await markInvoiceSent(savedDraft.id!)
      applySyncedDraft(updatedDraft)
      await refreshSavedInvoices()
      notify({
        title: "Faktura označena jako odeslaná",
        description: `Doklad ${updatedDraft.invoiceNumber} teď čeká na platbu.`,
      })
    } catch (error) {
      showError("Označení odeslání selhalo", error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleExportInvoice() {
    if (invoiceValidationIssues.length > 0) {
      setPreviewVisible(false)
      setShowExportIssues(true)
      notify({
        title: "Fakturu zatím nejde exportovat",
        description: "Oprav checklist v editoru a potom akci zopakuj.",
        variant: "destructive",
      })
      return
    }

    setShowExportIssues(false)

    if (!previewVisible) {
      setPreviewVisible(true)
      notify({
        title: "Zkontroluj náhled",
        description:
          "Faktura je teď zobrazená přes celou obrazovku. Pokud sedí, klikni v náhledu na Export / PDF. Po odeslání firmě ji označ jako Odesláno.",
      })
      return
    }

    if (!user) {
      notify({
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
      applySyncedDraft(exportedDraft)
      await refreshSavedInvoices()
      notify({
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
    if (!confirmDiscardDraft()) {
      return
    }

    const nextDraft = createDefaultDraft()
    try {
      nextDraft.invoiceNumber = await getNextInvoiceNumber()
    } catch {
      // fallback — already set in createDefaultDraft
    }
    applySyncedDraft(nextDraft)
    setView("editor")
    setPreviewVisible(false)
    setShowExportIssues(false)
    notify({
      title: "Nová faktura",
      description: `Editor je připravený pro doklad ${nextDraft.invoiceNumber}.`,
    })
  }

  async function handleDuplicateInvoice(id: string) {
    if (!confirmDiscardDraft()) {
      return
    }

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
        lastRemindedAt: null,
      })
      setView("editor")
      setPreviewVisible(false)
      setShowExportIssues(false)
      notify({
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

  const reminderHref = buildReminderMailtoHrefForDraft(draft)

  const editorActions = user ? (
    <>
      {/* Mobile + tablet: compact — save/PDF live in the bottom action bar */}
      <div className="flex items-center gap-1.5 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label="Přehled faktur"
          onClick={() => setView("dashboard")}
        >
          <LayoutDashboardIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={previewVisible ? "Skrýt náhled" : "Zobrazit náhled"}
          onClick={() => setPreviewVisible((current) => !current)}
        >
          {previewVisible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Další akce">
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleNewInvoice}>
              <PlusCircleIcon />
              Nová faktura
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSaveInvoice}
              disabled={syncing || !authReady}
            >
              <SaveIcon />
              {syncing ? "Ukládám…" : "Uložit"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleMarkCurrentSent}
              disabled={syncing || !authReady}
            >
              <SendIcon />
              Označit jako odesláno
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportInvoice} disabled={syncing}>
              <PrinterIcon />
              Export / PDF
            </DropdownMenuItem>
            {reminderHref ? (
              <DropdownMenuItem asChild>
                <a href={reminderHref}>
                  <MailIcon />
                  E-mail
                </a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>
                <MailIcon />
                E-mail
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetDraft}>
              <RotateCcwIcon />
              Reset faktury
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Odhlásit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Desktop: full toolbar */}
      <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
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
        <Button
          variant="outline"
          onClick={handleMarkCurrentSent}
          disabled={syncing || !authReady}
          aria-label="Označit jako odesláno"
        >
          <SendIcon data-icon="inline-start" />
          Odesláno
        </Button>
        <Button onClick={handleExportInvoice} disabled={syncing}>
          <PrinterIcon data-icon="inline-start" />
          Export / PDF
        </Button>
        {reminderHref ? (
          <Button variant="outline" asChild>
            <a href={reminderHref}>
              <MailIcon data-icon="inline-start" />
              E-mail
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <MailIcon data-icon="inline-start" />
            E-mail
          </Button>
        )}
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
      </div>
    </>
  ) : null

  if (!authReady) {
    return (
      <AppShellV2
        activeView={"invoices" as AppView}
        onViewChange={() => {}}
        title="Načítám…"
      >
        <div className="mx-auto flex min-h-[calc(100svh-88px)] max-w-lg flex-col justify-center p-4">
          <Card>
            <CardHeader>
              <CardTitle>Načítám přihlášení</CardTitle>
              <CardDescription>
                Kontroluji relaci Supabase v prohlížeči.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShellV2>
    )
  }

  if (!user) {
    return (
      <AppShellV2
        activeView={"invoices" as AppView}
        onViewChange={() => {}}
        title="Přihlášení"
      >
        <div className="mx-auto flex min-h-[calc(100svh-88px)] max-w-lg flex-col justify-center gap-4 p-4">
          <AuthCard
            email={authEmail}
            isLoading={authLoading}
            missingEnv={missingSupabaseEnv}
            onEmailChange={setAuthEmail}
            onPasswordChange={setAuthPassword}
            onSubmit={handleAuth}
            password={authPassword}
          />
        </div>
      </AppShellV2>
    )
  }

  const viewTitle: Record<AppView, string> = {
    dashboard: "Přehled",
    invoices: "Faktury",
    editor: draft.invoiceNumber || "Editor",
    bank: "Banka",
  }

  const commonShellProps = {
    activeView: view,
    onViewChange: (v: AppView) => setView(v),
    invoiceNumber: draft.invoiceNumber,
    hasUnsavedChanges: isDraftDirty(),
    title: viewTitle[view],
  }

  if (view === "dashboard") {
    return (
      <AppShellV2
        {...commonShellProps}
        subtitle={user.email}
        headerRight={dashboardActions}
      >
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:gap-5 md:p-6">
          <InvoiceStatsCard invoices={savedInvoices} />
          <InvoiceFollowUpCard
            invoices={savedInvoices}
            isLoading={savedInvoicesLoading}
            isSyncing={syncing}
            onCopyReminder={handleCopyReminder}
            onLoad={(id) => {
              handleLoadInvoice(id)
              setView("editor")
            }}
            onTogglePaid={handleTogglePaid}
          />
        </div>
      </AppShellV2>
    )
  }

  if (view === "invoices") {
    return (
      <AppShellV2
        {...commonShellProps}
        subtitle={`${savedInvoices.length} faktur`}
        headerRight={dashboardActions}
      >
        <div className="mx-auto max-w-[1500px]">
          {/* Mobile Apple-like Invoice List */}
          <div className="md:hidden">
            <InvoiceList
              activeInvoiceId={draft.id}
              invoices={savedInvoices}
              isLoading={savedInvoicesLoading}
              onDelete={handleDeleteInvoice}
              onDuplicate={handleDuplicateInvoice}
              onLoad={(id) => {
                handleLoadInvoice(id)
                setView("editor")
              }}
              onMarkSent={handleMarkSent}
              onTogglePaid={handleTogglePaid}
            />
          </div>

          {/* Desktop Table View */}
          <div className="hidden p-4 md:block md:p-6">
            <SavedInvoicesCard
              activeInvoiceId={draft.id}
              invoices={savedInvoices}
              isLoading={savedInvoicesLoading}
              onDelete={handleDeleteInvoice}
              onDuplicate={handleDuplicateInvoice}
              onLoad={(id) => {
                handleLoadInvoice(id)
                setView("editor")
              }}
              onMarkSent={handleMarkSent}
              onTogglePaid={handleTogglePaid}
            />
          </div>
        </div>
      </AppShellV2>
    )
  }

  if (view === "bank") {
    return (
      <AppShellV2
        {...commonShellProps}
        subtitle={user.email}
        headerRight={dashboardActions}
      >
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:gap-5 md:p-6">
          <BankTransactionsCard
            importPreview={bankImportPreview}
            imports={bankTransactions}
            invoices={savedInvoices}
            isImporting={bankImporting}
            isLoading={bankTransactionsLoading || savedInvoicesLoading}
            isSyncing={syncing}
            onCancelImport={() => setBankImportPreview(null)}
            onConfirmImport={handleConfirmBankImport}
            onImportXml={handlePreviewBankXml}
            onLinkTransaction={handleLinkTransaction}
            onLoadInvoice={(id) => {
              handleLoadInvoice(id)
              setView("editor")
            }}
            onMarkPaid={(invoiceId) => handleTogglePaid(invoiceId, true)}
          />
        </div>
      </AppShellV2>
    )
  }

  // Editor view (default fallback)
  return (
    <AppShellV2
      {...commonShellProps}
      subtitle={getDraftPaymentStateText(draft)}
      headerRight={editorActions}
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 pt-4 pb-4 lg:pb-6">
        {/* Invoice form — DOM first so mobile shows it before the price list */}
        <Card className="app-panel no-print h-fit overflow-visible">
          <CardHeader>
            <CardTitle>Základ faktury</CardTitle>
            <CardDescription>
              Údaje dokladu, odběratele, termínů, platby a exportu.
            </CardDescription>
            <CardAction>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="md:hidden"
                  onClick={() => setMobileBasicsOpen((open) => !open)}
                >
                  {mobileBasicsOpen ? "Skrýt údaje" : "Upravit údaje"}
                </Button>
                <a
                  href="#cenik-sekce"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted lg:hidden"
                >
                  <ShoppingCartIcon data-icon="inline-start" />
                  Ceník
                </a>
                <Button
                  className="hidden lg:inline-flex"
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
            {showExportIssues && invoiceValidationIssues.length > 0 ? (
              <Alert variant="destructive">
                <AlertTitle>Před exportem oprav tyhle věci</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 flex flex-col gap-1">
                    {invoiceValidationIssues.map((issue) => (
                      <li key={`${issue.label}-${issue.detail}`}>
                        <strong>{issue.label}:</strong> {issue.detail}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-xl border bg-background/45 p-3 md:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {draft.customerName || "Bez odběratele"}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {draft.invoiceNumber} ·{" "}
                    {draft.projectSubtitle || "bez místa"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(total)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    splatnost {formatDate(draft.dueDate)}
                  </p>
                </div>
              </div>
            </div>

            <FieldSet className={cn(!mobileBasicsOpen && "hidden md:flex")}>
              <FieldGroup className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                        {Object.entries(statusLabels)
                          .filter(
                            ([value]) =>
                              value !== "overdue" || draft.status === "overdue"
                          )
                          .map(([value, label]) => (
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

            <div
              className={cn(
                "grid grid-cols-2 gap-3",
                !mobileBasicsOpen && "hidden md:grid"
              )}
            >
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BanknoteIcon data-icon="inline-start" />
                  Platba
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getDraftPaymentStateText(draft)}
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

            <Separator className={cn(!mobileBasicsOpen && "hidden md:block")} />

            {/* Odběratel je prakticky vždy 3M Energy — detail jen na vyžádání */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-card p-3",
                !mobileBasicsOpen && "hidden md:flex"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {draft.customerName || "Bez odběratele"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[
                    draft.customerCompanyId
                      ? `IČO ${draft.customerCompanyId}`
                      : null,
                    draft.contactEmail || null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Bez IČO a kontaktu"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setCustomerDetailsOpen((open) => !open)}
              >
                {customerDetailsOpen ? "Skrýt" : "Změnit"}
              </Button>
            </div>

            <FieldSet
              className={cn(
                !customerDetailsOpen && "hidden",
                customerDetailsOpen && !mobileBasicsOpen && "hidden md:flex"
              )}
            >
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
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
              <FieldGroup className="grid gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="contact-name">Kontakt</FieldLabel>
                  <Input
                    id="contact-name"
                    value={draft.contactName}
                    placeholder="Jméno člověka"
                    onChange={(event) =>
                      updateDraftField("contactName", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-email">
                    E-mail kontaktu
                  </FieldLabel>
                  <Input
                    id="contact-email"
                    type="email"
                    inputMode="email"
                    value={draft.contactEmail}
                    placeholder="firma@example.cz"
                    onChange={(event) =>
                      updateDraftField("contactEmail", event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-phone">Telefon</FieldLabel>
                  <Input
                    id="contact-phone"
                    type="tel"
                    inputMode="tel"
                    value={draft.contactPhone}
                    placeholder="+420"
                    onChange={(event) =>
                      updateDraftField("contactPhone", event.target.value)
                    }
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </CardContent>
        </Card>

        {/* Price list — DOM second so mobile shows it after the form */}
        <div className="no-print grid items-start gap-4 lg:grid-cols-[minmax(320px,430px)_minmax(0,1fr)]">
          <div
            id="cenik-sekce"
            className="flex h-fit scroll-mt-20 flex-col gap-4 lg:sticky lg:top-24"
          >
            <Card className="app-panel">
              <CardHeader>
                <CardTitle>Ceník úkonů</CardTitle>
                <CardDescription>
                  Položka se přidá na fakturu jedním kliknutím.
                </CardDescription>
                <CardAction>
                  <a
                    href="#invoice-number"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted lg:hidden"
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

                <div className="pr-1 lg:max-h-[66svh] lg:overflow-y-auto">
                  {filteredItems.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {filteredItems.map(({ item, selectedLine }) => {
                        const isSelected = Boolean(selectedLine)

                        const categoryColor = categoryColors[item.category]

                        return (
                          <li
                            key={item.id}
                            className={cn(
                              "grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border p-3 transition-opacity",
                              isSelected ? "opacity-100 ring-2 ring-white/40" : "opacity-90 hover:opacity-100"
                            )}
                            style={{
                              background: categoryColor,
                              borderColor: `color-mix(in oklch, ${categoryColor}, black 20%)`,
                            }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm leading-snug font-semibold text-white drop-shadow-sm">
                                {item.name}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge className="border-white/30 bg-black/20 text-white hover:bg-black/30">
                                  {item.sourceUnit}
                                </Badge>
                                <span className="text-base font-bold tabular-nums text-white drop-shadow-sm">
                                  {formatCurrency(item.price)}
                                </span>
                                {selectedLine ? (
                                  <Badge className="bg-white/30 text-white hover:bg-white/40">na faktuře</Badge>
                                ) : null}
                              </div>
                            </div>
                            {selectedLine ? (
                              <div className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-white/30 bg-black/20 p-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 rounded-full text-white hover:bg-white/20"
                                  aria-label={`Ubrat: ${item.name}`}
                                  onClick={() => removePriceItem(item)}
                                >
                                  <MinusIcon data-icon="inline-start" />
                                </Button>
                                <span className="min-w-12 text-center text-sm font-bold tabular-nums text-white">
                                  {formatQuantity(
                                    selectedLine.quantity,
                                    item.billingUnit
                                  )}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 rounded-full text-white hover:bg-white/20"
                                  aria-label={`Přidat: ${item.name}`}
                                  onClick={() => addPriceItem(item)}
                                >
                                  <PlusIcon data-icon="inline-start" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="icon"
                                className="rounded-full bg-black/25 text-white hover:bg-black/40"
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

          <Card className="app-panel hidden h-fit lg:block">
            <InvoiceLinesEditor
              lines={draft.lines}
              total={total}
              onAddCustomLine={() => addLine(createEmptyLine())}
              onRemoveLine={removeLine}
              onUpdateLine={updateLine}
            />
          </Card>
        </div>
      </div>
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
      <MobileEditorActionBar
        authReady={authReady}
        isSyncing={syncing}
        lines={draft.lines}
        onAddCustomLine={() => addLine(createEmptyLine())}
        onExport={handleExportInvoice}
        onRemoveLine={removeLine}
        onSave={handleSaveInvoice}
        onUpdateLine={updateLine}
        total={total}
      />
    </AppShellV2>
  )
}

function InvoiceLinesEditor({
  lines,
  onAddCustomLine,
  onRemoveLine,
  onUpdateLine,
  total,
}: {
  lines: InvoiceLine[]
  onAddCustomLine: () => void
  onRemoveLine: (id: string) => void
  onUpdateLine: (id: string, changes: Partial<InvoiceLine>) => void
  total: number
}) {
  return (
    <>
      <CardHeader>
        <CardTitle>Přidané položky</CardTitle>
        <CardDescription>
          Tady vidíš a upravuješ všechno, co půjde na fakturu.
        </CardDescription>
        <CardAction>
          <Button variant="outline" onClick={onAddCustomLine}>
            <FilePlus2Icon data-icon="inline-start" />
            Vlastní
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/45 p-3">
          <Badge variant="secondary">{lines.length} položek</Badge>
          <strong className="text-2xl font-semibold tabular-nums">
            {formatCurrency(total)}
          </strong>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Přidej položku z ceníku vlevo nebo vlastní řádek.
          </div>
        ) : null}

        {lines.length > 0 ? (
          <ul className="flex flex-col gap-2 lg:hidden">
            {lines.map((line) => {
              const matchedItem = priceList.find(
                (item) =>
                  item.name === line.description &&
                  item.price === line.unitPrice
              )
              const color = matchedItem
                ? categoryColors[matchedItem.category]
                : undefined
              const quantityStep = line.unitLabel === "hod" ? 0.5 : 1

              return (
                <li
                  key={line.id}
                  className="flex flex-col gap-2 rounded-lg border bg-background/45 p-3"
                  style={
                    color
                      ? {
                          borderLeft: `4px solid color-mix(in oklch, ${color}, black 10%)`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={line.description}
                      placeholder="Popis položky"
                      rows={2}
                      className="min-h-9 flex-1 resize-none text-sm"
                      onChange={(event) =>
                        onUpdateLine(line.id, {
                          description: event.target.value,
                        })
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label="Odebrat položku"
                      onClick={() => onRemoveLine(line.id)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label="Ubrat množství"
                        onClick={() =>
                          onUpdateLine(line.id, {
                            quantity: Math.max(
                              0,
                              line.quantity - quantityStep
                            ),
                          })
                        }
                      >
                        <MinusIcon className="size-4" />
                      </Button>
                      {line.unitLabel === "hod" ? (
                        <HoursInput
                          value={line.quantity}
                          className="w-14 text-center"
                          onChange={(value) =>
                            onUpdateLine(line.id, { quantity: value })
                          }
                        />
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={line.quantity}
                          aria-label="Množství"
                          className="w-14 text-center"
                          onChange={(event) =>
                            onUpdateLine(line.id, {
                              quantity: normalizeMoneyInput(
                                event.target.value
                              ),
                            })
                          }
                        />
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label="Přidat množství"
                        onClick={() =>
                          onUpdateLine(line.id, {
                            quantity: line.quantity + quantityStep,
                          })
                        }
                      >
                        <PlusIcon className="size-4" />
                      </Button>
                    </div>
                    <Input
                      value={line.unitLabel}
                      placeholder="ks"
                      aria-label="Jednotka"
                      className="w-14"
                      onChange={(event) =>
                        onUpdateLine(line.id, {
                          unitLabel: event.target.value,
                        })
                      }
                    />
                    <Input
                      inputMode="decimal"
                      value={line.unitPrice}
                      aria-label="Cena za jednotku"
                      className="min-w-0 flex-1 text-right"
                      onChange={(event) =>
                        onUpdateLine(line.id, {
                          unitPrice: normalizeMoneyInput(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatQuantity(line.quantity, line.unitLabel)} ×{" "}
                      {formatCurrency(line.unitPrice)}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {formatCurrency(line.quantity * line.unitPrice)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {lines.length > 0 ? (
          <div className="hidden overflow-x-auto rounded-lg border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-80">Popis</TableHead>
                  <TableHead className="w-24 text-right">Množství</TableHead>
                  <TableHead className="w-20">Jedn.</TableHead>
                  <TableHead className="w-32 text-right">Cena</TableHead>
                  <TableHead className="w-32 text-right">Celkem</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="min-w-80 whitespace-normal">
                      <Textarea
                        value={line.description}
                        className="min-h-16 resize-y"
                        onChange={(event) =>
                          onUpdateLine(line.id, {
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
                          onChange={(value) =>
                            onUpdateLine(line.id, { quantity: value })
                          }
                        />
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={line.quantity}
                          className="text-right"
                          onChange={(event) =>
                            onUpdateLine(line.id, {
                              quantity: normalizeMoneyInput(event.target.value),
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
                          onUpdateLine(line.id, {
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
                          onUpdateLine(line.id, {
                            unitPrice: normalizeMoneyInput(event.target.value),
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
                            onClick={() => onRemoveLine(line.id)}
                          >
                            <Trash2Icon />
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
      </CardContent>
    </>
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
  const headerHidden = useScrollHide()

  return (
    <div className="app-cockpit min-h-svh text-foreground">
      <header
        className={cn(
          "no-print sticky top-0 z-30 border-b bg-background/82 backdrop-blur-xl transition-transform duration-200",
          headerHidden && "-translate-y-full"
        )}
      >
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0 shrink">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base leading-tight font-semibold sm:text-2xl">
                Faktury pro Štěpu
              </h1>
              <Badge variant="secondary" className="hidden md:inline-flex">
                3M ENERGY
              </Badge>
            </div>
            {userEmail ? (
              <p className="hidden truncate text-xs text-muted-foreground md:block md:text-sm">
                {userEmail}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      {children}
      <Toaster />
    </div>
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
    <Card className="app-panel">
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
    <Card className="app-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDollarSignIcon data-icon="inline-start" />
          Přehled
        </CardTitle>
        <CardDescription>Rychlý stav uložených faktur.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <StatTile
            label="Doma"
            tone="success"
            value={formatCurrency(stats.paidTotal)}
            detail={`${formatInvoiceCount(stats.paidCount)} zaplaceno`}
          />
          <StatTile
            label="Po splatnosti"
            tone="danger"
            value={formatCurrency(stats.overdueTotal)}
            detail={formatInvoiceCount(stats.overdueCount)}
          />
          <StatTile
            label="Připravit / odeslat"
            tone="info"
            value={formatCurrency(stats.waitingSendTotal)}
            detail={formatInvoiceCount(stats.waitingSendCount)}
          />
          <StatTile
            label="Čeká na platbu"
            tone="primary"
            value={formatCurrency(stats.waitingPaymentTotal)}
            detail={formatInvoiceCount(stats.waitingPaymentCount)}
          />
          <StatTile
            label="Tento měsíc"
            tone="accent"
            value={formatCurrency(stats.thisMonthTotal)}
            detail={formatInvoiceCount(stats.thisMonthCount)}
          />
          <StatTile
            label="Letos"
            tone="warning"
            value={formatCurrency(stats.thisYearTotal)}
            detail={formatInvoiceCount(stats.thisYearCount)}
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
          <Badge variant="outline">
            {formatCurrency(stats.unpaidTotal)} nezaplaceno
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function InvoiceFollowUpCard({
  invoices,
  isLoading,
  isSyncing,
  onCopyReminder,
  onLoad,
  onTogglePaid,
}: {
  invoices: InvoiceSummary[]
  isLoading: boolean
  isSyncing: boolean
  onCopyReminder: (invoice: InvoiceSummary) => void
  onLoad: (id: string) => void
  onTogglePaid: (id: string, isPaid: boolean) => void
}) {
  const followUps = useMemo(() => getInvoiceFollowUpItems(invoices), [invoices])
  const hasOverdue = followUps.some((item) => item.urgency === "overdue")

  return (
    <Card className="app-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareTextIcon data-icon="inline-start" />K řešení
        </CardTitle>
        <CardDescription>
          Faktury po splatnosti a blížící se platby.
        </CardDescription>
        <CardAction>
          <Badge
            variant={
              hasOverdue
                ? "destructive"
                : followUps.length
                  ? "secondary"
                  : "outline"
            }
          >
            {formatInvoiceCount(followUps.length)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Načítám faktury k řešení…
          </div>
        ) : followUps.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Žádná odeslaná faktura není po splatnosti ani do týdne splatná.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {followUps.map(({ daysUntilDue, invoice, urgency }) => {
              const contactLine = formatInvoiceContactLine(invoice)
              const mailtoHref = buildReminderMailtoHref(invoice)
              const smsHref = buildReminderSmsHref(invoice)
              const telHref = buildContactTelHref(invoice)

              return (
                <li
                  key={invoice.id}
                  className={cn(
                    "rounded-lg border bg-card p-3",
                    urgency === "overdue" &&
                      "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => onLoad(invoice.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            urgency === "overdue" ? "destructive" : "secondary"
                          }
                        >
                          {urgency === "overdue" ? (
                            <TriangleAlertIcon data-icon="inline-start" />
                          ) : (
                            <Clock3Icon data-icon="inline-start" />
                          )}
                          {formatDueDistance(daysUntilDue)}
                        </Badge>
                        <span className="font-medium">
                          {invoice.invoice_number}
                        </span>
                        {invoice.last_reminded_at ? (
                          <Badge variant="outline">
                            upomenuto {formatDateTime(invoice.last_reminded_at)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {invoice.project_title || invoice.customer_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCurrency(Number(invoice.total_amount) || 0)} ·
                        splatnost {formatDate(invoice.due_date)}
                      </p>
                      {contactLine ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {contactLine}
                        </p>
                      ) : null}
                    </button>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {mailtoHref ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={mailtoHref}>
                            <MailIcon data-icon="inline-start" />
                            E-mail
                          </a>
                        </Button>
                      ) : null}
                      {telHref ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={telHref}>
                            <PhoneCallIcon data-icon="inline-start" />
                            Volat
                          </a>
                        </Button>
                      ) : null}
                      {smsHref ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={smsHref}>
                            <MessageSquareTextIcon data-icon="inline-start" />
                            SMS
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSyncing}
                        onClick={() => onCopyReminder(invoice)}
                      >
                        <ClipboardCopyIcon data-icon="inline-start" />
                        Upomínka
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSyncing}
                        onClick={() => onLoad(invoice.id)}
                      >
                        <PencilIcon data-icon="inline-start" />
                        Otevřít
                      </Button>
                      <Button
                        size="sm"
                        disabled={isSyncing}
                        onClick={() => onTogglePaid(invoice.id, true)}
                      >
                        <CheckCircle2Icon data-icon="inline-start" />
                        Zaplaceno
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

type BankInboxCategory =
  | "ready"
  | "mismatch"
  | "unknown"
  | "no_match"
  | "resolved"

function categorizeBankTransaction(
  transaction: BankTransactionSummary,
  invoice: InvoiceSummary | null,
  amountMatches: boolean
): BankInboxCategory {
  if (Number(transaction.amount) <= 0) return "resolved"
  if (invoice?.status === "paid" && amountMatches) return "resolved"
  if (invoice && amountMatches) return "ready"
  if (invoice && !amountMatches) return "mismatch"
  if (transaction.variable_symbol) return "unknown"
  return "no_match"
}

const BANK_INBOX_CATEGORY_ORDER: BankInboxCategory[] = [
  "ready",
  "mismatch",
  "unknown",
  "no_match",
  "resolved",
]

function BankTransactionsCard({
  importPreview,
  imports,
  invoices,
  isImporting,
  isLoading,
  isSyncing,
  onCancelImport,
  onConfirmImport,
  onImportXml,
  onLinkTransaction,
  onLoadInvoice,
  onMarkPaid,
}: {
  importPreview: BankImportPreview | null
  imports: BankTransactionSummary[]
  invoices: InvoiceSummary[]
  isImporting: boolean
  isLoading: boolean
  isSyncing: boolean
  onCancelImport: () => void
  onConfirmImport: () => void
  onImportXml: (event: ChangeEvent<HTMLInputElement>) => void
  onLinkTransaction: (transactionId: string, invoiceId: string | null) => void
  onLoadInvoice: (invoiceId: string) => void
  onMarkPaid: (invoiceId: string) => void
}) {
  const [showResolved, setShowResolved] = useState(false)

  const categorizedImports = imports
    .map((transaction) => {
      const match = findInvoiceMatchForSavedTransaction(transaction, invoices)
      const invoice = match?.invoice ?? null
      const amountMatches = invoice
        ? isBankAmountMatchingInvoice(transaction.amount, invoice)
        : false
      const category = categorizeBankTransaction(
        transaction,
        invoice,
        amountMatches
      )
      return { transaction, invoice, amountMatches, category }
    })
    .sort(
      (a, b) =>
        BANK_INBOX_CATEGORY_ORDER.indexOf(a.category) -
        BANK_INBOX_CATEGORY_ORDER.indexOf(b.category)
    )

  const actionableItems = categorizedImports.filter(
    (item) => item.category !== "resolved"
  )
  const resolvedItems = categorizedImports.filter(
    (item) => item.category === "resolved"
  )
  const visibleImports = showResolved
    ? categorizedImports
    : actionableItems.length > 0
      ? actionableItems
      : categorizedImports.slice(0, 12)

  const unpaidInvoices = invoices.filter((inv) => inv.status !== "paid")

  const visiblePreviewItems = importPreview?.items.slice(0, 8) ?? []
  const hiddenPreviewCount =
    importPreview === null
      ? 0
      : Math.max(importPreview.items.length - visiblePreviewItems.length, 0)
  const previewStats = createBankImportPreviewStats(importPreview?.items ?? [])
  const matchedCount = categorizedImports.filter((item) => item.invoice).length

  return (
    <Card className="app-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BanknoteIcon data-icon="inline-start" />
          Platby z banky
        </CardTitle>
        <CardDescription>
          Import XML výpisu z Air Bank a kontrola plateb podle variabilního
          symbolu.
        </CardDescription>
        <CardAction>
          <Badge variant={actionableItems.length ? "destructive" : "outline"}>
            {actionableItems.length} čeká
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="airbank-xml">Air Bank XML výpis</FieldLabel>
            <Input
              id="airbank-xml"
              type="file"
              accept=".xml,application/xml,text/xml"
              className="sr-only"
              disabled={isImporting || isLoading}
              onChange={onImportXml}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="outline"
                className={cn(
                  (isImporting || isLoading) && "pointer-events-none opacity-50"
                )}
              >
                <label htmlFor="airbank-xml">
                  <UploadIcon data-icon="inline-start" />
                  {isLoading
                    ? "Načítám…"
                    : isImporting
                      ? "Zpracovávám…"
                      : "Nahrát XML"}
                </label>
              </Button>
              <p className="text-xs text-muted-foreground">
                Nejdřív se ukáže náhled, do databáze se uloží až po potvrzení.
              </p>
            </div>
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{imports.length} pohybů v databázi</Badge>
          <Badge variant="outline">{matchedCount} spárováno</Badge>
          {isImporting ? (
            <Badge variant="secondary">
              <UploadIcon data-icon="inline-start" />
              importuji
            </Badge>
          ) : null}
        </div>

        {importPreview ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Náhled importu</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {importPreview.fileName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {importPreview.items.length} pohybů
                </Badge>
                <Badge
                  variant={previewStats.readyCount ? "default" : "outline"}
                >
                  {previewStats.readyCount} připraveno
                </Badge>
                {previewStats.alreadyPaidCount ? (
                  <Badge variant="secondary">
                    {previewStats.alreadyPaidCount} už zaplaceno
                  </Badge>
                ) : null}
                {previewStats.amountMismatchCount ? (
                  <Badge variant="destructive">
                    {previewStats.amountMismatchCount} nesedí částka
                  </Badge>
                ) : null}
                {previewStats.unknownSymbolCount ? (
                  <Badge variant="outline">
                    {previewStats.unknownSymbolCount} neznámý VS
                  </Badge>
                ) : null}
                {previewStats.missingSymbolCount ? (
                  <Badge variant="secondary">
                    {previewStats.missingSymbolCount} bez VS
                  </Badge>
                ) : null}
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {visiblePreviewItems.map((item, index) => {
                const invoice = item.invoice

                return (
                  <li
                    key={`${item.transaction.sourceTransactionId}-${index}`}
                    className="rounded-md border bg-background p-3"
                  >
                    <div className="flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getBankPreviewBadgeVariant(item)}>
                            {getBankPreviewLabel(item)}
                          </Badge>
                          <span className="font-medium tabular-nums">
                            {formatCurrency(item.transaction.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.transaction.bookedAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">
                          {invoice
                            ? `${invoice.invoice_number} · ${
                                invoice.project_title || invoice.customer_name
                              }`
                            : item.transaction.counterpartyName ||
                              item.transaction.message ||
                              "Bankovní pohyb"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.transaction.variableSymbol
                            ? `VS ${item.transaction.variableSymbol}`
                            : "Bez variabilního symbolu"}
                          {invoice && !item.amountMatches
                            ? ` · faktura ${formatCurrency(Number(invoice.total_amount) || 0)}`
                            : ""}
                        </p>
                      </div>
                      {invoice ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full md:w-auto"
                          disabled={isSyncing || isImporting}
                          onClick={() => onLoadInvoice(invoice.id)}
                        >
                          <PencilIcon data-icon="inline-start" />
                          Otevřít
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>

            {hiddenPreviewCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Dalších {hiddenPreviewCount} pohybů se uloží stejným potvrzením.
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isImporting}
                onClick={onCancelImport}
              >
                <XIcon data-icon="inline-start" />
                Zahodit
              </Button>
              <Button
                type="button"
                disabled={isImporting || importPreview.items.length === 0}
                onClick={onConfirmImport}
              >
                <CheckCircle2Icon data-icon="inline-start" />
                {isImporting ? "Ukládám…" : "Potvrdit import"}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Načítám faktury a bankovní pohyby…
          </div>
        ) : imports.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nahraj XML výpis z internetového bankovnictví Air Bank. Aplikace
            uloží pohyby a zkusí je spárovat podle variabilního symbolu.
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {visibleImports.map(({ transaction, invoice, category }) => {
                const canMarkPaid = category === "ready" && invoice !== null
                const needsLink =
                  category === "unknown" || category === "no_match"
                const isMismatch = category === "mismatch"
                const isResolved = category === "resolved"

                return (
                  <li
                    key={transaction.id}
                    className={cn(
                      "rounded-lg border bg-card p-3",
                      isResolved && "opacity-50"
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getBankInboxBadgeVariant(category)}>
                          {getBankInboxLabel(category)}
                        </Badge>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(Number(transaction.amount) || 0)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(transaction.booked_at)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {invoice
                            ? `${invoice.invoice_number} · ${
                                invoice.project_title || invoice.customer_name
                              }`
                            : transaction.counterparty_name ||
                              transaction.message ||
                              "Bankovní pohyb"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {transaction.variable_symbol
                            ? `VS ${transaction.variable_symbol}`
                            : "Bez variabilního symbolu"}
                          {transaction.counterparty_name && !invoice
                            ? ` · ${transaction.counterparty_name}`
                            : ""}
                        </p>
                        {isMismatch && invoice ? (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            Faktura{" "}
                            {formatCurrency(Number(invoice.total_amount) || 0)}{" "}
                            · platba{" "}
                            {formatCurrency(Number(transaction.amount) || 0)} —
                            rozdíl{" "}
                            {formatCurrency(
                              Math.abs(
                                Number(invoice.total_amount) -
                                  Number(transaction.amount)
                              )
                            )}
                          </p>
                        ) : null}
                      </div>

                      {needsLink ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={transaction.invoice_id ?? ""}
                            onValueChange={(val) =>
                              onLinkTransaction(transaction.id, val || null)
                            }
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue placeholder="Přiřadit fakturu ručně…" />
                            </SelectTrigger>
                            <SelectContent>
                              {unpaidInvoices.map((inv) => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  {inv.invoice_number} ·{" "}
                                  {inv.project_title || inv.customer_name} ·{" "}
                                  {formatCurrency(
                                    Number(inv.total_amount) || 0
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {invoice ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSyncing}
                            onClick={() => onLoadInvoice(invoice.id)}
                          >
                            <PencilIcon data-icon="inline-start" />
                            Otevřít
                          </Button>
                        ) : null}
                        {canMarkPaid ? (
                          <Button
                            size="sm"
                            disabled={isSyncing}
                            onClick={() => onMarkPaid(invoice!.id)}
                          >
                            <CheckCircle2Icon data-icon="inline-start" />
                            Označit zaplaceno
                          </Button>
                        ) : null}
                        {isMismatch && invoice ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSyncing}
                            onClick={() => onMarkPaid(invoice.id)}
                          >
                            <CheckCircle2Icon data-icon="inline-start" />
                            Označit zaplaceno přesto
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {resolvedItems.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowResolved((v) => !v)}
              >
                {showResolved
                  ? "Skrýt vyřešené"
                  : `Zobrazit vyřešené (${resolvedItems.length})`}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function getBankInboxLabel(category: BankInboxCategory): string {
  switch (category) {
    case "ready":
      return "připraveno"
    case "mismatch":
      return "částka nesedí"
    case "unknown":
      return "neznámý VS"
    case "no_match":
      return "bez VS"
    case "resolved":
      return "vyřešeno"
  }
}

function getBankInboxBadgeVariant(
  category: BankInboxCategory
): "default" | "secondary" | "outline" | "destructive" {
  switch (category) {
    case "ready":
      return "default"
    case "mismatch":
      return "destructive"
    case "unknown":
      return "outline"
    case "no_match":
      return "secondary"
    case "resolved":
      return "secondary"
  }
}

function StatTile({
  detail,
  label,
  tone = "primary",
  value,
}: {
  detail: string
  label: string
  tone?: "accent" | "danger" | "info" | "primary" | "success" | "warning"
  value: string
}) {
  const toneClass = {
    accent: "app-tone-accent",
    danger: "app-tone-danger",
    info: "app-tone-info",
    primary: "app-tone-primary",
    success: "app-tone-success",
    warning: "app-tone-warning",
  }[tone]

  return (
    <div className="rounded-xl border bg-background/45 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full sm:size-3", toneClass)} />
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
      </div>
      <p className="mt-2 text-xl leading-tight font-semibold tabular-nums sm:mt-5 sm:text-2xl md:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
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

function getInvoiceStatusLabel(invoice: InvoiceSummary) {
  if (isInvoiceOverdue(invoice)) {
    return "Po splatnosti"
  }

  return (
    statusLabels[invoice.status as InvoiceStatus] ??
    String(invoice.status || "Neznámý stav")
  )
}

function getInvoiceStatusVariant(
  invoice: InvoiceSummary
): "default" | "secondary" | "outline" | "destructive" {
  if (isInvoiceOverdue(invoice)) {
    return "destructive"
  }

  return statusVariant[invoice.status as InvoiceStatus] ?? "outline"
}

/** Jemné pozadí řádku podle stavu faktury */
function getInvoiceRowBgClass(invoice: InvoiceSummary): string {
  if (isInvoiceOverdue(invoice)) {
    return "invoice-row-overdue"
  }
  const cls: Record<InvoiceStatus, string> = {
    draft: "invoice-row-draft",
    issued: "invoice-row-issued",
    paid: "invoice-row-paid",
    overdue: "invoice-row-overdue",
    cancelled: "invoice-row-cancelled",
  }
  return cls[invoice.status as InvoiceStatus] ?? ""
}

function isInvoiceOpenForPayment(invoice: InvoiceSummary) {
  return !["draft", "paid", "cancelled"].includes(invoice.status)
}

function isInvoiceOverdue(invoice: InvoiceSummary) {
  return isInvoiceOpenForPayment(invoice) && invoice.due_date < todayInput()
}

function isInvoiceWaitingForSend(invoice: InvoiceSummary) {
  if (
    invoice.status === "paid" ||
    invoice.status === "issued" ||
    invoice.status === "overdue" ||
    invoice.status === "cancelled"
  ) {
    return false
  }

  return Boolean(invoice.exported_at)
}

function createBankImportPreviewItems(
  transactions: ParsedAirBankTransaction[],
  invoices: InvoiceSummary[]
): BankImportPreviewItem[] {
  return transactions.map((transaction) => {
    const match = findInvoiceMatchForTransaction(transaction, invoices)
    const invoice = match?.invoice ?? null

    return {
      transaction,
      invoice,
      amountMatches: invoice
        ? isBankAmountMatchingInvoice(transaction.amount, invoice)
        : false,
    }
  })
}

function toBankTransactionImport(
  item: BankImportPreviewItem
): BankTransactionImport {
  return {
    invoiceId: item.invoice?.id ?? null,
    sourceTransactionId: item.transaction.sourceTransactionId,
    accountIban: item.transaction.accountIban,
    counterpartyAccount: item.transaction.counterpartyAccount,
    counterpartyName: item.transaction.counterpartyName,
    bookedAt: item.transaction.bookedAt,
    amount: item.transaction.amount,
    currency: item.transaction.currency,
    variableSymbol: item.transaction.variableSymbol,
    message: item.transaction.message,
    rawData: item.transaction.rawData,
  }
}

function createBankImportPreviewStats(items: BankImportPreviewItem[]) {
  const matchedCount = items.filter((item) => item.invoice).length
  const readyCount = items.filter(
    (item) =>
      item.invoice &&
      item.amountMatches &&
      Number(item.transaction.amount) > 0 &&
      item.invoice.status !== "paid"
  ).length
  const alreadyPaidCount = items.filter(
    (item) => item.invoice?.status === "paid" && item.amountMatches
  ).length
  const amountMismatchCount = items.filter(
    (item) => item.invoice && !item.amountMatches
  ).length
  const unknownSymbolCount = items.filter(
    (item) => item.transaction.variableSymbol && !item.invoice
  ).length
  const missingSymbolCount = items.filter(
    (item) => !item.transaction.variableSymbol
  ).length

  return {
    matchedCount,
    readyCount,
    alreadyPaidCount,
    amountMismatchCount,
    unknownSymbolCount,
    missingSymbolCount,
  }
}

function findInvoiceMatchForTransaction(
  transaction: ParsedAirBankTransaction,
  invoices: InvoiceSummary[]
) {
  return findInvoiceMatch(
    {
      amount: transaction.amount,
      invoiceId: null,
      message: transaction.message,
      sourceTransactionId: transaction.sourceTransactionId,
      variableSymbol: transaction.variableSymbol,
    },
    invoices
  )
}

function findInvoiceMatchForSavedTransaction(
  transaction: BankTransactionSummary,
  invoices: InvoiceSummary[]
) {
  return findInvoiceMatch(
    {
      amount: Number(transaction.amount) || 0,
      invoiceId: transaction.invoice_id,
      message: transaction.message,
      sourceTransactionId: transaction.source_transaction_id,
      variableSymbol: transaction.variable_symbol,
    },
    invoices
  )
}

function findInvoiceMatch(
  transaction: {
    amount: number
    invoiceId: string | null
    message: string | null
    sourceTransactionId: string | null
    variableSymbol: string | null
  },
  invoices: InvoiceSummary[]
) {
  if (transaction.invoiceId) {
    const invoice = invoices.find((item) => item.id === transaction.invoiceId)

    if (invoice) {
      return { invoice, method: "stored" as const }
    }
  }

  const symbol = normalizeBankSymbol(transaction.variableSymbol)
  if (symbol) {
    const invoice = invoices.find(
      (item) => normalizeBankSymbol(item.invoice_number) === symbol
    )

    if (invoice) {
      return { invoice, method: "variable_symbol" as const }
    }
  }

  const searchable = normalizeBankSymbol(
    [transaction.message, transaction.sourceTransactionId]
      .filter(Boolean)
      .join(" ")
  )
  const invoice = invoices.find((item) => {
    const invoiceNumber = normalizeBankSymbol(item.invoice_number)

    return Boolean(invoiceNumber && searchable.includes(invoiceNumber))
  })

  return invoice ? { invoice, method: "message" as const } : null
}

function isBankAmountMatchingInvoice(
  amount: number | string,
  invoice: InvoiceSummary
) {
  return Math.abs(Number(amount) - Number(invoice.total_amount)) < 0.01
}

function getBankPreviewLabel(item: BankImportPreviewItem) {
  if (item.invoice?.status === "paid" && item.amountMatches) {
    return "už zaplaceno"
  }

  if (item.invoice && item.amountMatches) {
    return "připraveno"
  }

  if (item.invoice) {
    return "částka nesedí"
  }

  if (item.transaction.variableSymbol) {
    return "neznámý VS"
  }

  return "bez VS"
}

function getBankPreviewBadgeVariant(
  item: BankImportPreviewItem
): "default" | "secondary" | "outline" | "destructive" {
  if (item.invoice && !item.amountMatches) {
    return "destructive"
  }

  if (item.invoice && item.amountMatches) {
    return "default"
  }

  return item.transaction.variableSymbol ? "outline" : "secondary"
}

function normalizeBankSymbol(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? ""
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
  onMarkSent,
  onTogglePaid,
}: {
  activeInvoiceId?: string
  invoices: InvoiceSummary[]
  isLoading: boolean
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onLoad: (id: string) => void
  onMarkSent: (id: string) => void
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
            (inv.project_subtitle ?? "")
              .toLocaleLowerCase("cs-CZ")
              .includes(q) ||
            getInvoiceStatusLabel(inv).toLocaleLowerCase("cs-CZ").includes(q)
        )
      : invoices

    return [...list].sort((a, b) => {
      let av: string | number
      let bv: string | number

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
    <Card className="app-panel">
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
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pr-8 pl-8"
            placeholder="Hledat fakturu, odběratele, stav…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                const isDraft = invoice.status === "draft"
                const isActive = activeInvoiceId === invoice.id
                const isWaitingForSend = isInvoiceWaitingForSend(invoice)
                const canTogglePaid = !isDraft && !isWaitingForSend
                const hasWorkflowAction = isWaitingForSend || canTogglePaid
                const statusLabel = getInvoiceStatusLabel(invoice)
                const statusBadgeVariant = getInvoiceStatusVariant(invoice)
                const rowBgClass = getInvoiceRowBgClass(invoice)
                return (
                  <li
                    key={invoice.id}
                    className={cn(
                      "rounded-xl border shadow-sm",
                      rowBgClass,
                      isActive && "border-primary/45 !bg-primary/10"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full p-3 text-left"
                      onClick={() => onLoad(invoice.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="leading-tight font-medium">
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
                        <Badge variant={statusBadgeVariant}>
                          {statusLabel}
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
                      {/* U zaplacené faktury žádná rychlá akce — od-zaplacení je schované v „…“ menu */}
                      {isPaid ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 flex-1"
                          onClick={() =>
                            isDraft
                              ? onLoad(invoice.id)
                              : isWaitingForSend
                                ? onMarkSent(invoice.id)
                                : onTogglePaid(invoice.id, true)
                          }
                        >
                          {isDraft ? (
                            <>
                              <PencilIcon className="size-4" />
                              Dokončit
                            </>
                          ) : isWaitingForSend ? (
                            <>
                              <SendIcon className="size-4" />
                              Odesláno
                            </>
                          ) : (
                            <>
                              <CheckCircle2Icon className="size-4" />
                              Zaplaceno
                            </>
                          )}
                        </Button>
                      )}
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
                          {isWaitingForSend ? (
                            <DropdownMenuItem
                              onClick={() => onMarkSent(invoice.id)}
                            >
                              <SendIcon />
                              Označit jako odesláno
                            </DropdownMenuItem>
                          ) : null}
                          {canTogglePaid ? (
                            <DropdownMenuItem
                              onClick={() => onTogglePaid(invoice.id, !isPaid)}
                            >
                              <CheckCircle2Icon />
                              {isPaid
                                ? "Označit jako nezaplaceno"
                                : "Označit jako zaplaceno"}
                            </DropdownMenuItem>
                          ) : null}
                          {hasWorkflowAction ? <DropdownMenuSeparator /> : null}
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
            <div className="hidden overflow-x-auto rounded-xl border bg-background/30 md:block">
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
                    const isDraft = invoice.status === "draft"
                    const isWaitingForSend = isInvoiceWaitingForSend(invoice)
                    const canTogglePaid = !isDraft && !isWaitingForSend
                    const hasWorkflowAction = isWaitingForSend || canTogglePaid
                    const statusLabel = getInvoiceStatusLabel(invoice)
                    const statusBadgeVariant = getInvoiceStatusVariant(invoice)
                    const rowBgClass = getInvoiceRowBgClass(invoice)
                    return (
                      <ContextMenu key={invoice.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow
                            className={cn(
                              "cursor-pointer hover:brightness-95 dark:hover:brightness-110",
                              rowBgClass,
                              activeInvoiceId === invoice.id && "!bg-primary/10"
                            )}
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
                              <Badge variant={statusBadgeVariant}>
                                {statusLabel}
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
                          {invoice.contact_email ? (
                            <ContextMenuItem asChild>
                              <a
                                href={
                                  buildReminderMailtoHref(invoice) ?? undefined
                                }
                              >
                                <MailIcon className="size-4" />
                                Otevřít v e-mailu
                              </a>
                            </ContextMenuItem>
                          ) : null}
                          <ContextMenuSeparator />
                          {isWaitingForSend ? (
                            <ContextMenuItem
                              onClick={() => onMarkSent(invoice.id)}
                            >
                              <SendIcon />
                              Označit jako odesláno
                            </ContextMenuItem>
                          ) : null}
                          {canTogglePaid ? (
                            <ContextMenuItem
                              onClick={() => onTogglePaid(invoice.id, !isPaid)}
                            >
                              <CheckCircle2Icon className="size-4" />
                              {isPaid
                                ? "Označit jako nezaplaceno"
                                : "Označit jako zaplaceno"}
                            </ContextMenuItem>
                          ) : null}
                          {hasWorkflowAction ? <ContextMenuSeparator /> : null}
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
    <section className="invoice-preview-overlay fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div
        className="no-print flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur-xl md:flex-row md:items-center md:justify-between"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
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
          {buildReminderMailtoHrefForDraft(draft) ? (
            <Button variant="outline" asChild>
              <a href={buildReminderMailtoHrefForDraft(draft)!}>
                <MailIcon data-icon="inline-start" />
                E-mail
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <MailIcon data-icon="inline-start" />
              E-mail
            </Button>
          )}
        </div>
      </div>
      <div className="invoice-stage invoice-preview-stage">
        <InvoiceDocument draft={draft} qrDataUrl={qrDataUrl} total={total} />
      </div>
    </section>
  )
}

function MobileEditorActionBar({
  authReady,
  isSyncing,
  lines,
  onAddCustomLine,
  onExport,
  onRemoveLine,
  onSave,
  onUpdateLine,
  total,
}: {
  authReady: boolean
  isSyncing: boolean
  lines: InvoiceLine[]
  onAddCustomLine: () => void
  onExport: () => void
  onRemoveLine: (id: string) => void
  onSave: () => void
  onUpdateLine: (id: string, changes: Partial<InvoiceLine>) => void
  total: number
}) {
  return (
    <div
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 shadow-[0_-12px_30px_oklch(0.18_0.012_95_/_12%)] backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <Button
          asChild
          size="icon-lg"
          variant="outline"
          aria-label="Přejít na ceník"
        >
          <a href="#cenik-sekce">
            <ShoppingCartIcon data-icon="inline-start" />
          </a>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {lines.length} položek · K úhradě
          </p>
          <p className="truncate text-base font-semibold tabular-nums">
            {formatCurrency(total)}
          </p>
        </div>
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="lg" variant="outline">
              <ShoppingCartIcon data-icon="inline-start" />
              Položky
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[82svh]">
            <DrawerHeader>
              <DrawerTitle>Položky faktury</DrawerTitle>
              <DrawerDescription>
                Přehled a úprava všeho, co je právě přidané na fakturu.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto pb-4">
              <InvoiceLinesEditor
                lines={lines}
                total={total}
                onAddCustomLine={onAddCustomLine}
                onRemoveLine={onRemoveLine}
                onUpdateLine={onUpdateLine}
              />
            </div>
          </DrawerContent>
        </Drawer>
        <Button
          size="icon-lg"
          variant="outline"
          disabled={isSyncing || !authReady}
          aria-label="Uložit fakturu"
          onClick={onSave}
        >
          <SaveIcon />
        </Button>
        <Button size="lg" disabled={isSyncing} onClick={onExport}>
          <PrinterIcon data-icon="inline-start" />
          PDF
        </Button>
      </div>
    </div>
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
          {draft.contactName && <span>{draft.contactName}</span>}
          {customerAddress.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {(draft.customerCompanyId || draft.customerTaxId) && (
            <p>
              {draft.customerCompanyId && `IČO: ${draft.customerCompanyId}`}
              {draft.customerCompanyId && draft.customerTaxId && <br />}
              {draft.customerTaxId && `DIČ: ${draft.customerTaxId}`}
            </p>
          )}
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
  const now = new Date()
  const currentYear = String(now.getFullYear())
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`

  return invoices.reduce(
    (stats, invoice) => {
      const amount = Number(invoice.total_amount) || 0
      const isCancelled = invoice.status === "cancelled"
      const isPaid = invoice.status === "paid"
      const isDraft = invoice.status === "draft"

      if (isCancelled) {
        stats.cancelledCount += 1
        return stats
      }

      if (isDraft) {
        stats.waitingSendCount += 1
        stats.waitingSendTotal += amount
        return stats
      }

      if (isPaid) {
        stats.paidCount += 1
        stats.paidTotal += amount
      } else {
        stats.unpaidCount += 1
        stats.unpaidTotal += amount
        stats.activeTotal += amount

        if (isInvoiceOverdue(invoice)) {
          stats.overdueCount += 1
          stats.overdueTotal += amount
        }

        stats.waitingPaymentCount += 1
        stats.waitingPaymentTotal += amount
      }

      // Příjmy podle období (paid + issued, bez draft/cancelled)
      const issueDate = invoice.issue_date ?? ""
      if (issueDate.startsWith(currentMonth)) {
        stats.thisMonthCount += 1
        stats.thisMonthTotal += amount
      }
      if (issueDate.startsWith(currentYear)) {
        stats.thisYearCount += 1
        stats.thisYearTotal += amount
      }

      return stats
    },
    {
      activeTotal: 0,
      cancelledCount: 0,
      overdueCount: 0,
      overdueTotal: 0,
      paidCount: 0,
      paidTotal: 0,
      thisMonthCount: 0,
      thisMonthTotal: 0,
      thisYearCount: 0,
      thisYearTotal: 0,
      unpaidCount: 0,
      unpaidTotal: 0,
      waitingPaymentCount: 0,
      waitingPaymentTotal: 0,
      waitingSendCount: 0,
      waitingSendTotal: 0,
    }
  )
}

function getInvoiceFollowUpItems(
  invoices: InvoiceSummary[]
): InvoiceFollowUpItem[] {
  return invoices
    .map((invoice) => {
      const daysUntilDue = getInvoiceDaysUntilDue(invoice)

      if (daysUntilDue === null || !isInvoiceOpenForPayment(invoice)) {
        return null
      }

      if (daysUntilDue > FOLLOW_UP_SOON_DAYS) {
        return null
      }

      return {
        invoice,
        daysUntilDue,
        urgency: daysUntilDue < 0 ? "overdue" : "soon",
      } satisfies InvoiceFollowUpItem
    })
    .filter((item): item is InvoiceFollowUpItem => item !== null)
    .sort((a, b) => {
      const dueOrder = a.daysUntilDue - b.daysUntilDue

      if (dueOrder !== 0) {
        return dueOrder
      }

      return Number(b.invoice.total_amount) - Number(a.invoice.total_amount)
    })
}

function getInvoiceDaysUntilDue(invoice: InvoiceSummary) {
  if (!invoice.due_date) {
    return null
  }

  return getDateInputDistance(todayInput(), invoice.due_date)
}

function getDateInputDistance(fromDateInput: string, toDateInput: string) {
  const from = parseDateInput(fromDateInput)
  const to = parseDateInput(toDateInput)

  if (!from || !to) {
    return null
  }

  const dayMs = 24 * 60 * 60 * 1000

  return Math.round((to.getTime() - from.getTime()) / dayMs)
}

function parseDateInput(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function formatDueDistance(daysUntilDue: number) {
  if (daysUntilDue < 0) {
    const overdueDays = Math.abs(daysUntilDue)

    return `${overdueDays} ${formatDayUnit(overdueDays)} po splatnosti`
  }

  if (daysUntilDue === 0) {
    return "Splatné dnes"
  }

  if (daysUntilDue === 1) {
    return "Splatné zítra"
  }

  return `Splatné za ${daysUntilDue} ${formatDayUnit(daysUntilDue)}`
}

function formatDayUnit(count: number) {
  if (count === 1) {
    return "den"
  }

  if (count > 1 && count < 5) {
    return "dny"
  }

  return "dní"
}

function buildPaymentReminderText(invoice: InvoiceSummary) {
  const daysUntilDue = getInvoiceDaysUntilDue(invoice)
  const amount = formatCurrency(Number(invoice.total_amount) || 0)
  const project = [
    invoice.project_title?.trim(),
    invoice.project_subtitle?.trim(),
  ]
    .filter(Boolean)
    .join(", ")
  const intro =
    daysUntilDue !== null && daysUntilDue < 0
      ? "připomínám fakturu"
      : "připomínám blížící se splatnost faktury"
  const dueText =
    daysUntilDue !== null && daysUntilDue < 0
      ? `Splatnost byla ${formatDate(invoice.due_date)}.`
      : `Splatnost je ${formatDate(invoice.due_date)}.`
  const greeting = invoice.contact_name.trim()
    ? `Dobrý den, ${invoice.contact_name.trim()},`
    : "Dobrý den,"

  return [
    greeting,
    "",
    `${intro} ${invoice.invoice_number}${project ? ` za ${project}` : ""} na částku ${amount}. ${dueText}`,
    "V evidenci ji mám zatím jako neuhrazenou. Prosím o kontrolu platby a případně o informaci, kdy bude odeslaná.",
    "",
    "Děkuji,",
    supplier.name,
  ].join("\n")
}

function formatInvoiceContactLine(invoice: InvoiceSummary) {
  return [
    invoice.contact_name.trim(),
    invoice.contact_email.trim(),
    invoice.contact_phone.trim(),
  ]
    .filter(Boolean)
    .join(" · ")
}

function buildReminderMailtoHref(invoice: InvoiceSummary) {
  const email = invoice.contact_email.trim()

  if (!email) {
    return null
  }

  const subject = encodeURIComponent(buildReminderSubject(invoice))
  const body = encodeURIComponent(buildPaymentReminderText(invoice))

  return `mailto:${email}?subject=${subject}&body=${body}`
}

function buildReminderMailtoHrefForDraft(draft: InvoiceDraft): string | null {
  if (!draft.contactEmail || !draft.id) {
    return null
  }

  return buildReminderMailtoHref({
    id: draft.id,
    invoice_number: draft.invoiceNumber,
    customer_name: draft.customerName,
    contact_name: draft.contactName,
    contact_email: draft.contactEmail,
    contact_phone: draft.contactPhone,
    issue_date: draft.issueDate,
    due_date: draft.dueDate,
    project_title: draft.projectTitle,
    project_subtitle: draft.projectSubtitle,
    status: draft.status,
    paid_at: draft.paidAt,
    total_amount: calculateTotal(draft.lines),
    exported_at: draft.exportedAt,
    export_count: draft.exportCount,
    last_reminded_at: draft.lastRemindedAt,
    updated_at: "",
  })
}

function buildReminderSmsHref(invoice: InvoiceSummary) {
  const phone = normalizePhoneHref(invoice.contact_phone)

  if (!phone) {
    return null
  }

  return `sms:${phone}?&body=${encodeURIComponent(buildPaymentReminderText(invoice))}`
}

function buildContactTelHref(invoice: InvoiceSummary) {
  const phone = normalizePhoneHref(invoice.contact_phone)

  return phone ? `tel:${phone}` : null
}

function buildReminderSubject(invoice: InvoiceSummary) {
  return `Upomínka faktury ${invoice.invoice_number}`
}

function normalizePhoneHref(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const prefix = trimmed.startsWith("+") ? "+" : ""
  const digits = trimmed.replace(/\D/g, "")

  return digits ? `${prefix}${digits}` : null
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.opacity = "0"
  document.body.append(textarea)
  textarea.select()

  const didCopy = document.execCommand("copy")
  textarea.remove()

  if (!didCopy) {
    throw new Error("Prohlížeč nepovolil kopírování do schránky.")
  }
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

function todayInput() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
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
  const [raw, setRaw] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const displayValue = isEditing ? raw : formatHoursDisplay(value)

  return (
    <Input
      inputMode="decimal"
      placeholder="0:30"
      className={className}
      value={displayValue}
      onFocus={() => {
        setRaw(formatHoursDisplay(value))
        setIsEditing(true)
      }}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        const parsed = parseHoursInput(displayValue)
        onChange(parsed)
        setRaw("")
        setIsEditing(false)
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

    const nextDraft = {
      ...fallback,
      ...parsed,
      lines: Array.isArray(parsed.lines) ? parsed.lines : fallback.lines,
    }

    assertInvoiceDraftInvariant(nextDraft, "stored draft")

    return nextDraft
  } catch {
    return createDefaultDraft()
  }
}

export default App
