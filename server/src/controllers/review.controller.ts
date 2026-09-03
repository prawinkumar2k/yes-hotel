import { Request, Response } from "express";
import { z } from "zod";
import { Review, ReviewStatus } from "../models/Review";
import { Booking, BookingStatus } from "../models/Booking";
import { createAuditLog } from "../services/audit.service";

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(100),
  comment: z.string().min(10).max(1000),
});

// POST /api/reviews — customer only
export const createReview = async (req: Request, res: Response) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.issues });
    }
    const { bookingId, rating, title, comment } = parsed.data;

    // Verify the booking belongs to this customer and is checked out
    const booking = await Booking.findOne({ _id: bookingId, customer: req.user?.id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found or does not belong to you" });
    if (booking.status !== BookingStatus.CHECKED_OUT) {
      return res.status(400).json({ success: false, message: "You can only review a completed stay (CHECKED_OUT)" });
    }

    // Prevent duplicate reviews
    const existing = await Review.findOne({ booking: bookingId });
    if (existing) return res.status(400).json({ success: false, message: "You have already submitted a review for this stay" });

    const review = await Review.create({
      user: req.user!.id,
      booking: bookingId,
      rating,
      title,
      comment,
      status: ReviewStatus.PENDING,
    });

    return res.status(201).json({ success: true, message: "Review submitted and pending approval", data: review });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reviews/my — customer's own reviews
export const getMyReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.find({ user: req.user?.id })
      .populate("booking", "bookingReference checkInDate checkOutDate")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reviews — public approved reviews
export const getApprovedReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.find({ status: ReviewStatus.APPROVED })
      .populate("user", "firstName lastName")
      .populate("booking", "roomCategory")
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/reviews/:id/status — admin moderation
export const moderateReview = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!Object.values(ReviewStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    await createAuditLog({
      req,
      action: "review.moderated",
      resourceType: "Review",
      resourceId: review._id.toString(),
      metadata: { status },
    });

    return res.status(200).json({ success: true, data: review });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/reviews — all reviews (admin)
export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.find()
      .populate("user", "firstName lastName email")
      .populate("booking", "bookingReference")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
