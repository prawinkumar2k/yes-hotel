# YES HOTELS — Owner & Admin Guide

For the hotel owner and the Admin login. How to run the system day to day without a developer. No passwords are written in this file — keep them in a password manager.

---

## 1. Logins

| Login | Email | Can do |
|---|---|---|
| Admin | admin@yeshotels.com | Everything: staff, rooms and rates, settings, website content, reports, audit log |
| Manager | manager@yeshotels.com | Operations, approvals, night audit, finance and reports |
| Reception | reception@yeshotels.com | Front Desk, reservations, billing and cashier, verification queue, live chat |
| Housekeeping | housekeeping@yeshotels.com | Rooms to clean, photo proof |

Sign in at **https://yeshotels.in/login**.

These staff emails are **sign-in names only, not mailboxes** — no mail is ever sent to them. The hotel's only mailbox is **bookings@yeshotels.in**.

## 2. Passwords

- **Change your own password:** the key icon next to *Sign out* (bottom of the menu). Enter the current password and the new one twice (8+ characters). Other devices are signed out.
- **Someone forgot their password:** Admin → **Staff** → **Reset password** on that person. It's recorded in the audit log. ("Forgot password" on the sign-in page emails a link to **guests** only.)
- **Add or remove staff:** Admin → Staff. New staff can be Admin, Manager, Reception or Housekeeping.

### Master password (owner only)

Opens any **staff** login, even after that person changed their password. It never opens a guest account or a disabled account, and **every use is recorded** in Admin → Audit Log as `auth.master_password_login` (time, IP, account).

- Keep it only with the owner.
- **Change it:** on a computer with this project, run `node scripts/make-master-password-hash.mjs "new master password"` (12+ characters), then replace the `MASTER_PASSWORD_HASH=` line in `/opt/yeshotels/.env` on the server with the printed line and redeploy. Only the hash is stored anywhere.
- **Switch it off:** delete that line and redeploy.

## 3. Rooms, room types and rates

- **Room types and rates:** Admin → **Master Data → Room Categories**. Edit the name, nightly rate, photos, amenities, or switch a type off.
- **Rooms:** Admin → **Rooms Management**. Change a room's number, floor or type; add or remove rooms.
- **Changing types safely:** first move rooms to their new type (Rooms Management → Edit), then delete the empty type. A type with past bookings is switched off (hidden from the website) instead of deleted, so old bills keep it. A room with booking history is archived, never deleted.
- **GST** is automatic: CGST 2.5% + SGST 2.5% (rooms above ₹7,500 a night are 18% by law).
- **Prices include GST** (Admin → Settings → Contact & Location → "Room prices include GST", on for this hotel): the rate you type is what the guest pays. ₹1,510 a night = room ₹1,438.10 + CGST ₹35.95 + SGST ₹35.95. Each booking keeps the rule it was made with.
- **Prices on the website** ("From ₹…") come from these rates — change a rate here and the website follows.

## 4. Website content

| What | Where |
|---|---|
| Gallery photos and captions | Admin → Gallery |
| FAQs | Admin → FAQs |
| About page, Terms, Privacy, Cancellation & Refund | Admin → Content (keys `about`, `terms`, `privacy`, `cancellation`) |
| Phone, email, address, check-in/out times, **GSTIN** | Admin → Settings — used on the website, chatbot, invoices, receipts and registration cards |
| Hotel facts used across the website (amenities, ratings, address) | `shared/hotel-info.ts` in the code |

The policy texts are also kept in `docs/content/legal-pages.json`. The cancellation terms there match how the system charges cancellations (free 48+ hours before check-in, 50% at 24–48 hours, 100% under 24 hours or no-show).

## 5. Email

Guest sign-in codes and notifications are sent from **bookings@yeshotels.in** (Google Workspace) using an **app password** stored on the server.

- **New website / chatbot enquiry alerts** go to the email in Admin → Settings (bookings@yeshotels.in).
- Guests get their booking details, sign-in codes and password-reset links from the same address.

- **After every booking** (website, enquiry converted to a booking, walk-in) the guest is emailed the booking number, room, dates, guests, amount, paid and balance, check-in/out times, and how to sign in to their guest account (email code, or booking number + mobile — no password is sent). Bookings without a real guest email are skipped.
- Every email sent (or failed, then retried automatically) is recorded in the notification log.

- If the Google account password changes, the app password stops working: create a new one at https://myaccount.google.com/apppasswords (2-Step Verification must be on) and put it in `EMAIL_PASS` in `/opt/yeshotels/.env`, then redeploy.
- Revoke an app password at the same page if it was ever shared.

## 6. Online payments

