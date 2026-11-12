import { describe, expect, test } from "bun:test"

import { buildPaymentQrString, createDefaultDraft } from "../src/lib/invoice"
import {
  defaultSupplierSettings,
  getSupplierSettings,
  getSupplierValidationIssues,
  parseCzechAccountNumber,
} from "../src/lib/supplier-settings"

describe("nastavení dodavatele", () => {
  test("současný účet má stejný IBAN jako na původní faktuře", () => {
    expect(parseCzechAccountNumber("2991647014/3030")?.iban).toBe(
      "CZ4430300000002991647014"
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

describe("úplný profil dodavatele v Supabase", () => {
  const profile = {
    name: "Jiný dodavatel",
    addressLines: [" Ulice 1 ", "12345 Město", ""],
    companyId: "12345678",
    vatNote: "Vlastní poznámka",
    email: "faktury@example.com",
    phone: "+420 123 456 789",
    accountNumber: "19-2000145399/0800",
    bank: "Česká spořitelna",
    bic: "GIBACZPX",
  }

  test("všechny údaje se načítají z profilu, IBAN se dopočítá", () => {
    const settings = getSupplierSettings({
      invoice_settings: { ...profile, iban: "nesprávný" },
    })
    expect(settings).toEqual({
      ...profile,
      addressLines: ["Ulice 1", "12345 Město"],
      iban: "CZ6508000000192000145399",
    })
    expect(getSupplierValidationIssues(settings)).toEqual([])
  })

  test("chybějící profil neobsahuje cizí identitu ani bankovní účet", () => {
    const settings = getSupplierSettings(null)
    expect(settings.name).toBe("")
    expect(settings.accountNumber).toBe("")
    expect(settings.addressLines).toEqual([])
    expect(getSupplierValidationIssues(settings)).toHaveLength(4)
  })

  test("vadný účet nesmaže ostatní údaje a zabrání platbě na výchozí účet", () => {
    const settings = getSupplierSettings({
      invoice_settings: { ...profile, accountNumber: "překlep" },
    })
    expect(settings.name).toBe(profile.name)
    expect(settings.email).toBe(profile.email)
    expect(settings.iban).toBe("")
    expect(getSupplierValidationIssues(settings)).toContain(
      "Vyplň platné české číslo účtu."
    )
  })

  test("starší neúplný profil vyžaduje doplnění adresy a IČO", () => {
    const settings = getSupplierSettings({
      invoice_settings: {
        name: profile.name,
        accountNumber: profile.accountNumber,
      },
    })
    expect(getSupplierValidationIssues(settings)).toEqual([
      "Vyplň adresu dodavatele.",
      "IČO musí mít 8 číslic.",
    ])
  })

  test("neplatné typy z metadat mají bezpečné prázdné hodnoty", () => {
    const settings = getSupplierSettings({
      invoice_settings: {
        name: 123,
        addressLines: [null, 7, " Adresa "],
        email: {},
      },
    })
    expect(settings.name).toBe("")
    expect(settings.email).toBe("")
    expect(settings.addressLines).toEqual(["Adresa"])
  })
})
