import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import type { Request } from "express";

export type AuthUser = { id: string; role: UserRole };

export type AuthenticatedRequest = Request & { user: AuthUser };

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
