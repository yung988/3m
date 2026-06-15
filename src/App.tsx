import { useCallback, useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import * as QRCode from "qrcode"
import {
  CloudIcon,
  FilePlus2Icon,
  LogOutIcon,
  PlusCircleIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
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
import { priceCategories, priceList } from "@/data/price-list"
import {
  buildPaymentQrString,
  calculateTotal,
  createDefaultDraft,
  createEmptyLine,
  createLineFromPriceItem,
  formatCurrency,
  formatDate,
  formatQuantity,
  normalizeMoneyInput,
  payment,
  supplier,
  type InvoiceDraft,
  type InvoiceLine,
  type InvoiceStatus,
} from "@/lib/invoice"
import {
  deleteInvoice,
  listInvoices,
  loadInvoice,
  saveInvoice,
  type InvoiceSummary,
} from "@/lib/invoice-repository"
import { supabase } from "@/lib/supabase"

const STORAGE_KEY = "faktury-pro-stepu:draft:v1"

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

function App() {
  const [draft, setDraft] = useState<InvoiceDraft>(() => readStoredDraft())
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [savedInvoices, setSavedInvoices] = useState<InvoiceSummary[]>([])
  const [savedInvoicesLoading, setSavedInvoicesLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<AppMessage | null>(null)

  const total = useMemo(() => calculateTotal(draft.lines), [draft.lines])
  const user = session?.user ?? null
  const paymentQrString = useMemo(
    () => buildPaymentQrString(draft, total),
    [draft, total]
  )

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("cs-CZ")

    return priceList.filter((item) => {
      const categoryMatches =
        selectedCategory === "all" || item.category === selectedCategory
      const queryMatches =
        query.length === 0 ||
        item.name.toLocaleLowerCase("cs-CZ").includes(query) ||
        item.category.toLocaleLowerCase("cs-CZ").includes(query)

      return categoryMatches && queryMatches
    })
  }, [search, selectedCategory])

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

  function addLine(line: InvoiceLine) {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, line],
    }))
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
    if (window.confirm("Vrátit ukázkovou fakturu a smazat rozepsané změny?")) {
      setDraft(createDefaultDraft())
    }
  }

  async function handleAuth(mode: "sign-in" | "sign-up") {
    setAuthLoading(true)
    setMessage(null)

    try {
      const credentials = {
        email: authEmail.trim(),
        password: authPassword,
      }
      const { error } =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword(credentials)
          : await supabase.auth.signUp(credentials)

      if (error) {
        throw error
      }

      setMessage({
        title: mode === "sign-in" ? "Přihlášeno" : "Účet vytvořen",
        description:
          mode === "sign-in"
            ? "Faktury se teď můžou ukládat do Supabase."
            : "Pokud má projekt zapnuté potvrzení e-mailu, potvrď účet v e-mailu a potom se přihlas.",
      })
    } catch (error) {
      showError(
        mode === "sign-in" ? "Přihlášení selhalo" : "Registrace selhala",
        error
      )
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
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
        title: "Nejdřív se přihlas",
        description:
          "Bez přihlášení můžeš fakturu sestavit a tisknout, ale ne uložit do databáze.",
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

  function handleNewInvoice() {
    setDraft(createDefaultDraft())
    setMessage({
      title: "Nová faktura",
      description: "Editor je připravený pro další doklad.",
    })
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="no-print sticky top-0 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl leading-tight font-semibold">
                Faktury pro Štěpu
              </h1>
              <Badge variant="secondary">3M ENERGY</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Klikací ceník, rozepsané položky a faktura připravená pro tisk do
              PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <Badge variant="outline" className="h-8 max-w-56 truncate px-3">
                {user.email}
              </Badge>
            ) : null}
            <Button variant="outline" onClick={handleNewInvoice}>
              <PlusCircleIcon data-icon="inline-start" />
              Nová
            </Button>
            <Button
              onClick={handleSaveInvoice}
              disabled={syncing || !authReady}
            >
              <SaveIcon data-icon="inline-start" />
              {syncing ? "Ukládám" : "Uložit"}
            </Button>
            <Button variant="outline" onClick={resetDraft}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
            <Button onClick={() => window.print()}>
              <PrinterIcon data-icon="inline-start" />
              Tisk / PDF
            </Button>
            {user ? (
              <Button variant="outline" onClick={handleSignOut}>
                <LogOutIcon data-icon="inline-start" />
                Odhlásit
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,380px)_minmax(560px,1fr)_minmax(520px,680px)]">
        <div className="no-print flex h-fit flex-col gap-4 lg:sticky lg:top-24">
          {user ? (
            <SavedInvoicesCard
              activeInvoiceId={draft.id}
              invoices={savedInvoices}
              isLoading={savedInvoicesLoading}
              onDelete={handleDeleteInvoice}
              onLoad={handleLoadInvoice}
            />
          ) : (
            <AuthCard
              email={authEmail}
              isLoading={authLoading}
              onEmailChange={setAuthEmail}
              onPasswordChange={setAuthPassword}
              onSubmit={handleAuth}
              password={authPassword}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ceník úkonů</CardTitle>
              <CardDescription>
                Položka se přidá na fakturu jedním kliknutím.
              </CardDescription>
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

              <div className="max-h-[62svh] overflow-y-auto pr-1">
                {filteredItems.length > 0 ? (
                  <ul className="flex flex-col">
                    {filteredItems.map((item) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-3 last:border-b-0"
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
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              aria-label={`Přidat: ${item.name}`}
                              onClick={() =>
                                addLine(createLineFromPriceItem(item))
                              }
                            >
                              <PlusIcon data-icon="inline-start" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Přidat položku</TooltipContent>
                        </Tooltip>
                      </li>
                    ))}
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

        <Card className="no-print h-fit">
          <CardHeader>
            <CardTitle>Rozpis faktury</CardTitle>
            <CardDescription>
              Čísla a texty se ukládají do Supabase po kliknutí na Uložit.
            </CardDescription>
            <CardAction>
              <Button
                variant="outline"
                onClick={() => addLine(createEmptyLine())}
              >
                <FilePlus2Icon data-icon="inline-start" />
                Vlastní položka
              </Button>
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
              <FieldGroup className="grid gap-4 md:grid-cols-4">
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
                  <FieldLabel htmlFor="issue-date">Datum vystavení</FieldLabel>
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
                  <FieldLabel htmlFor="due-date">Datum splatnosti</FieldLabel>
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
                      updateDraftField("status", value as InvoiceStatus)
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
              <FieldGroup className="grid gap-4 md:grid-cols-2">
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
                        <Input
                          inputMode="decimal"
                          value={line.quantity}
                          className="text-right"
                          onChange={(event) =>
                            updateLine(line.id, {
                              quantity: normalizeMoneyInput(event.target.value),
                            })
                          }
                        />
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
              {draft.lines.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Přidej položku z ceníku nebo vlastní řádek.
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

        <section className="invoice-stage lg:col-span-2 2xl:col-span-1">
          <InvoiceDocument draft={draft} qrDataUrl={qrDataUrl} total={total} />
        </section>
      </main>
    </div>
  )
}

function AuthCard({
  email,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  password,
}: {
  email: string
  isLoading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (mode: "sign-in" | "sign-up") => void
  password: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Databáze</CardTitle>
        <CardDescription>
          Přihlášení zapne ukládání faktur do Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit("sign-in")
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
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" disabled={isLoading}>
              <CloudIcon data-icon="inline-start" />
              Přihlásit
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => onSubmit("sign-up")}
            >
              Vytvořit účet
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SavedInvoicesCard({
  activeInvoiceId,
  invoices,
  isLoading,
  onDelete,
  onLoad,
}: {
  activeInvoiceId?: string
  invoices: InvoiceSummary[]
  isLoading: boolean
  onDelete: (id: string) => void
  onLoad: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uložené faktury</CardTitle>
        <CardDescription>
          Doklady uložené pod přihlášeným účtem.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Načítám faktury…
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Zatím nic uloženého. Vyplň fakturu a klikni na Uložit.
          </div>
        ) : (
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b py-3 last:border-b-0"
              >
                <button
                  className="min-w-0 rounded-lg p-2 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  type="button"
                  onClick={() => onLoad(invoice.id)}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {invoice.invoice_number}
                    </span>
                    {activeInvoiceId === invoice.id ? (
                      <Badge variant="secondary">otevřená</Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {invoice.customer_name || "Bez odběratele"} ·{" "}
                    {formatCurrency(Number(invoice.total_amount))}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {statusLabels[invoice.status as InvoiceStatus]}
                  </span>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={`Smazat fakturu ${invoice.invoice_number}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(invoice.id)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Smazat z databáze</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
