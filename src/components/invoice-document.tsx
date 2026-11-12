import { useLayoutEffect, useRef } from "react"
import {
  formatCurrency,
  formatDate,
  formatQuantity,
  type InvoiceDraft,
} from "@/lib/invoice"
import type { SupplierSettings } from "@/lib/supplier-settings"
import { paginateInvoice } from "@/lib/invoice-pagination"

type Props = {
  draft: InvoiceDraft
  qrDataUrl: string
  supplierSettings: SupplierSettings
  total: number
}

export function InvoiceDocument(props: Props) {
  const sourceRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const { draft, qrDataUrl, supplierSettings, total } = props

  useLayoutEffect(() => {
    let cancelled = false
    const output = pagesRef.current!
    const status = statusRef.current!
    output.dataset.pagination = "pending"
    status.textContent = "Připravuji stránky faktury…"
    status.hidden = false
    function updatePages() {
      if (cancelled) return
      try {
        paginateInvoice(
          sourceRef.current!.firstElementChild as HTMLElement,
          output
        )
        output.dataset.pagination = "ready"
        status.hidden = true
      } catch (error) {
        output.replaceChildren()
        output.dataset.pagination = "error"
        status.textContent =
          error instanceof Error
            ? error.message
            : "Stránkování selhalo. Zavři náhled a zkus to znovu."
        status.hidden = false
      }
    }
    // Font metrics must be final before dividing rows between pages.
    void document.fonts.ready.then(updatePages)
    document.fonts.addEventListener("loadingdone", updatePages)
    window.addEventListener("beforeprint", updatePages)
    return () => {
      cancelled = true
      document.fonts.removeEventListener("loadingdone", updatePages)
      window.removeEventListener("beforeprint", updatePages)
    }
  }, [draft, qrDataUrl, supplierSettings, total])

  return (
    <>
      <p
        ref={statusRef}
        className="invoice-pagination-status no-print"
        role="status"
      />
      <div ref={sourceRef} className="invoice-measure" aria-hidden="true" inert>
        <InvoiceTemplate {...props} />
      </div>
      <div id="invoice-print" className="invoice-pages" ref={pagesRef} />
    </>
  )
}

function InvoiceTemplate({
  draft,
  qrDataUrl,
  supplierSettings,
  total,
}: {
  draft: InvoiceDraft
  qrDataUrl: string
  supplierSettings: SupplierSettings
  total: number
}) {
  const customerAddress = draft.customerAddress
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <article className="invoice-sheet">
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
              <dd>{supplierSettings.accountNumber}</dd>
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
            {supplierSettings.bank ? (
              <div>
                <dt>Banka:</dt>
                <dd>{supplierSettings.bank}</dd>
              </div>
            ) : null}
            {supplierSettings.bic ? (
              <div>
                <dt>BIC/SWIFT:</dt>
                <dd>{supplierSettings.bic}</dd>
              </div>
            ) : null}
            <div>
              <dt>IBAN:</dt>
              <dd>{supplierSettings.iban}</dd>
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
          <strong>{supplierSettings.name}</strong>
          {supplierSettings.addressLines.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
          <p>
            IČO: {supplierSettings.companyId}
            <br />
            {supplierSettings.vatNote}
          </p>
        </div>
        <div>
          <h2>Odběratel</h2>
          <strong>{draft.customerName}</strong>
          {draft.contactName && <span>{draft.contactName}</span>}
          {customerAddress.map((line, index) => (
            <span key={index}>{line}</span>
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
              <tr key={line.id} data-line-id={line.id}>
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
          {supplierSettings.email}
          <br />
          {supplierSettings.phone}
        </strong>
      </footer>
    </article>
  )
}
