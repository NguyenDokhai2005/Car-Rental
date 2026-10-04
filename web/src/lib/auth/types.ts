export type Role = "renter" | "owner" | "admin";

// Khớp PublicUser của API (api/src/users/user.view.ts). Không bao giờ có mật khẩu.
export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  status: "active" | "blocked";
  licenseStatus: "none" | "pending" | "verified" | "rejected";
  createdAt: string;
};

// Phản hồi của POST /auth/login và /auth/refresh.
export type SessionPayload = {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
};
