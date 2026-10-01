import { Body, Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { ApiError } from "../common/api-error";
import { Public } from "../common/decorators/public.decorator";
import type { PublicUser } from "../users/user.view";
import { AuthService, AuthSession } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { REFRESH_TTL_MS } from "./refresh-token.service";

export const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

type LoginResponse = { accessToken: string; expiresIn: number; user: PublicUser };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register")
  async register(@Body() dto: RegisterDto): Promise<{ user: PublicUser }> {
    return { user: await this.auth.register(dto) };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    return this.respond(res, await this.auth.login(dto));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const rawToken = this.readRefreshCookie(req);
    // Cùng mã lỗi với token sai/hết hạn để client xử lý một cách: đưa người dùng về trang đăng nhập.
    if (!rawToken) {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    return this.respond(res, await this.auth.refresh(rawToken));
  }

  // Công khai vì người dùng có thể đã hết hạn access token; quyền thu hồi dựa vào việc nắm refresh token.
  @Public()
  @HttpCode(204)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = this.readRefreshCookie(req);
    if (rawToken) await this.auth.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private respond(res: Response, session: AuthSession): LoginResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken.token, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TTL_MS,
    });
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get("NODE_ENV") === "production",
      sameSite: "lax",
      path: REFRESH_COOKIE_PATH,
    };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
