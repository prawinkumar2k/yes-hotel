/**
 * The hotel's real, public facts — one place, used by the website, chatbot and printed documents.
 * Change a detail here and it changes everywhere. Only what the hotel actually offers is listed:
 * there is no spa, pool, gym, minibar, bar or banquet hall.
 */
export const HOTEL = {
  name: "YES HOTELS",
  shortName: "YES Hotels",
  category: "Contemporary 3-star boutique hotel",
  tagline: "Say Yes to Time Well Spent",
  website: "https://www.yeshotels.in",
  /** GSTIN printed on tax invoices (Admin → Settings can override it). */
  gstin: "29AFAFS2437J1ZS",
  instagram: "yeshotel_blr",
  instagramUrl: "https://www.instagram.com/yeshotel_blr/",
  phones: ["+91 87698 28787"],
  phoneHref: "tel:+918769828787",
  whatsappHref: "https://wa.me/918769828787",
  address: {
    line1: "2nd Floor, Building No. 51 / A51, Khata No. 749",
    line2: "Hosur Main Road, Hosa Road Junction, Parappana Agrahara",
    area: "Begur, Electronic City",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560100",
  },
  landmark: "At Hosa Road Junction on Hosur Road, near Hosa Road Metro Station",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=YES+HOTELS+Hosa+Road+Junction+Bengaluru+560100",
  checkIn: "12:00 PM",
  checkInWindow: "12:00 PM to 11:30 PM",
  checkOut: "11:00 AM",
  frontDesk: "24-hour front desk",
  inRoom: [
    "Air-conditioning",
    "Private bathroom with hot and cold shower",
    "Complimentary toiletries",
    "Flat-screen TV",
    "Work desk and chair",
    "Free high-speed Wi-Fi",
    "Tea / coffee tray with kettle",
    "Packaged drinking water",
    "Intercom telephone",
    "Daily housekeeping",
    "City-view windows (select rooms)",
  ],
  property: [
    "24-hour front desk",
    "Lift to all floors",
    "Free on-site parking",
    "Luggage storage",
    "Laundry service",
    "Breakfast (paid or with your plan; vegetarian and halal options)",
    "Accessible layout",
    "Fire safety equipment on every floor",
  ],
  stayOptions: ["Nightly stays", "Hourly / day-use stays", "Weekly and monthly stays"],
  bookingChannels: ["YES Hotels website", "MakeMyTrip", "Booking.com", "Agoda", "Trip.com", "Expedia", "Bag2Bag"],
} as const;

export const hotelAddressOneLine = () =>
  `${HOTEL.address.line1}, ${HOTEL.address.line2}, ${HOTEL.address.area}, ${HOTEL.address.city}, ${HOTEL.address.state} ${HOTEL.address.pincode}`;
