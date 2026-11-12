import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { InvoiceDocument } from "../../src/components/invoice-document"
import type { InvoiceDraft } from "../../src/lib/invoice"
import type { SupplierSettings } from "../../src/lib/supplier-settings"
import "../../src/index.css"

const root = createRoot(document.getElementById("root")!)
window.addEventListener("invoice:test", (event) => {
  const props = (
    event as CustomEvent<{
      draft: InvoiceDraft
      supplierSettings: SupplierSettings
      total: number
      qrDataUrl: string
    }>
  ).detail
  root.render(
    <StrictMode>
      <div className="app-cockpit">
        <header>Ovládání aplikace se nesmí tisknout</header>
        <section className="invoice-preview-overlay fixed inset-0 flex flex-col bg-background">
          <div className="no-print">Ovládání náhledu se nesmí tisknout</div>
          <div className="invoice-stage invoice-preview-stage">
            <InvoiceDocument {...props} />
          </div>
        </section>
      </div>
    </StrictMode>
  )
})
document.documentElement.dataset.fixtureReady = "true"
