import type { User } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import {
  calculateTotal,
  type InvoiceDraft,
  type InvoiceLine,
  type InvoiceStatus,
} from "@/lib/invoice"
import { getSupabaseClient } from "@/lib/supabase"

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"]
type InvoiceLineRow = Database["public"]["Tables"]["invoice_lines"]["Row"]
type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"]
type InvoiceLineInsert = Database["public"]["Tables"]["invoice_lines"]["Insert"]

export type InvoiceSummary = Pick<
  InvoiceRow,
  | "id"
  | "invoice_number"
  | "customer_name"
  | "issue_date"
  | "due_date"
  | "project_title"
  | "project_subtitle"
  | "status"
  | "paid_at"
  | "total_amount"
  | "exported_at"
  | "export_count"
  | "updated_at"
>

type InvoiceWithLines = InvoiceRow & {
  invoice_lines: InvoiceLineRow[]
}

export async function listInvoices() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, customer_name, issue_date, due_date, project_title, project_subtitle, status, paid_at, total_amount, exported_at, export_count, updated_at"
    )
    .order("issue_date", { ascending: false })
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return data satisfies InvoiceSummary[]
}

export async function loadInvoice(id: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_lines(*)")
    .eq("id", id)
    .single()

  if (error) {
    throw error
  }

  return fromInvoiceRow(data as InvoiceWithLines)
}

export async function saveInvoice(draft: InvoiceDraft, user: User) {
  const supabase = getSupabaseClient()
  const invoicePayload = toInvoicePayload(draft, user)
  const invoiceResult = draft.id
    ? await supabase
        .from("invoices")
        .update(invoicePayload)
        .eq("id", draft.id)
        .select()
        .single()
    : await supabase.from("invoices").insert(invoicePayload).select().single()

  if (invoiceResult.error) {
    throw invoiceResult.error
  }

  const invoiceId = invoiceResult.data.id

  const deleteResult = await supabase
    .from("invoice_lines")
    .delete()
    .eq("invoice_id", invoiceId)

  if (deleteResult.error) {
    throw deleteResult.error
  }

  if (draft.lines.length > 0) {
    const lineRows = draft.lines.map((line, index): InvoiceLineInsert => {
      return {
        invoice_id: invoiceId,
        owner_id: user.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        unit_label: line.unitLabel,
        position: index,
      }
    })

    const insertLinesResult = await supabase
      .from("invoice_lines")
      .insert(lineRows)

    if (insertLinesResult.error) {
      throw insertLinesResult.error
    }
  }

  return loadInvoice(invoiceId)
}

export async function deleteInvoice(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("invoices").delete().eq("id", id)

  if (error) {
    throw error
  }
}

export async function markInvoiceExported(id: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("invoices")
    .update({
      exported_at: new Date().toISOString(),
      export_count: await getNextExportCount(id),
    })
    .eq("id", id)
    .select("*, invoice_lines(*)")
    .single()

  if (error) {
    throw error
  }

  return fromInvoiceRow(data as InvoiceWithLines)
}

export async function setInvoicePaid(id: string, isPaid: boolean) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: isPaid ? "paid" : "issued",
      paid_at: isPaid ? toDateInput(new Date()) : null,
    })
    .eq("id", id)
    .select("*, invoice_lines(*)")
    .single()

  if (error) {
    throw error
  }

  return fromInvoiceRow(data as InvoiceWithLines)
}

function toInvoicePayload(draft: InvoiceDraft, user: User): InvoiceInsert {
  return {
    owner_id: user.id,
    invoice_number: draft.invoiceNumber,
    issue_date: draft.issueDate,
    due_date: draft.dueDate,
    project_title: draft.projectTitle,
    project_subtitle: draft.projectSubtitle,
    customer_name: draft.customerName,
    customer_address: draft.customerAddress,
    customer_company_id: draft.customerCompanyId,
    customer_tax_id: draft.customerTaxId,
    status: draft.status,
    paid_at: draft.paidAt,
    exported_at: draft.exportedAt,
    export_count: draft.exportCount,
    total_amount: calculateTotal(draft.lines),
    currency: "CZK",
  }
}

function fromInvoiceRow(row: InvoiceWithLines): InvoiceDraft {
  const lines = [...row.invoice_lines]
    .sort((a, b) => a.position - b.position)
    .map((line): InvoiceLine => {
      return {
        id: line.id,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unit_price),
        unitLabel: line.unit_label,
      }
    })

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    projectTitle: row.project_title,
    projectSubtitle: row.project_subtitle,
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    customerCompanyId: row.customer_company_id,
    customerTaxId: row.customer_tax_id,
    status: row.status as InvoiceStatus,
    paidAt: row.paid_at,
    exportedAt: row.exported_at,
    exportCount: row.export_count,
    lines,
  }
}

export async function getNextInvoiceNumber(): Promise<string> {
  const supabase = getSupabaseClient()
  const year = String(new Date().getFullYear())
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")

  if (error || !data) {
    return `${year}0021`
  }

  let max = 0
  for (const row of data) {
    const num = row.invoice_number
    if (num.startsWith(year)) {
      const seq = parseInt(num.slice(year.length), 10)
      if (!isNaN(seq) && seq > max) {
        max = seq
      }
    }
  }

  const next = max > 0 ? max + 1 : 21
  return `${year}${String(next).padStart(4, "0")}`
}

async function getNextExportCount(id: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("export_count")
    .eq("id", id)
    .single()

  if (error) {
    throw error
  }

  return data.export_count + 1
}

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}
