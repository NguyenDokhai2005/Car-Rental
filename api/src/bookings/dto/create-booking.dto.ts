import { IsUUID, Matches } from "class-validator";
import { ISO_DATETIME_MESSAGE, ISO_DATETIME_PATTERN } from "../../vehicles/dto/vehicle-fields";

// Chỉ có ba trường. Giá, số ngày, tiền, trạng thái, người thuê đều do hệ thống tính hoặc lấy từ token: client không gửi được.
export class CreateBookingDto {
  @IsUUID(undefined, { message: "vehicleId không hợp lệ." })
  vehicleId!: string;

  @Matches(ISO_DATETIME_PATTERN, { message: ISO_DATETIME_MESSAGE })
  startAt!: string;

  @Matches(ISO_DATETIME_PATTERN, { message: ISO_DATETIME_MESSAGE })
  endAt!: string;
}
