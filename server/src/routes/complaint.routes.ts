import { Router } from "express";
import { getComplaints, createComplaint, updateComplaintStatus } from "../controllers/complaint.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", getComplaints);
router.post("/", createComplaint);
router.patch("/:id/status", updateComplaintStatus);

export default router;
