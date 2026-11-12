/** Paginate measured HTML, using the same physical A4 layout for screen and print.
 * Only the empty output container is owned here; React owns the source template.
 */
export function paginateInvoice(source: HTMLElement, output: HTMLElement) {
  output.replaceChildren()
  const required = <T extends HTMLElement>(selector: string): T => {
    const node = source.querySelector<T>(selector)
    if (!node) throw new Error(`Chybí část šablony faktury: ${selector}`)
    return node
  }
  const clone = <T extends HTMLElement>(node: T) => node.cloneNode(true) as T
  const header = required(".invoice-top")
  const items = required(".invoice-items")
  const footer = required(".invoice-footer")
  const total = required(".invoice-total")
  const tableTemplate = clone(items)
  tableTemplate.querySelector("tbody")!.replaceChildren()
  tableTemplate.querySelector(".invoice-total")!.remove()
  const pages: HTMLElement[] = []

  function newPage(first = false) {
    const page = document.createElement("article")
    page.className = "invoice-sheet"
    page.setAttribute("aria-label", `Strana faktury ${pages.length + 1}`)
    page.append(clone(header))
    if (first) {
      for (const child of source.children) {
        if (child !== header && child !== items && child !== footer)
          page.append(child.cloneNode(true))
      }
    }
    const section = clone(tableTemplate)
    page.append(section, clone(footer))
    output.append(page)
    pages.push(page)
    return page
  }

  let page = newPage(true)
  const body = () => page.querySelector("tbody")!
  const fits = () => {
    const pageRect = page.getBoundingClientRect()
    const footer = page.querySelector<HTMLElement>(".invoice-footer")!
    const section = page.querySelector<HTMLElement>(".invoice-items")!
    const bottomPadding = parseFloat(getComputedStyle(page).paddingBottom)
    // Small reserve avoids fractional pixel overflow during print conversion.
    return (
      section.getBoundingClientRect().bottom +
        footer.getBoundingClientRect().height +
        bottomPadding +
        2 <=
      pageRect.bottom
    )
  }
  if (!fits())
    throw new Error(
      "Údaje v záhlaví jsou příliš dlouhé pro A4. Zkrať adresu nebo název zakázky."
    )

  for (const original of source.querySelectorAll<HTMLTableRowElement>(
    "tbody tr"
  )) {
    let row = clone(original)
    body().append(row)
    if (fits()) continue
    row.remove()
    page = newPage()
    body().append(row)
    if (fits()) continue

    // A single description can exceed an entire page. Split it at measured
    // character boundaries (prefer words), showing amounts only on its first part.
    let remaining = Array.from(original.cells[0].textContent ?? "")
    while (remaining.length) {
      let low = 0
      let high = remaining.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        row.cells[0].textContent = remaining.slice(0, middle).join("")
        if (fits()) low = middle
        else high = middle - 1
      }
      if (!low)
        throw new Error(
          "Položka se nevejde na A4. Zkrať název zakázky nebo platební údaje."
        )
      let end = low
      if (end < remaining.length) {
        const prefix = remaining.slice(0, end).join("")
        const boundary = prefix.search(/\s+\S*$/u)
        const wordEnd = Array.from(prefix.slice(0, boundary + 1)).length
        if (boundary >= 0 && wordEnd > end / 2) end = wordEnd
      }
      row.cells[0].textContent = remaining.slice(0, end).join("")
      remaining = remaining.slice(end)
      if (remaining.length) {
        page = newPage()
        row = clone(original)
        row.dataset.continuation = "true"
        for (const cell of Array.from(row.cells).slice(1)) cell.textContent = ""
        body().append(row)
      }
    }
  }

  let summary = clone(total)
  page.querySelector(".invoice-items")!.append(summary)
  if (!fits()) {
    summary.remove()
    page = newPage()
    summary = clone(total)
    page.querySelector(".invoice-items")!.append(summary)
    if (!fits())
      throw new Error("Souhrn faktury se nevejde na A4. Zkrať název zakázky.")
  }
  pages.forEach((page, index) => {
    page.querySelector(".invoice-footer span")!.textContent =
      `Strana ${index + 1} / ${pages.length}`
  })
  return pages.length
}
