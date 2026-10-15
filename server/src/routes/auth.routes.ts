import { Router } from "express";
import { register, login, getMe, refresh, logout, updateProfile, changePassword, bookingLogin, requestOtp, verifyOtp } from "../controllers/auth.controller";
import { forgotPassword, resetPassword } from "../controllers/passwordReset.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/booking-login", bookingLogin);
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.patch("/profile", protect, updateProfile);
router.post("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
