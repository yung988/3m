import { describe, expect, test } from "bun:test"

import { buildPaymentQrString, createDefaultDraft } from "../src/lib/invoice"
import {
  defaultSupplierSettings,
  getSupplierSettings,
  parseCzechAccountNumber,
} from "../src/lib/supplier-settings"

describe("nastavení dodavatele", () => {
  test("současný účet má stejný IBAN jako na původní faktuře", () => {
    expect(parseCzechAccountNumber("2991647014/3030")?.iban).toBe(
      defaultSupplierSettings.iban
    )
  })

  test("účet s předčíslím se převádí podle příkladu ČNB", () => {
    expect(parseCzechAccountNumber("19-2000145399/0800")?.iban).toBe(
      "CZ6508000000192000145399"
    )
  })

  test("překlep v čísle účtu neprojde kontrolou", () => {
    expect(parseCzechAccountNumber("2991647015/3030")).toBeNull()
    expect(parseCzechAccountNumber("2991647014")).toBeNull()
  })

  test("uložené údaje patří metadatům přihlášeného uživatele", () => {
    const settings = getSupplierSettings({
      invoice_settings: {
        name: "Nový dodavatel",
        accountNumber: "19-2000145399/0800",
        bank: "Jiná banka",
        bic: "TESTCZPP",
      },
    })

    expect(settings.name).toBe("Nový dodavatel")
    expect(settings.iban).toBe("CZ6508000000192000145399")
    expect(getSupplierSettings(null)).toEqual(defaultSupplierSettings)
  })

  test("QR platba používá IBAN vybraného účtu", () => {
    const draft = { ...createDefaultDraft(), invoiceNumber: "2026001" }
    const qr = buildPaymentQrString(draft, 100, "CZ6508000000192000145399")

    expect(qr).toContain("ACC:CZ6508000000192000145399")
    expect(qr).toContain("AM:100.00")
  })
})
