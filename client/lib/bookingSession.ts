// Shared sessionStorage contract between the chatbot concierge and the
// website's own booking flow (GuestDetailsPage -> PaymentPage), so guest
// contact details collected once are never re-asked for.
const STORAGE_KEY = "bookingDetails";

export interface StoredGuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface StoredBookingDetails {
  category: string;
  checkIn: string;
  checkOut: string;
  adults: string | number;
  children: string | number;
  guestDetails: StoredGuestDetails;
  specialRequests?: string;
  idempotencyKey?: string;
}

export function saveBookingDetails(details: StoredBookingDetails) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(details));
}

export function getStoredBookingDetails(): StoredBookingDetails | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasCompleteGuestContact(details: StoredGuestDetails | null | undefined): boolean {
  return Boolean(details && details.firstName && details.lastName && details.email && details.phone);
}

// Chat collects one free-text full name; the website form wants first/last
// separately. Single-word names fall back to an empty last name, which
// deliberately makes hasCompleteGuestContact() false so the guest-details
// form still renders (and just needs the missing field filled in) instead
// of silently booking under half a name.
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() };
}
