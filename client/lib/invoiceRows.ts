import { format } from "date-fns";

export type InvoiceRow = { description: string; tariff: number; extBed: number; disc: number; cgst: number; sgst: number; fnb: number; others: number };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Day-by-day GST invoice rows (one per room and night) from the bill's charge lines.
 * A room or extra-bed line covering several nights (coversNights) is shared evenly across them,
 * and the CGST / SGST posted the same day is shared across those rows in proportion to their
 * taxable value — so each night shows its own tariff and tax, and the totals stay exact.
 */
export function buildInvoiceRows(debitLines: any[], defaultRoomNum: string): InvoiceRow[] {
  const rows = new Map<string, InvoiceRow & { sort: string }>();
  const contrib = new Map<string, Map<string, number>>(); // posting day → row key → taxable added
  const taxByDay = new Map<string, { cgst: number; sgst: number }>();
  const row = (room: string, day: Date) => {
    const key = `${room}_${format(day, "yyyy-MM-dd")}`;
    if (!rows.has(key)) rows.set(key, { description: `${room} ${format(day, "dd-MMM")}`, tariff: 0, extBed: 0, disc: 0, cgst: 0, sgst: 0, fnb: 0, others: 0, sort: key });
    return { key, entry: rows.get(key)! };
  };

  for (const line of debitLines) {
    const room = line.booking?.assignedRoom?.roomNumber || line.folio?.room?.roomNumber || defaultRoomNum;
    const posted = format(new Date(line.date), "yyyy-MM-dd");
    const amount = Number(line.amount) || 0;
    if (line.lineType === "TAX_CGST" || line.lineType === "TAX_SGST" || line.lineType === "TAX") {
      const t = taxByDay.get(posted) ?? { cgst: 0, sgst: 0 };
      if (line.lineType === "TAX_CGST") t.cgst += amount;
      else if (line.lineType === "TAX_SGST") t.sgst += amount;
      else { t.cgst += amount / 2; t.sgst += amount / 2; }
      taxByDay.set(posted, t);
      continue;
    }
    const nights: string[] = Array.isArray(line.coversNights) && line.coversNights.length && (line.lineType === "ROOM_CHARGE" || line.lineType === "EXTRA_BED")
      ? line.coversNights
      : [posted];
    const share = nights.map((_, i) => (i < nights.length - 1 ? r2(amount / nights.length) : r2(amount - r2(amount / nights.length) * (nights.length - 1))));
    nights.forEach((n, i) => {
      const { key, entry } = row(room, new Date(`${n}T00:00:00`));
      const part = share[i];
      if (line.lineType === "ROOM_CHARGE") entry.tariff += part;
      else if (line.lineType === "EXTRA_BED") entry.extBed += part;
      else if (line.lineType === "FOOD_AND_BEVERAGE" || line.lineType === "RESTAURANT") entry.fnb += part;
      else if (line.lineType === "DISCOUNT") entry.disc += part;
      else entry.others += part;
      if (line.lineType === "ROOM_CHARGE" || line.lineType === "EXTRA_BED") {
        const m = contrib.get(posted) ?? new Map<string, number>();
        m.set(key, (m.get(key) ?? 0) + part);
        contrib.set(posted, m);
      }
    });
  }

  // GST posted on a day goes to the rows whose room / extra-bed charges were posted that day.
  for (const [day, t] of taxByDay) {
    const m = contrib.get(day);
    const total = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0;
    if (!m || total <= 0) {
      const { entry } = row(defaultRoomNum, new Date(`${day}T00:00:00`));
      entry.cgst += t.cgst; entry.sgst += t.sgst;
      continue;
    }
    const keys = [...m.keys()];
    let cLeft = r2(t.cgst), sLeft = r2(t.sgst);
    keys.forEach((k, i) => {
      const e = rows.get(k)!;
      const last = i === keys.length - 1;
      const c = last ? cLeft : r2((t.cgst * m.get(k)!) / total);
      const s = last ? sLeft : r2((t.sgst * m.get(k)!) / total);
      e.cgst = r2(e.cgst + c); e.sgst = r2(e.sgst + s);
      cLeft = r2(cLeft - c); sLeft = r2(sLeft - s);
    });
  }

  return [...rows.values()]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map(({ sort: _s, ...r }) => ({ ...r, tariff: r2(r.tariff), extBed: r2(r.extBed), disc: r2(r.disc), fnb: r2(r.fnb), others: r2(r.others) }));
}
