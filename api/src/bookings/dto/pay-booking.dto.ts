import { IsIn, IsOptional } from "class-validator";

export const PAYMENT_SCENARIOS = ["success", "insufficient_funds", "cancelled", "gateway_timeout"] as const;
export type PaymentScenario = (typeof PAYMENT_SCENARIOS)[number];

// Thanh toán giả lập (SPEC §7, mục Thanh toán): khách chọn kết quả muốn thử. Không gửi gì nghĩa là thành công.
export class PayBookingDto {
  @IsOptional()
  @IsIn(PAYMENT_SCENARIOS, { message: `scenario chỉ nhận: ${PAYMENT_SCENARIOS.join(", ")}.` })
  scenario?: PaymentScenario;
}
