import type { Json } from "@/lib/database.types"

export type ParsedAirBankTransaction = {
  sourceTransactionId: string
  accountIban: string | null
  counterpartyAccount: string | null
  counterpartyName: string | null
  bookedAt: string
  amount: number
  currency: string
  variableSymbol: string | null
  message: string | null
  rawData: Json
}

export function parseAirBankXml(xmlText: string): ParsedAirBankTransaction[] {
  const document = new DOMParser().parseFromString(xmlText, "application/xml")
  const parseError = firstByLocalName(document, "parsererror")

  if (parseError) {
    throw new Error("XML se nepodařilo přečíst. Zkontroluj export z banky.")
  }

  const statements = allByLocalName(document, "Stmt")
  const transactions = statements.flatMap(parseStatement)

  if (transactions.length === 0) {
    throw new Error("V XML výpisu jsem nenašel žádné bankovní pohyby.")
  }

  return transactions
}

function parseStatement(statement: Element): ParsedAirBankTransaction[] {
  const accountIban = textAt(statement, ["Acct", "Id", "IBAN"])
  const entries = allByLocalName(statement, "Ntry")

  return entries.flatMap((entry) => parseEntry(entry, accountIban))
}

function parseEntry(
  entry: Element,
  accountIban: string | null
): ParsedAirBankTransaction[] {
  const details = allByLocalName(entry, "TxDtls")
  const targets = details.length > 0 ? details : [entry]
  const entryRef = textAt(entry, ["NtryRef"]) ?? textAt(entry, ["AcctSvcrRef"])
  const entryBookedAt =
    textAt(entry, ["BookgDt", "Dt"]) ??
    textAt(entry, ["BookgDt", "DtTm"]) ??
    textAt(entry, ["ValDt", "Dt"]) ??
    textAt(entry, ["ValDt", "DtTm"])
  const entryDirection = firstTextByLocalName(entry, "CdtDbtInd")
  const entryAmount = parseAmountElement(firstByLocalName(entry, "Amt"))
  const entryMessage = firstTextByLocalName(entry, "AddtlNtryInf")
  const transactions: Array<ParsedAirBankTransaction | null> = targets.map(
    (target, index) => {
      const refs = firstByLocalName(target, "Refs")
      const relatedParties = firstByLocalName(target, "RltdPties")
      const amount =
        parseAmountElement(firstByLocalName(target, "Amt")) ?? entryAmount
      const direction =
        firstTextByLocalName(target, "CdtDbtInd") ?? entryDirection
      const bookedAt =
        textAt(target, ["BookgDt", "Dt"]) ??
        textAt(target, ["BookgDt", "DtTm"]) ??
        entryBookedAt
      const currency =
        firstByLocalName(target, "Amt")?.getAttribute("Ccy") ??
        firstByLocalName(entry, "Amt")?.getAttribute("Ccy") ??
        "CZK"
      const signedAmount = applyDirection(amount, direction)
      const endToEndId = refs ? textAt(refs, ["EndToEndId"]) : null
      const txId = refs ? textAt(refs, ["TxId"]) : null
      const accountServicerRef = refs ? textAt(refs, ["AcctSvcrRef"]) : null
      const creditorReference = textAt(target, [
        "RmtInf",
        "Strd",
        "CdtrRefInf",
        "Ref",
      ])
      const messages = allByLocalName(target, "Ustrd")
        .map((node) => cleanText(node.textContent))
        .filter(Boolean)
      const message = [messages.join(" "), entryMessage]
        .filter(Boolean)
        .join(" · ")
      const counterpartyName =
        relatedParties &&
        (textAt(relatedParties, ["Dbtr", "Nm"]) ??
          textAt(relatedParties, ["Cdtr", "Nm"]))
      const counterpartyAccount =
        relatedParties &&
        (textAt(relatedParties, ["DbtrAcct", "Id", "IBAN"]) ??
          textAt(relatedParties, ["DbtrAcct", "Id", "Othr", "Id"]) ??
          textAt(relatedParties, ["CdtrAcct", "Id", "IBAN"]) ??
          textAt(relatedParties, ["CdtrAcct", "Id", "Othr", "Id"]))
      const variableSymbol = extractVariableSymbol([
        endToEndId,
        creditorReference,
        message,
        entryMessage,
      ])
      const sourceSeed = [
        accountIban,
        entryRef,
        accountServicerRef,
        txId,
        endToEndId,
        bookedAt,
        signedAmount,
        currency,
        counterpartyAccount,
        variableSymbol,
        message,
        index,
      ].join("|")

      if (!bookedAt || signedAmount === null) {
        return null
      }

      return {
        sourceTransactionId: `airbank-${hashString(sourceSeed)}`,
        accountIban,
        counterpartyAccount,
        counterpartyName,
        bookedAt: normalizeDate(bookedAt),
        amount: signedAmount,
        currency: currency.toUpperCase(),
        variableSymbol,
        message: message || null,
        rawData: {
          entryRef,
          accountServicerRef,
          txId,
          endToEndId,
          creditorReference,
          direction,
        },
      }
    }
  )

  return transactions.filter(
    (item): item is ParsedAirBankTransaction => item !== null
  )
}

function allByLocalName(root: Document | Element, localName: string) {
  return Array.from(root.getElementsByTagNameNS("*", localName))
}

function firstByLocalName(root: Document | Element, localName: string) {
  return allByLocalName(root, localName)[0] ?? null
}

function textAt(root: Element, path: string[]) {
  let current: Element | null = root

  for (const part of path) {
    current = Array.from(current.children).find(
      (child) => child.localName === part
    ) as Element | null

    if (!current) {
      return null
    }
  }

  return cleanText(current.textContent)
}

function firstTextByLocalName(root: Document | Element, localName: string) {
  return cleanText(firstByLocalName(root, localName)?.textContent ?? "")
}

function parseAmountElement(element: Element | null) {
  if (!element?.textContent) {
    return null
  }

  const amount = Number(element.textContent.trim().replace(",", "."))

  return Number.isFinite(amount) ? amount : null
}

function applyDirection(amount: number | null, direction: string | null) {
  if (amount === null) {
    return null
  }

  return direction === "DBIT" ? -Math.abs(amount) : Math.abs(amount)
}

function extractVariableSymbol(values: Array<string | null>) {
  for (const value of values) {
    if (!value) {
      continue
    }

    const labeled = value.match(/(?:\/VS|(?:^|\b)VS[:\s-]*)(\d{1,10})/i)
    if (labeled?.[1]) {
      return labeled[1]
    }
  }

  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed && /^\d{4,10}$/.test(trimmed)) {
      return trimmed
    }
  }

  return null
}

function normalizeDate(value: string) {
  return value.slice(0, 10)
}

function cleanText(value: string | null | undefined) {
  const cleaned = value?.replace(/\s+/g, " ").trim()

  return cleaned || null
}

function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}
