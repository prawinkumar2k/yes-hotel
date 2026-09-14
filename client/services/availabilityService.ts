export type AvailabilityRequest = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
};

export type AvailableRoom = {
  _id: string;
  name: string;
  basePrice?: number;
  pricePerNight?: number;
  availableCount: number;
  nights: number;
  totalPrice?: number;
};

export async function checkRoomAvailability(request: AvailabilityRequest): Promise<AvailableRoom[]> {
  const response = await fetch("/api/bookings/availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error("Live availability is unavailable");
  }
  return payload.data as AvailableRoom[];
}