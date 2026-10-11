import { StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { ApiError } from "../common/api-error";
import { LICENSE_SIDES, LicenseSide } from "./license-rules";

export function parseSide(value: string): LicenseSide {
  if ((LICENSE_SIDES as readonly string[]).includes(value)) return value as LicenseSide;
  throw new ApiError(404, "NOT_FOUND", "Không có ảnh giấy phép lái xe.");
}

// no-store: trình duyệt và proxy không được giữ bản sao của ảnh giấy tờ.
export function sendLicenseImage(res: Response, data: Buffer): StreamableFile {
  res.set({ "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  return new StreamableFile(data);
}
