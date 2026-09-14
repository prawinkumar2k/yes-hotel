export const hotelContact = {
  phone: import.meta.env.VITE_HOTEL_PHONE || "",
  whatsapp: import.meta.env.VITE_HOTEL_WHATSAPP || "",
  email: import.meta.env.VITE_HOTEL_EMAIL || "",
  address: import.meta.env.VITE_HOTEL_ADDRESS || "",
  bookingUrl: import.meta.env.VITE_BOOKING_URL || "/search",
};

export function getHotelInformation() {
  return "I can help you explore YES Hotels. For verified rooms, amenities, dining, policies, location and opening hours, please use the website pages below or contact our team directly. I will not guess at hotel information that has not been published.";
}