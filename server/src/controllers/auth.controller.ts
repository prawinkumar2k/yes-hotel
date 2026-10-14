import { createAuditLog } from "../services/audit.service";
import { AuditActorType } from "../models/AuditLog";
import { Request, Response } from "express";
import { User, UserRole } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { hashPassword, comparePassword, generateToken } from "../utils/auth";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  RefreshTokenError,
} from "../services/refreshToken.service";
import { z } from "zod";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Scoped to only the auth routes that need it — the cookie is never
    // sent on ordinary API requests.
    path: "/api/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const register = async (req: Request, res: Response) => {
  try {
    const parsedData = registerSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsedData.error.issues });
    }

    const { firstName, lastName, email, password, phone } = parsedData.data;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash,
      phone,
      role: UserRole.CUSTOMER, // Default role
    });

    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = await issueRefreshToken(user._id.toString());
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parsedData = loginSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsedData.error.issues });
    }

    const { email, password } = parsedData.data;

    const user = await User.findOne({ email });
    const failed = async (reason: string) => {
      await createAuditLog({ req, action: "auth.login_failed", resourceType: "User", resourceId: user?._id?.toString(), actorType: AuditActorType.GUEST, actorRole: "ANONYMOUS", metadata: { email, reason } });
    };
    if (!user) {
      await failed("unknown_email");
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      await failed("bad_password");
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isActive) {
      await failed("disabled");
      return res.status(401).json({ success: false, message: "Account is disabled" });
    }

    // Targeted update: a login must not re-validate (and possibly fail on) the whole user document.
    const now = new Date();
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: now, lastActiveAt: now } });
    user.lastLogin = now;
    await createAuditLog({ req, action: "auth.login", resourceType: "User", resourceId: user._id.toString(), actorId: user._id.toString(), actorRole: user.role, actorType: AuditActorType.USER });

    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = await issueRefreshToken(user._id.toString());
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/refresh — rotates the refresh token (from its HttpOnly
// cookie) and issues a new access token. A reused/stale refresh token
// revokes its entire family, per refreshToken.service's reuse-detection.
export const refresh = async (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      return res.status(401).json({ success: false, message: "No refresh token provided" });
    }

    const { userId, newRawToken } = await rotateRefreshToken(rawToken);

    const user = await User.findById(userId).select("-passwordHash");
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Account not available" });
    }

    setRefreshCookie(res, newRawToken);
    const token = generateToken(user._id.toString(), user.role);

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error: any) {
    clearRefreshCookie(res);
    if (error instanceof RefreshTokenError) {
      return res.status(401).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/logout
export const logout = async (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await revokeRefreshToken(rawToken);
    }
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user?.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const savedDetailsSchema = z.object({
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  idType: z.string().trim().max(40).optional(),
  idNumber: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN must be 15 characters").optional(),
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().max(20).optional(),
  savedDetails: savedDetailsSchema.optional(),
});

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation error", errors: parsed.error.issues });
    }
    const { firstName, lastName, phone, savedDetails } = parsed.data;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (savedDetails && user.role === UserRole.CUSTOMER) {
      (user as any).savedDetails = { ...((user as any).savedDetails?.toObject?.() ?? (user as any).savedDetails ?? {}), ...savedDetails };
    }
    await user.save();
    
    if (user.role === "CUSTOMER") {
      const { Guest } = await import("../models/Guest");
      await Guest.updateOne(
        { email: user.email }, 
        { $set: { fullName: `${user.firstName} ${user.lastName}`.trim(), phone: user.phone } }
      );
    }
    
    // Never send the password hash (or anything else secret) back.
    const { passwordHash: _omit, ...safe } = user.toObject() as any;
    return res.status(200).json({ success: true, data: safe });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

// POST /api/auth/change-password — signed-in user, current password required.
// Other sessions are signed out (their refresh tokens revoked); this one gets a fresh token.
export const changePassword = async (req: Request, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation error" });
    }
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!(await comparePassword(parsed.data.currentPassword, user.passwordHash))) {
      await createAuditLog({ req, action: "auth.change_password_failed", resourceType: "User", resourceId: user._id.toString(), actorId: user._id.toString(), actorRole: user.role, actorType: AuditActorType.USER });
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    await createAuditLog({ req, action: "auth.change_password", resourceType: "User", resourceId: user._id.toString(), actorId: user._id.toString(), actorRole: user.role, actorType: AuditActorType.USER });
    setRefreshCookie(res, await issueRefreshToken(user._id.toString()));
    return res.status(200).json({ success: true, message: "Password changed", data: { token: generateToken(user._id.toString(), user.role) } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const bookingLoginSchema = z.object({
  bookingReference: z.string().trim().min(3, "Enter your booking number").max(40),
  mobile: z.string().trim().min(10, "Enter the mobile number used for the booking").max(20),
});

// POST /api/auth/booking-login — a guest signs in with their booking number and the mobile on it.
// The stay (and rooms booked with it) is attached to their customer account, created if needed.
export const bookingLogin = async (req: Request, res: Response) => {
  try {
    const parsed = bookingLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Validation error" });
    }
    const { findBookingByProof, customerAccountForBooking, linkStayToCustomer, CustomerRuleError } = await import("../services/customer.service");
    const booking = await findBookingByProof(parsed.data.bookingReference, parsed.data.mobile);
    if (!booking) {
      await createAuditLog({ req, action: "auth.booking_login_failed", resourceType: "Booking", actorType: AuditActorType.GUEST, actorRole: "ANONYMOUS", metadata: { bookingReference: parsed.data.bookingReference } });
      return res.status(401).json({ success: false, message: "Booking number and mobile number don't match our records" });
    }
    let user: any;
    try {
      user = await customerAccountForBooking(booking);
    } catch (e: any) {
      if (e instanceof CustomerRuleError) return res.status(e.status).json({ success: false, message: e.message });
      throw e;
    }
    const linked = await linkStayToCustomer(booking, user._id);
    const now = new Date();
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: now, lastActiveAt: now } });
    await createAuditLog({ req, action: "auth.booking_login", resourceType: "User", resourceId: user._id.toString(), actorId: user._id.toString(), actorRole: user.role, actorType: AuditActorType.USER, metadata: { bookingReference: booking.bookingReference, linkedBookings: linked.length } });

    const token = generateToken(user._id.toString(), user.role);
    setRefreshCookie(res, await issueRefreshToken(user._id.toString()));
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, token, bookingId: String(booking._id) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
