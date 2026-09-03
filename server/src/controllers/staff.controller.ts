import { Request, Response } from "express";
import { User, UserRole } from "../models/User";
import { StaffProfile, Department, EmploymentStatus } from "../models/StaffProfile";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAuditLog } from "../services/audit.service";

const createStaffSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE]),
  department: z.nativeEnum(Department),
  employmentStatus: z.nativeEnum(EmploymentStatus),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

const updateStaffSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE]).optional(),
  department: z.nativeEnum(Department).optional(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const getStaffList = async (req: Request, res: Response) => {
  try {
    const { role, department, status, search, page = "1", limit = "15" } = req.query;
    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    
    // First find matching users
    const userQuery: any = { role: { $ne: UserRole.CUSTOMER } };
    if (role) userQuery.role = role;
    if (status !== undefined) userQuery.isActive = status === "true";
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      userQuery.$or = [
        { firstName: { $regex: escaped, $options: "i" } },
        { lastName: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }
    
    const users = await User.find(userQuery)
      .select("-passwordHash")
      .lean();
    
    const userIds = users.map(u => u._id);
    
    // Then find their profiles
    const profileQuery: any = { user: { $in: userIds } };
    if (department) profileQuery.department = department;
    
    const profiles = await StaffProfile.find(profileQuery).lean();
    
    // Merge
    let merged = users.map(u => {
      const p = profiles.find(pr => pr.user.toString() === u._id.toString());
      return { ...u, profile: p || null };
    });
    
    if (department) {
      merged = merged.filter(m => m.profile && m.profile.department === department);
    }
    
    const total = merged.length;
    const paginated = merged.slice((p - 1) * l, p * l);
    
    return res.status(200).json({
      success: true,
      data: {
        staff: paginated,
        total,
        totalPages: Math.ceil(total / l),
        page: p
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const data = createStaffSchema.parse(req.body);
    const reqUser = (req as any).user;
    
    // Only admin can create admin
    if (data.role === UserRole.ADMIN && reqUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ success: false, message: "Only an ADMIN can create another ADMIN" });
    }
    
    const exists = await User.findOne({ email: data.email });
    if (exists) return res.status(400).json({ success: false, message: "User with this email already exists" });
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const user = new User({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: data.role,
      isEmailVerified: true,
      isActive: true
    });
    await user.save();
    
    const profile = new StaffProfile({
      user: user._id,
      department: data.department,
      employmentStatus: data.employmentStatus,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone
    });
    await profile.save();
    
    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    await createAuditLog({
      req,
      action: "staff.created",
      resourceType: "User",
      resourceId: user._id.toString(),
      metadata: { email: user.email, role: user.role, department: data.department },
    });

    return res.status(201).json({ success: true, data: { ...userObj, profile } });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const data = updateStaffSchema.parse(req.body);
    const reqUser = (req as any).user;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Staff not found" });
    
    // Prevent privilege escalation
    if (data.role === UserRole.ADMIN && reqUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ success: false, message: "Only an ADMIN can grant ADMIN role" });
    }
    if (user.role === UserRole.ADMIN && reqUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ success: false, message: "Only an ADMIN can edit another ADMIN" });
    }
    
    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.role) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    await user.save();
    
    let profile = await StaffProfile.findOne({ user: user._id });
    if (!profile) {
      profile = new StaffProfile({ user: user._id, department: data.department || Department.FRONT_DESK });
    }
    if (data.department) profile.department = data.department;
    if (data.employmentStatus) profile.employmentStatus = data.employmentStatus;
    if (data.emergencyContactName !== undefined) profile.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) profile.emergencyContactPhone = data.emergencyContactPhone;
    await profile.save();
    
    const userObj = user.toObject();
    delete (userObj as any).passwordHash;

    await createAuditLog({
      req,
      action: data.role ? "staff.role_changed" : "staff.updated",
      resourceType: "User",
      resourceId: user._id.toString(),
      metadata: { role: user.role, isActive: user.isActive, department: profile.department },
    });

    return res.status(200).json({ success: true, data: { ...userObj, profile } });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: (error as any).issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetStaffPassword = async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    const reqUser = (req as any).user;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Staff not found" });
    
    if (user.role === UserRole.ADMIN && reqUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ success: false, message: "Only an ADMIN can reset an ADMIN's password" });
    }
    
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await createAuditLog({
      req,
      action: "staff.password_reset",
      resourceType: "User",
      resourceId: user._id.toString(),
      metadata: { targetEmail: user.email },
    });

    return res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
