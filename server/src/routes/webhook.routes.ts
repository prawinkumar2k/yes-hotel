import { Router } from "express";
import { handleRazorpayWebhook } from "../controllers/webhook.controller";

const router = Router();

// No auth middleware — Razorpay calls this server-to-server, authenticated
// by HMAC signature (verified inside the handler), not a user session.
router.post("/razorpay", handleRazorpayWebhook);

export default router;
