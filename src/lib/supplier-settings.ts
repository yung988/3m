import { payment, supplier } from "@/lib/invoice"

export type SupplierSettings = {
  name: string
  accountNumber: string
  iban: string
  bank: string
  bic: string
}

export const defaultSupplierSettings: SupplierSettings = {
  name: supplier.name,
  accountNumber: payment.accountNumber,
  iban: payment.iban,
  bank: payment.bank,
  bic: payment.bic,
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

  const bban =
    bankCode + prefixDigits + numberDigits
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
    ) % 11 === 0
  )
}

export function getSupplierSettings(metadata: unknown): SupplierSettings {
  const value =
    metadata && typeof metadata === "object" && "invoice_settings" in metadata
      ? metadata.invoice_settings
      : null

  if (!value || typeof value !== "object") return defaultSupplierSettings

  const saved = value as Record<string, unknown>
  const account =
    typeof saved.accountNumber === "string"
      ? parseCzechAccountNumber(saved.accountNumber)
      : null

  if (!account) return defaultSupplierSettings

  return {
    name:
      typeof saved.name === "string" && saved.name.trim()
        ? saved.name.trim()
        : supplier.name,
    accountNumber: account.accountNumber,
    iban: account.iban,
    bank: typeof saved.bank === "string" ? saved.bank.trim() : "",
    bic: typeof saved.bic === "string" ? saved.bic.trim() : "",
  }
}
