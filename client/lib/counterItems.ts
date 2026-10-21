/**
 * Items the desk sells or posts to a room (water bottle, dental kit, mess …): one list for the Cashier counter
 * sale and the room bill's "Post charge", so both name things the same way and the MIS counts them per item.
 */
export const COUNTER_ITEMS: { category: string; label: string }[] = [
  { category: "EARLY_CHECK_IN", label: "Early Check-in" },
  { category: "WATER_BOTTLE", label: "Water Bottle" },
  { category: "DENTAL_KIT", label: "Dental Kit" },
  { category: "TEA_COFFEE_SHOP", label: "Tea / Coffee Shop" },
  { category: "KOVAI_KONGU_MESS", label: "Kovai Kongu Mess" },
  { category: "OTHER", label: "Others" },
];
export const counterItemLabel = (category: string) => COUNTER_ITEMS.find((i) => i.category === category)?.label ?? category;