Not switched on yet. When the hotel has Razorpay keys, add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` to `/opt/yeshotels/.env` and redeploy — the payment step then switches to online payment by itself. Until then guests confirm and pay at Reception (see 7b).

## 7. Live chat

- **The moment a guest opens the website chat**, Reception and Admin get a pop-up ("A guest opened the website chat") on any staff page, and the Live Chat menu shows "N online".
- **Live Chat → Online now** lists everyone with the chat open: which page they are on, which chatbot step they are at (e.g. "Entering email"), and **what they are typing before they send it**. The chat window tells guests the front desk can see it live.
- Guests give their name, phone and **email (required)** before checking rooms or talking to Reception, so every chat has contact details.
- When they tap **Talk to Reception**, the chat is marked *Waiting* with a red count. Reply there; the guest sees it immediately, and sees "Reception is typing…" while you write. Mark chats **Resolved** when done.

## 7a. Enquiries — where guests stopped

Every website or chatbot guest who has given their name, phone and email appears on **Enquiries** (live, no refresh needed), with the **last step they reached** and when they were last active:

| Stage | Means the guest… |
|---|---|
| Chatbot: contact shared | gave their details in the chatbot, then stopped |
| Chatbot: checked rooms | checked availability, didn't pick a room |
| Chatbot: room selected | picked a room, didn't send the enquiry |
| Enquiry sent | sent the enquiry from the chatbot |
| Chatbot → booking page | went to the booking page, didn't finish |
| Website: guest details | filled in their details, didn't continue to payment |
| Website: payment page | reached the last step, didn't confirm |
| Website: booking failed | tried to confirm, it didn't go through (the reason is shown) |
| Booking completed | booked — the enquiry is marked Converted automatically |

Open an enquiry to see the full step-by-step history with times. Call or email the guests who stopped.

## 7b. Website bookings without online payment

Until Razorpay keys are added, the last booking step says **"Confirm booking · Pay ₹… at hotel"**. The booking is saved (status Pending, room held), the guest gets the booking email, and pays at Reception on arrival.

## 7c. Invoices, receipts and registration cards

- The hotel name, address, phone, email and **GSTIN** printed on every invoice, receipt and registration card come from **Admin → Settings** (GSTIN is under Contact & Location). Fill in the GSTIN before issuing tax invoices — until then they print "GSTIN : —" and staff see a red warning on screen.
- The GST invoice shows one row per room per night, each with its tariff, CGST and SGST.
- **Walk-in payment:** in New Walk-In → Billing & Payment choose **Full payment** (the exact total is filled in after Calculate Rates), **Advance / part** (type the amount) or **Pay at checkout**, and the method (cash, card, UPI, bank transfer, cheque, other) with a reference. Full payment marks the booking PAID with nothing due.
- **Extending a stay:** Front Desk → In-House → **Extend Stay**. For a group, tick the rooms to extend (All / None). The registration card and invoice then show "Stay extended: original departure … → now … (+N nights)".
- **Late check-out / early check-in by the hour:** Front Desk → In-House → **Extend** → *Late check-out (hours)*, or **Early C/I** → *Early check-in (hours)*. Enter the hours. The price is the room type's **hourly price × hours** (Admin → Room Types). If the room type has no hourly price, the flat **Early Check-in / Late Check-out Fee** from Admin → Settings is used. You can change the amount before adding it. It goes on the bill with CGST + SGST (inside the amount when room prices include GST). The booking's departure or arrival time is updated, and the registration card and invoice show it. A late check-out is refused if the next guest arrives in that room the same day, unless you tick "add anyway". For more than 23 hours, extend by a night.
- **Early check-out:** check the guest out as usual. The checkout screen warns "Early check-out". The unused nights and their GST are credited to the bill automatically, and those nights become free to sell.
- **Cancelling a stay after check-in** (checked in by mistake, guest left at once): Front Desk → In-House → **Cancel Stay**, or Booking details → **Cancel Booking**. A reason is required. You can enter a cancellation charge, for example for the hours the room was used. Every room charge and its GST is reversed and the room goes to housekeeping (dirty, with a cleaning task). The nights become free to sell. Anything the guest paid (less any cancellation charge) is shown as **due back**: refund it from the bill or Advances. The cancellation also goes to Reception for verification. Guests can't cancel a stay they are already checked in to.
- Bill numbers are issued only at checkout.

## 8. Daily checks

- Admin → **Audit Log**: look for unexpected `master_password_login` or failed logins.
- **Verification Queue** (Reception): cleaned rooms, refunds and voids waiting to be checked.
- **Night audit** (Manager) closes the day and charges in-house nights.

## 9. Getting help

Server and release procedures: [DEPLOYMENT.md](../DEPLOYMENT.md). Staff workflows: [USER_FLOWS.md](../USER_FLOWS.md).
