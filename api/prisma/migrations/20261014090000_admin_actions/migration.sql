-- Nhật ký thao tác can thiệp của admin và lý do khi admin hủy đơn (SPEC §4).

ALTER TABLE "bookings" ADD COLUMN "cancel_reason" TEXT;

CREATE TABLE "admin_actions" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_user_id" UUID,
    "target_vehicle_id" UUID,
    "target_booking_id" UUID,
    "reason" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_actions_target_user_id_created_at_idx" ON "admin_actions"("target_user_id", "created_at" DESC);
CREATE INDEX "admin_actions_admin_id_created_at_idx" ON "admin_actions"("admin_id", "created_at" DESC);

-- Người thực hiện không xóa được khi còn nhật ký. Các cột target_* cố ý KHÔNG có khóa ngoại: nhật ký phải còn nguyên kể cả
-- khi đối tượng bị xóa về sau, và không được chặn việc xóa đó.
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_actions"
  ADD CONSTRAINT admin_actions_action_known CHECK (
    "action" IN ('user.block', 'user.unblock', 'user.reset_password', 'vehicle.takedown', 'booking.cancel')
  ),
  ADD CONSTRAINT admin_actions_has_target CHECK (
    num_nonnulls("target_user_id", "target_vehicle_id", "target_booking_id") = 1
  );

-- Chỉ thêm dòng: không ai sửa hay xóa được nhật ký, kể cả code của ứng dụng.
CREATE FUNCTION admin_actions_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_actions chi cho phep them dong';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_actions_no_update_delete
  BEFORE UPDATE OR DELETE ON "admin_actions"
  FOR EACH ROW EXECUTE FUNCTION admin_actions_append_only();
