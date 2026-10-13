/** Indian-system amount in words for printed bills, e.g. 9000 → "NINE THOUSAND RUPEES ONLY". */
export function amountInWords(num: number): string {
  const a = ["", "ONE ", "TWO ", "THREE ", "FOUR ", "FIVE ", "SIX ", "SEVEN ", "EIGHT ", "NINE ", "TEN ", "ELEVEN ", "TWELVE ", "THIRTEEN ", "FOURTEEN ", "FIFTEEN ", "SIXTEEN ", "SEVENTEEN ", "EIGHTEEN ", "NINETEEN "];
  const b = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  if ((num = Math.floor(num)) === 0) return "ZERO RUPEES ONLY";
  const n = ("000000000" + num).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  const two = (s: string) => a[Number(s)] || b[Number(s[0])] + " " + a[Number(s[1])];
  let str = "";
  str += Number(n[1]) !== 0 ? two(n[1]) + "CRORE " : "";
  str += Number(n[2]) !== 0 ? two(n[2]) + "LAKH " : "";
  str += Number(n[3]) !== 0 ? two(n[3]) + "THOUSAND " : "";
  str += Number(n[4]) !== 0 ? two(n[4]) + "HUNDRED " : "";
  str += Number(n[5]) !== 0 ? (str !== "" ? "AND " : "") + two(n[5]) : "";
  return str.replace(/\s+/g, " ").trim() + " RUPEES ONLY";
}
