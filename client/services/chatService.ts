import { HOTEL } from "@shared/hotel-info";
import { hotelContactFrom } from "@/hooks/usePublicData";

export type HotelContact = ReturnType<typeof hotelContactFrom>;

/** Contact lines for the chatbot, from Admin → Settings (passed in by the chat window). */
export function contactDetails(c: HotelContact) {
  return [
    `Phone: ${c.phone}`,
    `WhatsApp: ${c.whatsappHref}`,
    c.email && `Email: ${c.email}`,
    `Address: ${c.address}`,
  ].filter(Boolean).join("\n");
}

/** Only published, real facts about the hotel: contact and times from settings, the rest from shared/hotel-info.ts. */
export function getHotelInformation(c: HotelContact) {
  return [
    `${c.name} is a ${HOTEL.category.toLowerCase()} at ${c.address} (${HOTEL.landmark.toLowerCase()}).`,
    `Check-in from ${c.checkIn}, check-out ${c.checkOut}. ${HOTEL.frontDesk}.`,
    `In every room: ${HOTEL.inRoom.join(", ")}.`,
    `At the hotel: ${HOTEL.property.join(", ")}.`,
    `Stays: ${HOTEL.stayOptions.join(", ")}.`,
    `Call us on ${c.phone} for anything else.`,
  ].join("\n");
}
