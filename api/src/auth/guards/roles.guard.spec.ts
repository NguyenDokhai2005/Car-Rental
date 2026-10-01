import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";

class OwnerOnly {
  @Roles("owner")
  handler(): void {}
}

class AdminOrOwner {
  @Roles("admin", "owner")
  handler(): void {}
}

class NoRoles {
  handler(): void {}
}

function contextFor(target: new () => { handler(): void }, role: UserRole | undefined): ExecutionContext {
  return {
    getHandler: () => target.prototype.handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: "u1", role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  it("cho qua khi endpoint không yêu cầu vai trò", () => {
    expect(guard.canActivate(contextFor(NoRoles, "renter"))).toBe(true);
  });

  it("cho qua đúng vai trò", () => {
    expect(guard.canActivate(contextFor(OwnerOnly, "owner"))).toBe(true);
    expect(guard.canActivate(contextFor(AdminOrOwner, "admin"))).toBe(true);
  });

  it.each<UserRole>(["renter", "admin"])("chặn %s trên endpoint chỉ dành cho owner bằng 403 FORBIDDEN", (role) => {
    expect(() => guard.canActivate(contextFor(OwnerOnly, role))).toThrow(
      expect.objectContaining({ status: 403, response: expect.objectContaining({ code: "FORBIDDEN" }) }),
    );
  });

  it("chặn khi không có người dùng trong request", () => {
    expect(() => guard.canActivate(contextFor(OwnerOnly, undefined))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
