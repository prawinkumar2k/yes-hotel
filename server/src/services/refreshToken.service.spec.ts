import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  RefreshTokenError,
} from "./refreshToken.service";
import { RefreshToken } from "../models/RefreshToken";

const TEST_DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

describe("refresh token rotation and reuse detection", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("issues a token and successfully rotates it once", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token1 = await issueRefreshToken(userId);

    const { userId: rotatedUserId, newRawToken } = await rotateRefreshToken(token1);
    expect(rotatedUserId).toBe(userId);
    expect(newRawToken).not.toBe(token1);

    await RefreshToken.deleteMany({ user: userId });
  });

  it("rejects reuse of an already-rotated token and revokes the whole family", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token1 = await issueRefreshToken(userId);
    const { newRawToken: token2 } = await rotateRefreshToken(token1);

    // token1 was already rotated away — using it again must fail and kill
    // the family, including the currently-valid token2.
    await expect(rotateRefreshToken(token1)).rejects.toThrow(RefreshTokenError);

    await expect(rotateRefreshToken(token2)).rejects.toThrow(RefreshTokenError);

    await RefreshToken.deleteMany({ user: userId });
  });

  it("rejects an unknown token", async () => {
    await expect(rotateRefreshToken(`nonexistent-${randomUUID()}`)).rejects.toThrow(RefreshTokenError);
  });

  it("revokeRefreshToken makes the token unusable", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token1 = await issueRefreshToken(userId);

    await revokeRefreshToken(token1);
    await expect(rotateRefreshToken(token1)).rejects.toThrow(RefreshTokenError);

    await RefreshToken.deleteMany({ user: userId });
  });

  it("revokeAllRefreshTokensForUser invalidates every active token for that user", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const tokenA = await issueRefreshToken(userId);
    const tokenB = await issueRefreshToken(userId);

    await revokeAllRefreshTokensForUser(userId);

    await expect(rotateRefreshToken(tokenA)).rejects.toThrow(RefreshTokenError);
    await expect(rotateRefreshToken(tokenB)).rejects.toThrow(RefreshTokenError);

    await RefreshToken.deleteMany({ user: userId });
  });
});
