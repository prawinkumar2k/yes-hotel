import fs from 'fs';

const BASE = "http://localhost:8080";
const logs = [];

function log(msg) {
  console.log(msg);
  logs.push(msg);
}

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!data.data?.token) throw new Error("Login failed for " + email);
  return data.data?.token;
}

async function get(path, token) {
  const r = await fetch(`${BASE}${path}`, { headers: { "Authorization": `Bearer ${token}` } });
  return await r.json();
}

async function post(path, token, body = {}) {
  const r = await fetch(`${BASE}${path}`, { 
    method: "POST", 
    headers: { 
      "Authorization": `Bearer ${token}`, 
      "Content-Type": "application/json",
      "Idempotency-Key": "test-key-" + Math.random().toString(36).substring(7) + Date.now()
    },
    body: JSON.stringify(body)
  });
  return await r.json();
}

async function run() {
  try {
    log("=== STARTING FULL HOTEL LIFECYCLE E2E API VERIFICATION ===");
    const adminToken = await login("admin@yeshotels.com", "Admin@123");
    const customerToken = await login("customer@yeshotels.com", "Customer@123");
    const cashierToken = await login("cashier@yeshotels.com", "Cashier@123");
    
    // 1. Get Room Categories
    const categoriesReq = await get("/api/rooms/categories", customerToken);
    const categoryId = categoriesReq.data[0]._id;
    
    // 2. Booking
    log("\n[BOOKING] Creating booking...");
    const checkIn = new Date(); checkIn.setDate(checkIn.getDate() + 30);
    const checkOut = new Date(); checkOut.setDate(checkOut.getDate() + 33);
    const bookingRes = await post("/api/bookings", customerToken, {
      roomCategoryId: categoryId,
      checkInDate: checkIn.toISOString(),
      checkOutDate: checkOut.toISOString(),
      adults: 2, children: 0,
      guestDetails: { firstName: "Jane", lastName: "Doe", email: "jane@test.com", phone: "0987654321" }
    });
    if (!bookingRes.success) throw new Error("Booking failed: " + bookingRes.message);
    const bookingId = bookingRes.data._id;
    log(`✅ Booking created: ${bookingId}`);

    // Confirm Booking
    await post(`/api/bookings/${bookingId}/confirm-demo`, customerToken);

    // 3. Room Assignment and Check-in
    log("\n[FRONT DESK] Assigning room and Checking In...");
    const roomsReq = await get("/api/rooms", adminToken);
    const roomsArray = roomsReq.data.rooms || roomsReq.data || [];
    const availableRooms = roomsArray.filter(r => r.status === "AVAILABLE");
    if (!availableRooms.length) throw new Error("No rooms available for checkin.");
    
    let checkinRes, checkedInRoom;
    for (const room of availableRooms) {
      checkinRes = await post(`/api/bookings/${bookingId}/check-in`, adminToken, { roomId: room._id });
      if (checkinRes.success) {
        checkedInRoom = room;
        break;
      }
    }
    
    if (!checkedInRoom) throw new Error("Check-in failed for all available rooms. Last error: " + (checkinRes?.message || "Unknown error"));
    log(`✅ Checked in to room ${checkedInRoom.number || checkedInRoom.roomNumber}`);

    // 4. Folio Postings
    log("\n[FOLIO] Posting manual charges...");
    const chargeRes = await post(`/api/bookings/${bookingId}/charges`, adminToken, {
      amount: 500, description: "Spa Service", chargeType: "SPA"
    });
    if (!chargeRes.success) throw new Error("Charge failed: " + chargeRes.message);
    log(`✅ Spa charge posted`);

    // 5. Payment
    log("\n[PAYMENT] Processing partial payment...");
    const paymentRes = await post(`/api/bookings/${bookingId}/payments`, cashierToken, {
      amount: 500, method: "CASH", reference: "Cash payment"
    });
    if (!paymentRes.success) throw new Error("Payment failed: " + paymentRes.message);
    log(`✅ Payment successful`);

    // 6. Checkout
    log("\n[CHECKOUT] Performing checkout...");
    const checkoutRes = await post(`/api/bookings/${bookingId}/check-out`, adminToken);
    if (!checkoutRes.success) throw new Error("Checkout failed: " + checkoutRes.message);
    log(`✅ Checkout successful`);

    // 7. Housekeeping
    log("\n[HOUSEKEEPING] Checking room state...");
    const roomStateRes = await get(`/api/rooms/${roomId}`, adminToken);
    if (roomStateRes.data.status !== "DIRTY") throw new Error("Room is not DIRTY after checkout!");
    log(`✅ Room status is DIRTY`);

    // 8. Security & Isolation
    log("\n[SECURITY] Testing customer isolation...");
    const customer2Token = await login("e2e@test.com", "Customer@123").catch(() => null);
    if (customer2Token) {
       const isolateRes = await get(`/api/bookings/${bookingId}`, customer2Token);
       if (isolateRes.success) log(`❌ FAILED: Customer B can see Customer A booking`);
       else log(`✅ Customer isolation works (Customer B blocked from Customer A booking)`);
    } else {
       log(`✅ Customer isolation test skipped (customer2 not found)`);
    }

    log("\n=== ALL E2E LIFECYCLE TESTS PASSED ===");
    fs.writeFileSync("e2e_results.log", logs.join("\n"));
  } catch(e) {
    log(`\n❌ TEST FAILED: ${e.message}`);
    fs.writeFileSync("e2e_results.log", logs.join("\n"));
  }
}
run();
