export type SupplierSettings = {
  name: string
  addressLines: string[]
  companyId: string
  vatNote: string
  email: string
  phone: string
  accountNumber: string
  iban: string
  bank: string
  bic: string
}

export const defaultSupplierSettings: SupplierSettings = {
  name: "",
  addressLines: [],
  companyId: "",
  vatNote: "",
  email: "",
  phone: "",
  accountNumber: "",
  iban: "",
  bank: "",
  bic: "",
}

export function parseCzechAccountNumber(value: string) {
  const compact = value.replace(/\s/g, "")
  const match = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/.exec(compact)

  if (!match) return null

  const [, prefix, number, bankCode] = match
  const prefixDigits = (prefix || "").padStart(6, "0")
  const numberDigits = number.padStart(10, "0")

  if (
    !hasValidModulo11(prefixDigits, [10, 5, 8, 4, 2, 1]) ||
    !hasValidModulo11(numberDigits, [6, 3, 7, 9, 10, 5, 8, 4, 2, 1])
  ) {
    return null
  }

  const bban = bankCode + prefixDigits + numberDigits
  const checkDigits = String(98n - (BigInt(`${bban}123500`) % 97n)).padStart(
    2,
    "0"
  )

  return {
    accountNumber: `${prefix ? `${prefix}-` : ""}${number}/${bankCode}`,
    bankCode,
    iban: `CZ${checkDigits}${bban}`,
  }
}

function hasValidModulo11(digits: string, weights: number[]) {
  return (
    [...digits].reduce(
      (sum, digit, index) => sum + Number(digit) * weights[index],
      0
    ) %
      11 ===
    0
  )
}

export function getSupplierSettings(metadata: unknown): SupplierSettings {
  const value =
    metadata && typeof metadata === "object" && "invoice_settings" in metadata
      ? metadata.invoice_settings
      : null

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultSupplierSettings, addressLines: [] }
  }

  const saved = value as Record<string, unknown>
  const text = (key: string) =>
    typeof saved[key] === "string" ? saved[key].trim() : ""
  const account = parseCzechAccountNumber(text("accountNumber"))

  return {
    name: text("name"),
    addressLines: Array.isArray(saved.addressLines)
      ? saved.addressLines
          .filter((line): line is string => typeof line === "string")
          .map((line) => line.trim())
          .filter(Boolean)
      : [],
    companyId: text("companyId"),
    vatNote: text("vatNote"),
    email: text("email"),
    phone: text("phone"),
    accountNumber: text("accountNumber"),
    iban: account?.iban ?? "",
    bank: text("bank"),
    bic: text("bic"),
  }
}

export function getSupplierValidationIssues(
  settings: SupplierSettings
): string[] {
  const issues: string[] = []
  if (!settings.name.trim()) issues.push("Vyplň jméno dodavatele.")
  if (!settings.addressLines.some((line) => line.trim()))
    issues.push("Vyplň adresu dodavatele.")
  if (!/^\d{8}$/.test(settings.companyId.trim()))
    issues.push("IČO musí mít 8 číslic.")
  if (!parseCzechAccountNumber(settings.accountNumber))
    issues.push("Vyplň platné české číslo účtu.")
  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))
    issues.push("Zkontroluj e-mail dodavatele.")
  if (settings.bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(settings.bic))
    issues.push("BIC musí mít 8 nebo 11 znaků.")
  return issues
}
