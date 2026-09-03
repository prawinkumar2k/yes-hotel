import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { createReview, getMyReviews, getApprovedReviews } from "../controllers/review.controller";

const router = Router();

router.get("/", getApprovedReviews); // Public: approved reviews
router.get("/my", protect, getMyReviews); // Customer: own reviews
router.post("/", protect, createReview); // Customer: submit review

export default router;
