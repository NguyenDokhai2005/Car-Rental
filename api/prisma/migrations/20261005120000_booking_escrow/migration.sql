-- Luồng tiền mới của đơn thuê (SPEC §2, §4): khách trả tiền thuê + tiền cọc ngay khi đặt, ứng dụng giữ tiền, giao xe và trả xe
-- cần hai phía xác nhận, chủ xe nhận 50% tiền thuê khi giao xe và 50% khi trả xe, tiền cọc hoàn cho khách khi trả xe.

-- ---------- Cột mới ----------
ALTER TABLE "bookings"
  ADD COLUMN "paid_at" TIMESTAMPTZ(6),
  ADD COLUMN "paid_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "owner_payout_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "owner_handed_over_at" TIMESTAMPTZ(6),
  ADD COLUMN "renter_received_at" TIMESTAMPTZ(6),
  ADD COLUMN "renter_returned_at" TIMESTAMPTZ(6),
  ADD COLUMN "owner_received_back_at" TIMESTAMPTZ(6);

-- ---------- Chuyển dữ liệu đã có sang mô hình mới ----------
-- Trước đây đơn confirmed, in_use, completed là đơn đã trả cọc. Trong mô hình mới các trạng thái đó nghĩa là khách đã trả đủ
-- tiền thuê + tiền cọc, nên ghi nhận như vậy để dữ liệu cũ thỏa các ràng buộc bên dưới. Đơn đã hủy mà từng được hoàn tiền
-- cũng là đơn đã thanh toán.
UPDATE "bookings"
SET "paid_at" = COALESCE("owner_approved_at", "created_at"),
    "paid_amount" = "total_amount" + "deposit_amount"
WHERE "status" IN ('confirmed', 'in_use', 'completed')
   OR ("status" = 'cancelled' AND "refund_amount" > 0);

-- Đơn đang thuê: coi như hai bên đã xác nhận giao xe, chủ xe đã được ghi nhận 50% tiền thuê.
UPDATE "bookings"
SET "owner_handed_over_at" = COALESCE("started_at", "start_at"),
    "renter_received_at" = COALESCE("started_at", "start_at"),
    "owner_payout_amount" = "total_amount" / 2
WHERE "status" = 'in_use';

-- Đơn đã hoàn tất: chủ xe nhận đủ tiền thuê, khách nhận lại tiền cọc.
UPDATE "bookings"
SET "owner_handed_over_at" = COALESCE("started_at", "start_at"),
    "renter_received_at" = COALESCE("started_at", "start_at"),
    "renter_returned_at" = COALESCE("completed_at", "end_at"),
    "owner_received_back_at" = COALESCE("completed_at", "end_at"),
    "owner_payout_amount" = "total_amount",
    "refund_amount" = "deposit_amount"
WHERE "status" = 'completed';

-- ---------- Ràng buộc: CSDL tự bảo vệ sổ tiền, không phụ thuộc vào việc code có viết đúng hay không ----------
-- Ràng buộc cũ giới hạn tiền hoàn trong tiền cọc; giờ khách có thể được hoàn cả tiền thuê lẫn tiền cọc.
ALTER TABLE "bookings" DROP CONSTRAINT bookings_refund_range;

ALTER TABLE "bookings"
  -- Đã thanh toán thì số tiền đúng bằng tiền thuê + tiền cọc; chưa thanh toán thì bằng 0. Không có "trả một phần".
  ADD CONSTRAINT bookings_paid_amount_matches CHECK (
    ("paid_at" IS NULL AND "paid_amount" = 0)
    OR ("paid_at" IS NOT NULL AND "paid_amount" = "total_amount" + "deposit_amount")
  ),
  -- Không bao giờ chi ra (hoàn cho khách + ghi nhận cho chủ xe) nhiều hơn số đã thu.
  ADD CONSTRAINT bookings_money_balance CHECK (
    "refund_amount" >= 0
    AND "owner_payout_amount" >= 0
    AND "refund_amount" + "owner_payout_amount" <= "paid_amount"
  ),
  -- Chủ xe không bao giờ nhận quá tiền thuê (tiền cọc là của khách).
  ADD CONSTRAINT bookings_owner_payout_max CHECK ("owner_payout_amount" <= "total_amount"),
  -- Đơn không thể được xác nhận, đang thuê hay hoàn tất khi khách chưa thanh toán.
  ADD CONSTRAINT bookings_active_needs_payment CHECK (
    "status" NOT IN ('confirmed', 'in_use', 'completed') OR "paid_at" IS NOT NULL
  ),
  -- Đơn chỉ "đang thuê" khi cả hai bên đã xác nhận giao xe.
  ADD CONSTRAINT bookings_in_use_needs_both_sides CHECK (
    "status" <> 'in_use' OR ("owner_handed_over_at" IS NOT NULL AND "renter_received_at" IS NOT NULL)
  );

-- Job mỗi phút tìm đơn đang thuê đã quá giờ trả xe để tự hoàn tất.
CREATE INDEX bookings_in_use_end ON "bookings" (end_at) WHERE status = 'in_use';
