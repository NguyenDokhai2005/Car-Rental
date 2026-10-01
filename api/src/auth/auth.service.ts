import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import { PUBLIC_USER_SELECT, PublicUser } from "../users/user.view";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { PasswordService } from "./password.service";
import { IssuedRefreshToken, RefreshTokenService } from "./refresh-token.service";

export const ACCESS_TTL_SECONDS = 15 * 60;

export type AuthSession = {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  refreshToken: IssuedRefreshToken;
};

function accountBlocked(): ApiError {
  return new ApiError(403, "ACCOUNT_BLOCKED", "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          role: dto.role,
        },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "EMAIL_TAKEN", "Email này đã được đăng ký.");
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const found = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...PUBLIC_USER_SELECT, passwordHash: true },
    });

    // Cùng một thông báo cho "sai email" và "sai mật khẩu" để không lộ email nào đã đăng ký.
    const passwordOk = await this.passwords.verify(found?.passwordHash ?? null, dto.password);
    if (!found || !passwordOk) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
    }

    // Tách passwordHash ra để không bao giờ rời khỏi service này.
    const { passwordHash, ...user } = found;
    if (user.status === "blocked") throw accountBlocked();

    return this.startSession(user);
  }

  async refresh(rawToken: string): Promise<AuthSession> {
    const rotated = await this.refreshTokens.rotate(rawToken);

    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    if (user.status === "blocked") {
      await this.refreshTokens.revokeAll(user.id);
      throw accountBlocked();
    }

    return {
      accessToken: await this.signAccessToken(user),
      expiresIn: ACCESS_TTL_SECONDS,
      user,
      refreshToken: { token: rotated.token, expiresAt: rotated.expiresAt },
    };
  }

  async logout(rawToken: string): Promise<void> {
    await this.refreshTokens.revoke(rawToken);
  }

  private async startSession(user: PublicUser): Promise<AuthSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.refreshTokens.issue(user.id),
    ]);
    return { accessToken, expiresIn: ACCESS_TTL_SECONDS, user, refreshToken };
  }

  private signAccessToken(user: Pick<PublicUser, "id" | "role">): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, role: user.role });
  }
}
