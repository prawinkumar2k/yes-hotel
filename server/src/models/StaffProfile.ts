import mongoose, { Document, Schema } from "mongoose";

export enum EmploymentStatus {
  FULL_TIME = "FULL_TIME",
  PART_TIME = "PART_TIME",
  CONTRACT = "CONTRACT",
  TERMINATED = "TERMINATED",
  ON_LEAVE = "ON_LEAVE"
}

export enum Department {
  MANAGEMENT = "MANAGEMENT",
  FRONT_DESK = "FRONT_DESK",
  HOUSEKEEPING = "HOUSEKEEPING",
  MAINTENANCE = "MAINTENANCE",
  F_AND_B = "F_AND_B",
  HR = "HR"
}

export interface IStaffProfile extends Document {
  user: mongoose.Types.ObjectId;
  department: Department;
  employmentStatus: EmploymentStatus;
  joinedDate: Date;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

const StaffProfileSchema = new Schema<IStaffProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    department: { type: String, enum: Object.values(Department), required: true },
    employmentStatus: { type: String, enum: Object.values(EmploymentStatus), default: EmploymentStatus.FULL_TIME },
    joinedDate: { type: Date, default: Date.now },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String }
  },
  { timestamps: true }
);

export const StaffProfile = mongoose.model<IStaffProfile>("StaffProfile", StaffProfileSchema);
