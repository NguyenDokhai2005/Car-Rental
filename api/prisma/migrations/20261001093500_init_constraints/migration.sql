-- Ràng buộc Prisma không diễn đạt được trong schema.prisma: EXCLUDE, CHECK, index có điều kiện.
-- Không sửa file này sau khi đã commit; muốn đổi thì tạo migration mới.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- users ----------
ALTER TABLE "users"
  ADD CONSTRAINT users_license_front_when_submitted
  CHECK (license_status = 'none' OR license_front_key IS NOT NULL);

-- Hàng đợi xác minh GPLX của admin
CREATE INDEX users_license_pending ON "users" (created_at) WHERE license_status = 'pending';

-- ---------- vehicles ----------
ALTER TABLE "vehicles"
  ADD CONSTRAINT vehicles_seats_range CHECK (seats BETWEEN 2 AND 16),
  ADD CONSTRAINT vehicles_price_positive CHECK (price_per_day > 0),
  ADD CONSTRAINT vehicles_deposit_rate_range CHECK (deposit_rate BETWEEN 0 AND 100),
  ADD CONSTRAINT vehicles_reject_needs_reason CHECK (status <> 'rejected' OR reject_reason IS NOT NULL);

-- Hàng đợi duyệt xe của admin
CREATE INDEX vehicles_pending_queue ON "vehicles" (created_at) WHERE status = 'pending';

-- ---------- vehicle_images ----------
ALTER TABLE "vehicle_images"
  ADD CONSTRAINT vehicle_images_position_range CHECK (position BETWEEN 0 AND 9);

-- ---------- vehicle_blocks ----------
ALTER TABLE "vehicle_blocks"
  ADD CONSTRAINT vehicle_blocks_time_order CHECK (end_at > start_at),
  ADD CONSTRAINT vehicle_blocks_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  );

-- ---------- bookings ----------
ALTER TABLE "bookings"
  ADD CONSTRAINT bookings_time_order CHECK (end_at > start_at),
  ADD CONSTRAINT bookings_rental_days_range CHECK (rental_days BETWEEN 1 AND 30),
  ADD CONSTRAINT bookings_price_positive CHECK (price_per_day > 0),
  ADD CONSTRAINT bookings_total_non_negative CHECK (total_amount >= 0),
  ADD CONSTRAINT bookings_deposit_range CHECK (deposit_amount BETWEEN 0 AND total_amount),
  ADD CONSTRAINT bookings_refund_range CHECK (refund_amount BETWEEN 0 AND deposit_amount),
  ADD CONSTRAINT bookings_reject_needs_reason CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),
  ADD CONSTRAINT bookings_cancel_needs_time CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),
  -- Chống trùng lịch: hai đơn đang giữ lịch của cùng một xe không được chồng khoảng giờ.
  -- Vi phạm trả mã lỗi PostgreSQL 23P01; API bắt lỗi này và trả 409 BOOKING_OVERLAP.
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'in_use'));

-- Job mỗi phút tìm đơn hết hạn giữ chỗ
CREATE INDEX bookings_pending_expiry ON "bookings" (expires_at) WHERE status = 'pending';

-- ---------- payments ----------
ALTER TABLE "payments"
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT payments_paid_needs_time CHECK (status <> 'paid' OR paid_at IS NOT NULL);

-- Mỗi đơn chỉ có một khoản đã thanh toán
CREATE UNIQUE INDEX payments_one_paid_per_booking ON "payments" (booking_id) WHERE status = 'paid';

-- ---------- license_access_logs: chỉ thêm, không sửa, không xóa ----------
CREATE FUNCTION license_access_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'license_access_logs là bảng chỉ thêm dòng';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER license_access_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "license_access_logs"
  FOR EACH ROW EXECUTE FUNCTION license_access_logs_append_only();
