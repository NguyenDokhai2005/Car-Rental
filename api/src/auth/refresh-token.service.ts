import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type IssuedRefreshToken = { token: string; expiresAt: Date };

function invalidRefreshToken(): ApiError {
  return new ApiError(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
}

// Token gốc chỉ nằm trong cookie của người dùng; DB chỉ giữ băm SHA-256 nên lộ DB cũng không dùng lại được token.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  // Xoay vòng: mỗi refresh token chỉ dùng một lần. Dùng lại token đã thu hồi nghĩa là token có thể bị lộ,
  // nên thu hồi mọi phiên của người dùng đó.
  async rotate(rawToken: string): Promise<IssuedRefreshToken & { userId: string }> {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!record) throw invalidRefreshToken();

    if (record.revokedAt) {
      await this.revokeAll(record.userId);
      throw invalidRefreshToken();
    }
    if (record.expiresAt <= new Date()) throw invalidRefreshToken();

    // Điều kiện revokedAt: null làm bước thu hồi mang tính nguyên tử: hai request cùng lúc chỉ một request thắng.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeAll(record.userId);
      throw invalidRefreshToken();
    }

    return { userId: record.userId, ...(await this.issue(record.userId)) };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
