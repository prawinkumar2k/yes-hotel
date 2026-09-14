import type { AvailableRoom } from "@/services/availabilityService";

export type BookingState = {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  childAges: number[];
  rooms: number;
  roomType: string;
  roomCategoryId?: string;
  guestName: string;
  phone: string;
  email: string;
  pricePerNight?: number;
  roomSubtotal?: number;
  taxes?: number;
  total?: number;
  availabilityStatus: "idle" | "checking" | "available" | "unavailable" | "error";
};

export type ChatMessage = {
  id: string;
  sender: "assistant" | "user";
  text: string;
  kind?: "normal" | "details" | "availability" | "summary" | "error";
  rooms?: AvailableRoom[];
};