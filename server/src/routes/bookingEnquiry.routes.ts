import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitBookingEnquiry } from "../controllers/bookingEnquiry.controller";

const router = Router();
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many enquiries from this IP. Please try again later." },
});

router.post("/", enquiryLimiter, submitBookingEnquiry);

export default router;