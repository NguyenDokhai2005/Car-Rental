// Tạo tài khoản nội bộ (admin hoặc dev). Hai vai trò này không đăng ký được qua web hay API (SPEC §1), nên người vận
// hành tạo bằng script này, chạy trong thư mục api (máy local) hoặc trong container API (máy chủ).
//
//   STAFF_ROLE=dev STAFF_EMAIL=ky-thuat@example.com STAFF_NAME="Nguyễn Văn A" STAFF_PHONE=0901234567 \
//   STAFF_PASSWORD=... node scripts/create-staff.mjs
//
// Mật khẩu đọc từ biến môi trường chứ không từ tham số dòng lệnh, vì tham số dòng lệnh hiện trong danh sách tiến trình
// và lịch sử shell. Email đã tồn tại thì script dừng, không đổi vai trò hay mật khẩu của tài khoản có sẵn.
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

// Cùng tham số với api/src/auth/password.service.ts, để mật khẩu tạo ở đây đăng nhập được qua API.
const ARGON2_OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const ROLES = ["admin", "dev"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

const role = process.env.STAFF_ROLE ?? "";
const email = (process.env.STAFF_EMAIL ?? "").trim().toLowerCase();
const fullName = (process.env.STAFF_NAME ?? "").trim();
const phone = (process.env.STAFF_PHONE ?? "").replace(/[\s.-]/g, "");
const password = process.env.STAFF_PASSWORD ?? "";

if (!ROLES.includes(role)) fail(`STAFF_ROLE phải là một trong: ${ROLES.join(", ")}.`);
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("STAFF_EMAIL không hợp lệ.");
if (fullName.length < 2) fail("Thiếu STAFF_NAME.");
if (!/^(\+84|0)\d{9}$/.test(phone)) fail("STAFF_PHONE không hợp lệ (ví dụ 0901234567).");
if (password.length < 12) fail("STAFF_PASSWORD phải dài ít nhất 12 ký tự.");

const prisma = new PrismaClient();
try {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    fail(`Email ${email} đã có tài khoản. Script không sửa tài khoản có sẵn.`);
  }
  await prisma.user.create({ data: { email, passwordHash: await hash(password, ARGON2_OPTIONS), fullName, phone, role } });
  console.log(`Đã tạo tài khoản ${role}: ${email}`);
} finally {
  await prisma.$disconnect();
}
