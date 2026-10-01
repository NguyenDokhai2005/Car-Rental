import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";

// Giới hạn endpoint cho một hoặc nhiều vai trò. Đây mới là lớp kiểm tra vai trò;
// quyền sở hữu tài nguyên (xe/đơn của chính mình) vẫn phải kiểm tra riêng trong service.
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
