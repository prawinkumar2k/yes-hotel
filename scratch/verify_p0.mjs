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
  return data.data?.token;
}

async function get(path, token) {
  const r = await fetch(`${BASE}${path}`, { headers: { "Authorization": `Bearer ${token}` } });
  return await r.json();
}

async function post(path, token, body = {}, headers = {}) {
  const r = await fetch(`${BASE}${path}`, { 
    method: "POST", 
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch (e) { return { status: r.status, text }; }
}

async function run() {
  const adminToken = await login("admin@yeshotels.com", "Admin@123");
  const customerToken = await login("customer@yeshotels.com", "Customer@123");
  const cashierToken = await login("cashier@yeshotels.com", "Cashier@123");

  const categoriesReq = await get("/api/rooms/categories", customerToken);
  const categoryId = categoriesReq.data[0]._id;

  const checkIn = new Date(); checkIn.setDate(checkIn.getDate() + 90); // 90 days out to ensure inventory
  const checkOut = new Date(); checkOut.setDate(checkOut.getDate() + 93);

  log("=========================================");
  log(" P0-05 DOUBLE BOOKING CONCURRENCY");
  log("=========================================");
  log(`Request: POST /api/bookings (Concurrent)`);
  
  const promises = [];
  for(let i=0; i<10; i++) {
    promises.push(post("/api/bookings", customerToken, {
      roomCategoryId: categoryId,
      checkInDate: checkIn.toISOString(),
      checkOutDate: checkOut.toISOString(),
      adults: 2, children: 0,
      guestDetails: { firstName: `C${i}`, lastName: "Doe", email: `c${i}@test.com`, phone: "1234567890" }
    }, { "Idempotency-Key": `idem-booking-${Date.now()}-${i}` }));
  }
  const results = await Promise.all(promises);
  const successfulBookings = results.filter(r => r.success);
  log(`Expected: System should block overbooking (preventing more bookings than inventory).`);
  log(`Actual: ${successfulBookings.length} bookings successful out of 10 requests.`);
  
  if (successfulBookings.length > 0) {
    const bId = successfulBookings[0].data._id;
    log("\n=========================================");
    log(" P0-06 PAYMENT IDEMPOTENCY");
    log("=========================================");
    log(`Request: POST /api/bookings/${bId}/payments (Concurrent)`);
    
    // Attempt 3 simultaneous payment confirmations with same idempotency key
    const idemKey = "idem-" + Date.now();
    const payPromises = [];
    for(let i=0; i<3; i++) {
      payPromises.push(post(`/api/bookings/${bId}/payments`, cashierToken, {
         amount: 100, method: "CASH", reference: "DoublePay"
      }, { "Idempotency-Key": idemKey }));
    }
    const payResults = await Promise.all(payPromises);
    const successfulPayments = payResults.filter(r => r.success);
    
    log(`Expected: Exactly 1 payment should succeed due to idempotency key.`);
    log(`Actual: ${successfulPayments.length} successful payments.`);

    log("\n=========================================");
    log(" P0-08 FOLIO BALANCE CALCULATION & P0-09 GST CALCULATION");
    log("=========================================");
    // Get folio
    const folio = await get(`/api/bookings/${bId}`, customerToken); // or from /api/folios?
    // Wait, folio is within booking or a separate endpoint?
    // Let's get the booking and log its balance
    const booking = await get(`/api/bookings/my/${bId}`, customerToken);
    
    if(booking && booking.data) {
        log(`Expected: Balance should correctly subtract the successful payment.`);
        log(`Total: ${booking.data.totalAmount}, Paid: ${booking.data.amountPaid}, Balance: ${booking.data.balance}`);
    } else {
        log(`Could not fetch booking to verify balance.`);
    }
  }

  log("=========================================");
  log(" P0-07 NIGHT AUDIT DUPLICATE PREVENTION");
  log("=========================================");
  log(`Request: POST /api/night-audit/run (Concurrent)`);
  const naPromises = [];
  const naIdemKey = "na-" + Date.now();
  for(let i=0; i<3; i++) {
     naPromises.push(post("/api/night-audit/run", adminToken, {}, { "Idempotency-Key": naIdemKey }));
  }
  const naResults = await Promise.all(naPromises);
  const successfulNA = naResults.filter(r => r.success);
  log(`Expected: Exactly 1 audit allowed per business date/key.`);
  log(`Actual: ${successfulNA.length} successful audits.`);
  if(naResults[0] && !naResults[0].success) {
      log(`Reason: ${naResults[0].message}`);
  }

}
run().catch(console.error);
