import mongoose, { Document, Schema } from "mongoose";

export enum JobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  // Exhausted all retry attempts — needs a human to look at it. Not deleted,
  // not silently retried forever; visible via getDeadLetterJobs().
  DEAD_LETTER = "DEAD_LETTER",
}

export interface IJob extends Document {
  type: string;
  payload: Record<string, any>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    type: { type: String, required: true },
    // Deliberately no `required: true` here: Mongoose's required validator
    // on a Mixed-typed path is unreliable across a fetch-then-save cycle
    // (confirmed: re-saving a claimed job with payload `{}` after
    // findOneAndUpdate threw "payload is required" even though the field
    // was genuinely present) — always populated by enqueueJob() regardless.
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: Object.values(JobStatus), default: JobStatus.PENDING },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String },
  },
  { timestamps: true }
);

// Supports the worker's claim query: find the oldest-due PENDING job of any type.
JobSchema.index({ status: 1, nextAttemptAt: 1 });
JobSchema.index({ type: 1, status: 1 });

export const Job = mongoose.model<IJob>("Job", JobSchema);
