import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Mặc định mọi endpoint yêu cầu đăng nhập; chỉ endpoint gắn @Public() mới mở công khai.
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
