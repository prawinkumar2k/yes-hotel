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

## 2. Passwords

- **Change your own password:** the key icon next to *Sign out* (bottom of the menu). Enter the current password and the new one twice (8+ characters). Other devices are signed out.
- **Someone forgot their password:** Admin → **Staff** → **Reset password** on that person. It's recorded in the audit log.
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

## 4. Website content

| What | Where |
|---|---|
| Gallery photos and captions | Admin → Gallery |
| FAQs | Admin → FAQs |
| About page, Terms, Privacy, Cancellation & Refund | Admin → Content (keys `about`, `terms`, `privacy`, `cancellation`) |
| Phone, email, address, check-in/out times | Admin → Settings |
| Hotel facts used across the website (amenities, ratings, address) | `shared/hotel-info.ts` in the code |

The policy texts are also kept in `docs/content/legal-pages.json`. The cancellation terms there match how the system charges cancellations (free 48+ hours before check-in, 50% at 24–48 hours, 100% under 24 hours or no-show).

## 5. Email

Guest sign-in codes and notifications are sent from **bookings@yeshotels.in** (Google Workspace) using an **app password** stored on the server.

- If the Google account password changes, the app password stops working: create a new one at https://myaccount.google.com/apppasswords (2-Step Verification must be on) and put it in `EMAIL_PASS` in `/opt/yeshotels/.env`, then redeploy.
- Revoke an app password at the same page if it was ever shared.

## 6. Online payments

Not switched on yet. When the hotel has Razorpay keys, add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` to `/opt/yeshotels/.env` and redeploy. Until then guests are asked to pay at Reception.

## 7. Live chat

Guests chat on the website. When they tap **Talk to Reception**, the chat appears instantly in **Live Chat** (Reception and Admin) with a red count. Reply there; the guest sees it immediately. Mark chats **Resolved** when done.

## 8. Daily checks

- Admin → **Audit Log**: look for unexpected `master_password_login` or failed logins.
- **Verification Queue** (Reception): cleaned rooms, refunds and voids waiting to be checked.
- **Night audit** (Manager) closes the day and charges in-house nights.

## 9. Getting help

Server and release procedures: [DEPLOYMENT.md](../DEPLOYMENT.md). Staff workflows: [USER_FLOWS.md](../USER_FLOWS.md).
