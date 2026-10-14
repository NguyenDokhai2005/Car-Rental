// Nhập các TÀI KHOẢN mẫu (api/demo-data/users.json) vào CSDL: một quản trị viên, các chủ xe, các khách thuê ở nhiều trạng
// thái giấy phép lái xe. Xe và đơn thuê mẫu do import-bulk-demo.mjs sinh từ danh mục ảnh, chạy sau script này.
//
//   node scripts/import-demo.mjs            nhập; chạy lại nhiều lần vẫn an toàn (cái gì đã có thì bỏ qua)
//   node scripts/import-demo.mjs --remove   gỡ tài khoản mẫu chưa phát sinh xe, đơn thuê hay nhật ký
//
// Chạy trong thư mục api (máy local) hoặc trong container API (máy chủ, xem docs/demo-data.md). Script ghi thẳng vào CSDL
// và kho file riêng, không đi qua API, vì trên máy chủ mới chưa có tài khoản nào để đăng nhập.
//
// Biến môi trường: DATABASE_URL (bắt buộc), UPLOAD_DIR (mặc định ./uploads), PRIVATE_UPLOAD_DIR (mặc định
// ./private-uploads), DEMO_DATA_DIR (mặc định ../demo-data), DEMO_PASSWORD (tùy chọn; không đặt thì script tự sinh mật
// khẩu ngẫu nhiên, dùng chung cho các tài khoản tạo trong lần chạy này, và in ra đúng một lần).
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.env.DEMO_DATA_DIR ?? path.join(HERE, "..", "demo-data"));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const PRIVATE_DIR = path.resolve(process.env.PRIVATE_UPLOAD_DIR ?? "./private-uploads");
// Cùng tham số với api/src/auth/password.service.ts, để mật khẩu sinh ở đây đăng nhập được qua API.
const ARGON2_OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

const prisma = new PrismaClient();
const readJson = async (name) => JSON.parse(await readFile(path.join(DATA_DIR, name), "utf8"));
const { admin, owners, renters } = await readJson("users.json");
const demoEmails = [admin, ...owners, ...renters].map((user) => user.email);

async function toWebp(file) {
  return sharp(await readFile(file))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function save(root, key, data) {
  const target = path.join(root, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

let password = null;
async function newPasswordHash() {
  password ??= process.env.DEMO_PASSWORD ?? randomBytes(9).toString("base64url");
  return hash(password, ARGON2_OPTIONS);
}

// Trả id của người dùng; tạo mới nếu chưa có. `created` cho biết lần chạy này có vừa tạo hay không.
async function ensureUser(user, role) {
  const existing = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const row = await prisma.user.create({
    data: { email: user.email, passwordHash: await newPasswordHash(), fullName: user.fullName, phone: user.phone, role },
    select: { id: true },
  });
  return { id: row.id, created: true };
}

// Hồ sơ giấy phép lái xe của khách mẫu. Ảnh là thẻ MẪU dùng chung (không phải giấy tờ của ai), lưu ở kho riêng như ảnh thật.
async function attachLicense(userId, license, adminId) {
  const frontKey = `licenses/${userId}/${randomUUID()}.webp`;
  const backKey = `licenses/${userId}/${randomUUID()}.webp`;
  await save(PRIVATE_DIR, frontKey, await toWebp(path.join(DATA_DIR, "licenses", "front.jpg")));
  await save(PRIVATE_DIR, backKey, await toWebp(path.join(DATA_DIR, "licenses", "back.jpg")));
  const reviewed = license.status === "verified" || license.status === "rejected";
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        licenseStatus: license.status,
        licenseNumber: license.number,
        licenseClass: license.class,
        licenseExpiresOn: new Date(`${license.expiresOn}T00:00:00Z`),
        licenseFrontKey: frontKey,
        licenseBackKey: backKey,
        licenseRejectReason: license.rejectReason ?? null,
        licenseReviewedById: reviewed ? adminId : null,
        licenseReviewedAt: reviewed ? new Date() : null,
      },
    });
  } catch (error) {
    await rm(path.join(PRIVATE_DIR, "licenses", userId), { recursive: true, force: true });
    throw error;
  }
}

async function importAll() {
  const counts = { users: 0 };

  const adminRow = await ensureUser(admin, "admin");
  if (adminRow.created) counts.users += 1;

  for (const owner of owners) {
    const row = await ensureUser(owner, "owner");
    if (row.created) counts.users += 1;
  }

  for (const renter of renters) {
    const row = await ensureUser(renter, "renter");
    if (!row.created) continue;
    counts.users += 1;
    if (renter.license) await attachLicense(row.id, renter.license, adminRow.id);
  }

  console.log(`Xong: tạo ${counts.users} tài khoản. Cái gì đã có thì giữ nguyên.`);
  if (password) {
    console.log(`\nMật khẩu của các tài khoản mẫu vừa tạo: ${password}`);
    console.log("Mật khẩu chỉ hiện một lần này. Hãy lưu lại nếu cần đăng nhập bằng các tài khoản đó.");
  }
}

async function removeAll() {
  const demoVehicles = await prisma.vehicle.findMany({
    where: { owner: { email: { in: demoEmails } } },
    select: { id: true, title: true, _count: { select: { bookings: true } } },
  });
  let removedVehicles = 0;
  for (const vehicle of demoVehicles) {
    // Xe đã có đơn thì giữ lại: xóa xe sẽ phải xóa cả lịch sử thuê của khách.
    if (vehicle._count.bookings > 0) {
      console.log(`Giữ lại xe đã có đơn: ${vehicle.title}`);
      continue;
    }
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    await rm(path.join(UPLOAD_DIR, "vehicles", vehicle.id), { recursive: true, force: true });
    removedVehicles += 1;
  }

  // Quản trị viên xóa sau cùng, vì xe và hồ sơ giấy phép còn lại có thể đang ghi tên người duyệt là họ.
  const users = await prisma.user.findMany({ where: { email: { in: demoEmails } }, select: { id: true, email: true, role: true } });
  users.sort((a, b) => Number(a.role === "admin") - Number(b.role === "admin"));
  let removedUsers = 0;
  for (const user of users) {
    try {
      await prisma.user.delete({ where: { id: user.id } });
      await rm(path.join(PRIVATE_DIR, "licenses", user.id), { recursive: true, force: true });
      removedUsers += 1;
    } catch {
      // CSDL không cho xóa người đã có xe, đơn thuê hoặc nhật ký xem giấy phép (khóa ngoại RESTRICT): giữ lại.
      console.log(`Giữ lại tài khoản còn dữ liệu liên quan: ${user.email}`);
    }
  }
  console.log(`Xong: gỡ ${removedVehicles} xe và ${removedUsers} tài khoản mẫu.`);
}

try {
  await (process.argv.includes("--remove") ? removeAll() : importAll());
} finally {
  await prisma.$disconnect();
}
