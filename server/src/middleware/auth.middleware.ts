import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt";

interface JwtPayload {
  id: string;
  role: string;
}

function getToken(req: Request) {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return req.headers.authorization.split(" ")[1];
  }
  return undefined;
}

function tryAttachUser(req: Request) {
  const token = getToken(req);
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.user = decoded;
    return true;
  } catch {
    return false;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Session activity: record the last authenticated request per user, at most every 5 minutes
// (fire-and-forget; a failure here never blocks the request).
const lastTouched = new Map<string, number>();
function touchLastActive(userId?: string) {
  if (!userId) return;
  const now = Date.now();
  if (now - (lastTouched.get(userId) ?? 0) < 5 * 60_000) return;
  lastTouched.set(userId, now);
  import("../models/User")
    .then(({ User }) => User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date(now) } }))
    .catch(() => undefined);
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.user = decoded;
    touchLastActive((decoded as any)?.id);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized, token failed" });
  }
};

export const optionalProtect = (req: Request, _res: Response, next: NextFunction) => {
  tryAttachUser(req);
  next();
};
