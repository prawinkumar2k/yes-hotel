import { HOTEL, hotelAddressOneLine } from "@shared/hotel-info";

export const hotelContact = {
  phone: import.meta.env.VITE_HOTEL_PHONE || HOTEL.phones[0],
  whatsapp: import.meta.env.VITE_HOTEL_WHATSAPP || "",
  email: import.meta.env.VITE_HOTEL_EMAIL || "",
  address: import.meta.env.VITE_HOTEL_ADDRESS || hotelAddressOneLine(),
  bookingUrl: import.meta.env.VITE_BOOKING_URL || "/search",
};

/** Only published, real facts about the hotel (shared/hotel-info.ts). Nothing is guessed. */
export function getHotelInformation() {
  return [
    `${HOTEL.name} is a ${HOTEL.category.toLowerCase()} at ${hotelAddressOneLine()} (${HOTEL.landmark.toLowerCase()}).`,
    `Check-in ${HOTEL.checkInWindow}, check-out ${HOTEL.checkOut}. ${HOTEL.frontDesk}.`,
    `In every room: ${HOTEL.inRoom.join(", ")}.`,
    `At the hotel: ${HOTEL.property.join(", ")}.`,
    `Stays: ${HOTEL.stayOptions.join(", ")}.`,
    `Call us on ${HOTEL.phones[0]} for anything else.`,
  ].join("\n");
}
