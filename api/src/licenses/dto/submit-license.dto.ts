import { Transform } from "class-transformer";
import { IsIn, IsString, Matches } from "class-validator";
import { trim } from "../../common/transforms";
import { LICENSE_CLASSES, LICENSE_NUMBER_PATTERN, LicenseClass } from "../license-rules";

// Các trường chữ của form multipart. Hai file ảnh (front, back) do interceptor xử lý riêng.
export class SubmitLicenseDto {
  @Transform(({ value }) => (typeof value === "string" ? value.replace(/\s+/g, "") : value))
  @Matches(LICENSE_NUMBER_PATTERN, { message: "Số giấy phép lái xe gồm đúng 12 chữ số." })
  licenseNumber!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsIn(LICENSE_CLASSES, { message: `Hạng giấy phép chỉ nhận: ${LICENSE_CLASSES.join(", ")}.` })
  licenseClass!: LicenseClass;

  // Ngày có thật và chưa qua được kiểm tra trong service, vì phải so với "hôm nay" theo giờ Việt Nam.
  @Transform(trim)
  @IsString({ message: "Ngày hết hạn không hợp lệ." })
  licenseExpiresOn!: string;
}
