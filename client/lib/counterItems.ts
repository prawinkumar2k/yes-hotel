/**
 * Items the desk sells or posts to a room (water bottle, dental kit, mess …): one list for the Cashier counter
 * sale and the room bill's "Post charge", so both name things the same way and the MIS counts them per item.
 */
/** `defaultAmount` and `variants` prefill the price (per unit) with the hotel's rates; staff can still change it. */
export const COUNTER_ITEMS: { category: string; label: string; defaultAmount?: number; variants?: { label: string; amount: number }[] }[] = [
  { category: "EARLY_CHECK_IN", label: "Early Check-in" },
  { category: "WATER_BOTTLE", label: "Water Bottle", defaultAmount: 20, variants: [{ label: "1 L", amount: 20 }, { label: "½ L", amount: 10 }] },
  { category: "DENTAL_KIT", label: "Dental Kit" },
  { category: "TEA_COFFEE_SHOP", label: "Tea / Coffee Shop (₹30 per head)", defaultAmount: 30 },
  { category: "KOVAI_KONGU_MESS", label: "Kovai Kongu Mess" },
  { category: "OTHER", label: "Others" },
];
export const counterItemLabel = (category: string) => COUNTER_ITEMS.find((i) => i.category === category)?.label ?? category;
