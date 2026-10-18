/**
 * Reads orders and payments from Razorpay with the server's own keys — the authority on which
 * booking an order is for (the order's notes are written by our server when it creates the
 * order), how much was ordered, how much was paid and whether the payment succeeded. Nothing a
 * browser / phone sends, and no client-editable checkout notes, decide which booking is paid.
 *
 * Tests replace the gateway (no network, no real money): setRazorpayGatewayForTests(...).
 */
import Razorpay from "razorpay";

export type GatewayOrder = { id: string; amount: number; amount_paid?: number; currency: string; status?: string; notes?: Record<string, any> };
export type GatewayPayment = { id: string; order_id: string; amount: number; currency: string; status: string; notes?: Record<string, any> };
type Gateway = { fetchOrder: (id: string) => Promise<GatewayOrder | null>; fetchPayment: (id: string) => Promise<GatewayPayment | null> };

function client() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const real: Gateway = {
  fetchOrder: async (id) => (await client().orders.fetch(id)) as any,
  fetchPayment: async (id) => (await client().payments.fetch(id)) as any,
};
let gateway: Gateway = real;

export const fetchGatewayOrder = (id: string) => gateway.fetchOrder(id);
export const fetchGatewayPayment = (id: string) => gateway.fetchPayment(id);

export function setRazorpayGatewayForTests(fake: Partial<Gateway> | null) {
  gateway = fake ? { ...real, ...fake } : real;
}

/** Payment states that mean the guest's money was taken (authorised and/or captured). */
export const SUCCESSFUL_PAYMENT = new Set(["authorized", "captured"]);
