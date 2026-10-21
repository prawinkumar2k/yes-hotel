/**
 * What was received in advance for a booking, for printed documents (GRC, bill): the receipts
 * (advance numbers, amounts, modes) and the total. Reads the advance records when they are linked to
 * the booking, else the credit lines on the bill, else the amount stored on the booking.
 */
export type AdvanceReceipt = { number: string; amount: number; mode: string; date?: string };

const ADV_NO = /ADV-\d{6}-\d{4}/i;

export function advanceInfo(input: { advances?: any[]; lines?: any[]; booking?: any }) {
  const advances = (input.advances ?? []).filter((a) => a && a.status !== "VOIDED");
  const credit = (input.lines ?? []).filter(
    (l) => l.direction === "CREDIT" && (l.lineType === "ADVANCE_ADJUSTMENT" || l.lineType === "ADVANCE" || /adv/i.test(String(l.description ?? ""))),
  );
  let receipts: AdvanceReceipt[] = advances.map((a) => ({
    number: String(a.advanceNumber ?? ""),
    amount: Math.max(0, Number(a.amount || 0) - Number(a.totalRefunded || 0)),
    mode: String(a.method ?? ""),
    date: a.receivedAt ?? a.createdAt,
  }));
  if (receipts.length === 0 && credit.length > 0) {
    receipts = credit.map((l) => ({
      number: (String(l.paymentReference ?? "").match(ADV_NO) ?? String(l.description ?? "").match(ADV_NO) ?? [""])[0],
      amount: Number(l.amount || 0),
      mode: String(l.paymentMode ?? ""),
      date: l.date,
    }));
  }
  const fromReceipts = receipts.reduce((t, r) => t + r.amount, 0);
  const total = fromReceipts > 0 ? fromReceipts : Number(input.booking?.advanceAmount ?? 0);
  return { receipts, total, numbers: receipts.map((r) => r.number).filter(Boolean) };
}

/** Which settlement box to tick on the card, from the billing instruction (a payment-channel code) or the advance mode. */
export function settlementKind(instruction?: string, advanceMode?: string, paid?: boolean): "CASH" | "CARD" | "UPI" | "NET" | "" {
  const v = `${instruction ?? ""} ${advanceMode ?? ""}`.toUpperCase();
  if (/CASH/.test(v)) return "CASH";
  if (/CARD|DD|POS/.test(v)) return "CARD";
  if (/UPI|GPAY|PHONEPE|PAYTM/.test(v)) return "UPI";
  if (/NET|BANK|OTA|PREPAID|VCC|RAZORPAY|ONLINE/.test(v) || paid) return "NET";
  return "";
}
