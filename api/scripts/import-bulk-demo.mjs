// Nạp bộ dữ liệu mẫu CỠ LỚN để trình diễn và thử tải: hàng nghìn tài khoản, xe và đơn thuê.
// Chạy sau import-demo.mjs (cần quản trị viên mẫu).
//
//   node scripts/import-bulk-demo.mjs               nạp tới đủ số lượng đích
//   node scripts/import-bulk-demo.mjs --remove-all  xóa TOÀN BỘ dữ liệu mẫu: đơn, xe, ảnh, tài khoản
//
// Số lượng đích (biến môi trường): BULK_USERS (5000), BULK_VEHICLES (1000), BULK_BOOKINGS (20000).
// BULK_PHOTO_REUSE (3): mỗi bộ ảnh trong demo-data/catalog.json được dùng cho tối đa bấy nhiêu xe.
// DEMO_PASSWORD (bắt buộc khi nạp): mật khẩu dùng chung, đặt cho MỌI tài khoản mẫu (@autorent.test), kể cả tài khoản đã có.
//
// Chạy lại: tài khoản được nạp phần còn thiếu; xe và đơn chỉ nạp một lần (muốn đổi thì --remove-all rồi nạp lại).
import { randomUUID } from "node:crypto";
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
const ARGON2_OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const TARGET = {
  users: Number(process.env.BULK_USERS ?? 5000),
  vehicles: Number(process.env.BULK_VEHICLES ?? 1000),
  bookings: Number(process.env.BULK_BOOKINGS ?? 20000),
};
const DEMO_DOMAIN = "@autorent.test";
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const BATCH = 1000;

const prisma = new PrismaClient();

// Bộ sinh số giả ngẫu nhiên có hạt giống cố định: chạy lại cho cùng một bộ dữ liệu.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261013);
const pick = (list) => list[Math.floor(rand() * list.length)];
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

const FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const MIDDLE = ["Văn", "Thị", "Minh", "Thanh", "Quốc", "Ngọc", "Hữu", "Đức", "Thu", "Gia", "Bảo", "Hoài", "Anh", "Kim", "Xuân", "Tuấn"];
const GIVEN = ["An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Hải", "Hiếu", "Hùng", "Khánh", "Lan", "Linh", "Long", "Mai", "Nam", "Nga", "Nhi", "Phúc", "Quân", "Sơn", "Tâm", "Thảo", "Trang", "Tú", "Vy", "Yến"];
const fullName = () => `${pick(FAMILY)} ${pick(MIDDLE)} ${pick(GIVEN)}`;

// Tên thành phố, mã biển số, các quận/phường, hệ số giá thuê (thành phố lớn và điểm du lịch cao hơn một chút).
const PLACES = [
  ["TP. Hồ Chí Minh", "51", ["Quận 1", "Quận 3", "Quận 7", "Bình Thạnh", "Thủ Đức", "Tân Bình", "Gò Vấp", "Phú Nhuận"], 1.05],
  ["Hà Nội", "30", ["Cầu Giấy", "Hai Bà Trưng", "Long Biên", "Tây Hồ", "Thanh Xuân", "Hoàn Kiếm", "Nam Từ Liêm", "Hà Đông"], 1.05],
  ["Đà Nẵng", "43", ["Hải Châu", "Sơn Trà", "Liên Chiểu", "Ngũ Hành Sơn", "Thanh Khê"], 1.03],
  ["Cần Thơ", "65", ["Ninh Kiều", "Cái Răng", "Bình Thủy"], 0.96],
  ["Nha Trang", "79", ["Lộc Thọ", "Vĩnh Hải", "Phước Hải"], 1.03],
  ["Hải Phòng", "15", ["Ngô Quyền", "Lê Chân", "Hồng Bàng"], 0.96],
  ["Huế", "75", ["Phú Hội", "Vỹ Dạ", "An Cựu"], 0.96],
  ["Vũng Tàu", "72", ["Thắng Tam", "Phường 2", "Rạch Dừa"], 1.0],
  ["Đà Lạt", "49", ["Phường 1", "Phường 3", "Phường 8"], 1.03],
  ["Quy Nhơn", "77", ["Lê Lợi", "Ngô Mây", "Ghềnh Ráng"], 0.96],
  ["Biên Hòa", "60", ["Tân Phong", "Trảng Dài", "Long Bình"], 0.96],
  ["Hạ Long", "14", ["Bãi Cháy", "Hồng Gai", "Hùng Thắng"], 1.0],
];
const LICENSE_CLASSES = ["B1", "B2", "B2", "B2", "B", "C"];
const REJECT_LICENSE = ["Ảnh mặt trước bị mờ, không đọc được số giấy phép.", "Ảnh bị cắt mất góc. Vui lòng chụp đủ bốn góc thẻ.", "Ngày hết hạn trên ảnh không khớp thông tin đã nhập."];
const REJECT_VEHICLE = ["Ảnh xe không rõ biển số.", "Mô tả chưa nêu giới hạn quãng đường.", "Giá thuê cao bất thường so với xe cùng loại."];
const REJECT_BOOKING = ["Xe vừa có lịch bảo dưỡng đột xuất trong khoảng ngày này.", "Chủ xe bận việc gia đình, không giao xe được.", "Xe đang được sửa điều hòa."];

// Ký hiệu sê-ri biển số xe con.
const PLATE_SERIES = ["A", "E", "F", "G", "H", "K", "L", "M"];
const PHOTO_REUSE = Number(process.env.BULK_PHOTO_REUSE ?? 3);

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const pickSome = (list, count) => shuffle(list).slice(0, count);
// Lệch về các thành phố lớn ở đầu danh sách.
const skewedPlace = () => PLACES[Math.floor(rand() * rand() * PLACES.length)];

const OPENERS = {
  sedan: [
    "Xe gia đình đi lại hằng ngày, nội thất sạch và không ám mùi.",
    "Sedan chạy êm, cách âm tốt, hợp đi công tác và đưa đón khách.",
    "Xe chính chủ dùng kỹ, chỉ cho thuê những ngày gia đình không đi.",
    "Xe gầm vừa phải, dễ lái trong phố và đủ đầm khi chạy cao tốc.",
    "Xe sạch, rửa và hút bụi trước mỗi lần giao.",
  ],
  hatchback: [
    "Xe nhỏ gọn, dễ luồn lách và đỗ trong phố đông.",
    "Xe đô thị tiết kiệm xăng, hợp cho người mới lái.",
    "Xe cỡ nhỏ nhưng khoang trước rộng, đi hai đến bốn người thoải mái.",
    "Xe gọn, quay đầu dễ, phù hợp đi lại trong nội thành.",
  ],
  suv: [
    "Xe gầm cao, tầm nhìn thoáng, đi tỉnh và đường xấu đều yên tâm.",
    "SUV rộng rãi, cốp chứa đủ hành lý cho cả nhà đi chơi xa.",
    "Xe gầm cao chạy đầm, lên dốc và đèo khỏe.",
    "Xe ngồi cao thoáng, hợp cho chuyến đi dài ngày cùng gia đình.",
    "Xe dùng kỹ, ngoại thất không trầy xước, nội thất còn mới.",
  ],
  mpv: [
    "Xe bảy chỗ rộng, hợp cho gia đình đông người hoặc nhóm bạn đi du lịch.",
    "Xe đa dụng, hàng ghế cuối người lớn ngồi được trên quãng ngắn.",
    "Xe bảy chỗ tiết kiệm, khoang hành lý rộng khi gập hàng ghế cuối.",
    "Xe rộng, cửa mở lớn, lên xuống dễ cho người lớn tuổi và trẻ nhỏ.",
  ],
  pickup: [
    "Bán tải khỏe, chở đồ cồng kềnh và đi công trình tốt.",
    "Xe bán tải gầm cao, hợp đi dã ngoại, cắm trại và đường đèo.",
    "Bán tải cabin kép năm chỗ, thùng sau rộng để hành lý và dụng cụ.",
  ],
};
const ELECTRIC_OPENERS = [
  "Xe điện chạy êm, không mùi xăng, tăng tốc mượt trong phố.",
  "Xe điện tiết kiệm chi phí đi lại, sạc được ở các trạm trong thành phố.",
  "Xe điện đời mới, vận hành yên tĩnh, hợp đi lại hằng ngày và đi tỉnh gần.",
];
const FEATURES = ["camera lùi", "cảm biến lùi", "màn hình có bản đồ dẫn đường", "Apple CarPlay và Android Auto", "camera hành trình trước sau", "thẻ thu phí không dừng", "ghế da", "điều hòa tự động", "khởi động bằng nút bấm", "ga tự động", "cổng sạc USB cho hàng ghế sau", "cảm biến áp suất lốp"];
const PREMIUM_FEATURES = ["cửa sổ trời", "cốp điện", "ghế lái chỉnh điện", "cảnh báo điểm mù", "camera 360 độ", "phanh tay điện tử"];
const SEVEN_SEAT_FEATURES = ["điều hòa riêng cho hàng ghế sau", "hàng ghế ba gập phẳng"];
const RULES = ["Không hút thuốc trong xe.", "Không chở thú cưng.", "Có thể chở thú cưng nếu báo trước.", "Vui lòng trả xe với mức nhiên liệu như lúc nhận.", "Có sẵn ghế trẻ em, cần thì báo trước một ngày.", "Xe có sẵn nước uống và khăn giấy cho khách.", "Không dùng xe để chở hàng nặng mùi."];
const CONSUMPTION = { hatchback: [4.8, 5.8], sedan: [5.5, 7], suv: [6.5, 8.5], mpv: [6.5, 8], pickup: [7.5, 9.5] };
const thousands = (value) => value.toLocaleString("vi-VN");

// Mô tả ghép từ nhiều phần độc lập (mở đầu, trang bị, tình trạng, nhiên liệu, điều kiện thuê, giao nhận, lưu ý), mỗi phần có
// nhiều cách viết và số liệu riêng, nên hai xe cùng mẫu vẫn có mô tả khác nhau. Không nêu màu xe vì ảnh mới là thứ cho thấy màu.
function describe(model, year, pricePerDay, district) {
  const parts = [pick(model.fuel === "electric" ? ELECTRIC_OPENERS : OPENERS[model.body])];

  const pool = [...FEATURES, ...(pricePerDay >= 1_000_000 ? PREMIUM_FEATURES : []), ...(model.seats >= 7 ? SEVEN_SEAT_FEATURES : [])];
  const features = pickSome(pool, 3 + Math.floor(rand() * 2));
  parts.push(`Trang bị ${features.slice(0, -1).join(", ")} và ${features[features.length - 1]}.`);

  const odo = Math.max(3000, Math.round(((2026 - year) * (8000 + rand() * 9000) + rand() * 5000) / 1000) * 1000);
  parts.push(pick([
    `Xe đi được khoảng ${thousands(odo)} km, bảo dưỡng định kỳ tại hãng.`,
    `Đồng hồ đang ở mức ${thousands(odo)} km, vừa bảo dưỡng và thay nhớt.`,
    `Xe đời ${year}, đã đi ${thousands(odo)} km, lốp và phanh kiểm tra trước mỗi chuyến.`,
  ]));

  if (model.fuel === "electric") {
    parts.push(`Pin đầy đi được khoảng ${Math.round((280 + rand() * 170) / 10) * 10} km, giao xe với pin trên ${pick([80, 85, 90])}%.`);
  } else {
    const [low, high] = CONSUMPTION[model.body];
    const litres = (low + rand() * (high - low)).toFixed(1).replace(".", ",");
    parts.push(`${model.fuel === "diesel" ? "Máy dầu, mức" : "Mức"} tiêu hao khoảng ${litres} lít/100 km đường hỗn hợp.`);
  }

  parts.push(`Giới hạn ${pick([300, 350, 400, 450])} km mỗi ngày, vượt tính ${thousands(pick([3000, 4000, 5000]))} đồng/km.`);
  parts.push(pick([
    `Giao nhận xe tận nơi trong khu vực ${district}, miễn phí trong bán kính ${pick([3, 5, 7])} km.`,
    `Nhận xe tại nhà chủ xe ở ${district}, có chỗ gửi xe máy.`,
    `Giao xe tận nơi theo yêu cầu, phí giao tính theo quãng đường từ ${district}.`,
  ]));
  parts.push(pick(RULES));
  return parts.join(" ");
}

async function toWebp(file) {
  return sharp(await readFile(file)).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}
async function save(root, key, data) {
  const target = path.join(root, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

async function importAll() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("Thiếu DEMO_PASSWORD: mật khẩu dùng chung cho mọi tài khoản mẫu.");

  const admin = await prisma.user.findFirst({ where: { role: "admin", email: { endsWith: DEMO_DOMAIN } }, select: { id: true } });
  if (!admin) throw new Error("Chưa có quản trị viên mẫu. Chạy scripts/import-demo.mjs trước.");

  // Một mật khẩu, băm một lần, dùng cho mọi tài khoản mẫu (băm argon2 tốn CPU, không băm lại hàng nghìn lần).
  const passwordHash = await hash(password, ARGON2_OPTIONS);

  // ---- Người dùng ----
  const count = (role) => prisma.user.count({ where: { role, email: { endsWith: DEMO_DOMAIN } } });
  const ownerTarget = Math.max(6, Math.round(TARGET.users / 10));
  const renterTarget = TARGET.users - 1 - ownerTarget;
  const [haveOwners, haveRenters] = [await count("owner"), await count("renter")];

  const newOwners = [];
  for (let n = haveOwners + 1; n <= ownerTarget; n += 1) {
    newOwners.push({ id: randomUUID(), email: `demo.chuxe${n}${DEMO_DOMAIN}`, passwordHash, fullName: fullName(), phone: `0901${String(n).padStart(6, "0")}`, role: "owner" });
  }
  // skipDuplicates: tài khoản mẫu còn sót từ lần trước (giữ lại vì có trong nhật ký xem GPLX) có thể trùng email với số thứ tự mới.
  for (const part of chunks(newOwners, BATCH)) await prisma.user.createMany({ data: part, skipDuplicates: true });

  const front = await toWebp(path.join(DATA_DIR, "licenses", "front.jpg"));
  const back = await toWebp(path.join(DATA_DIR, "licenses", "back.jpg"));
  const newRenters = [];
  for (let n = haveRenters + 1; n <= renterTarget; n += 1) {
    const id = randomUUID();
    const roll = rand();
    const status = roll < 0.8 ? "verified" : roll < 0.88 ? "pending" : roll < 0.92 ? "rejected" : "none";
    const user = { id, email: `demo.khach${n}${DEMO_DOMAIN}`, passwordHash, fullName: fullName(), phone: `0912${String(n).padStart(6, "0")}`, role: "renter", licenseStatus: status };
    if (status !== "none") {
      const reviewed = status !== "pending";
      Object.assign(user, {
        licenseNumber: `79${String(2_000_000_000 + n).padStart(10, "0")}`,
        licenseClass: pick(LICENSE_CLASSES),
        licenseExpiresOn: new Date(Date.UTC(2028 + Math.floor(rand() * 8), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27))),
        licenseFrontKey: `licenses/${id}/${randomUUID()}.webp`,
        licenseBackKey: `licenses/${id}/${randomUUID()}.webp`,
        licenseRejectReason: status === "rejected" ? pick(REJECT_LICENSE) : null,
        licenseReviewedById: reviewed ? admin.id : null,
        licenseReviewedAt: reviewed ? new Date(Date.now() - Math.floor(rand() * 60) * DAY) : null,
      });
      await save(PRIVATE_DIR, user.licenseFrontKey, front);
      await save(PRIVATE_DIR, user.licenseBackKey, back);
    }
    newRenters.push(user);
  }
  for (const part of chunks(newRenters, BATCH)) await prisma.user.createMany({ data: part, skipDuplicates: true });

  // Tài khoản dev (demo.dev@...) có mật khẩu riêng, không đổi theo mật khẩu chung: trang /dev xem được dữ liệu của mọi bảng.
  const repassworded = await prisma.user.updateMany({ where: { email: { endsWith: DEMO_DOMAIN }, role: { not: "dev" } }, data: { passwordHash } });
  console.log(`Tài khoản: thêm ${newOwners.length} chủ xe, ${newRenters.length} khách thuê. Đặt mật khẩu chung cho ${repassworded.count} tài khoản mẫu.`);

  // ---- Xe ----
  // Xe sinh từ danh mục (demo-data/catalog.json): mỗi mẫu xe có các phiên bản và các BỘ ẢNH, mỗi bộ chụp một chiếc xe thật.
  // Một xe dùng trọn một bộ ảnh. Một bộ ảnh dùng cho tối đa PHOTO_REUSE xe và không bao giờ hai lần trong cùng thành phố,
  // nên người duyệt danh sách xe ở một thành phố không gặp lại cùng một ảnh.
  const haveVehicles = await prisma.vehicle.count({ where: { owner: { email: { endsWith: DEMO_DOMAIN } } } });
  let addedVehicles = 0;
  let addedImages = 0;
  if (haveVehicles > 0) {
    console.log("Đã có xe mẫu từ lần chạy trước nên không nạp thêm (để không dùng lặp bộ ảnh). Dùng --remove-all rồi chạy lại nếu cần đổi số lượng.");
  } else if (TARGET.vehicles > 0) {
    const { models } = JSON.parse(await readFile(path.join(DATA_DIR, "catalog.json"), "utf8"));
    const sets = shuffle(models.flatMap((model) => model.sets.map((set) => ({ model, set, cities: new Set() }))));
    if (TARGET.vehicles > sets.length * PHOTO_REUSE) {
      throw new Error(`Danh mục có ${sets.length} bộ ảnh, mỗi bộ dùng tối đa ${PHOTO_REUSE} lần: chỉ đủ cho ${sets.length * PHOTO_REUSE} xe. Giảm BULK_VEHICLES hoặc tăng BULK_PHOTO_REUSE.`);
    }
    // Lượt 1 dùng mỗi bộ ảnh một lần, hết mới sang lượt 2: số xe ít hơn số bộ ảnh thì không ảnh nào bị dùng lại.
    const plan = shuffle(Array.from({ length: TARGET.vehicles }, (_, i) => ({ entry: sets[i % sets.length], pass: Math.floor(i / sets.length) })));
    const owners = await prisma.user.findMany({ where: { role: "owner", email: { endsWith: DEMO_DOMAIN } }, select: { id: true }, orderBy: { email: "asc" } });
    const descriptions = new Set();
    const plates = new Set();

    for (const part of chunks(plan, BATCH)) {
      const rows = [];
      const imageRows = [];
      for (const { entry, pass } of part) {
        const { model, set } = entry;
        let place = skewedPlace();
        for (let attempt = 0; entry.cities.has(place[0]) && attempt < 50; attempt += 1) place = skewedPlace();
        entry.cities.add(place[0]);
        const [city, code, districts, cityFactor] = place;
        const district = pick(districts);

        const trim = pick(model.trims);
        const year = Math.min(2025, Math.max(2016, set.year - pass));
        const price = model.pricePerDay * trim.priceFactor * (1 + (year - 2020) * 0.02) * cityFactor * (0.93 + rand() * 0.14);
        const pricePerDay = Math.round(price / 10000) * 10000;
        let description = describe(model, year, pricePerDay, district);
        while (descriptions.has(description)) description = describe(model, year, pricePerDay, district);
        descriptions.add(description);
        let plateNumber = `${code}${pick(PLATE_SERIES)}${String(Math.floor(rand() * 90000) + 10000)}`;
        while (plates.has(plateNumber)) plateNumber = `${code}${pick(PLATE_SERIES)}${String(Math.floor(rand() * 90000) + 10000)}`;
        plates.add(plateNumber);

        const id = randomUUID();
        const roll = rand();
        const status = roll < 0.94 ? "approved" : roll < 0.97 ? "pending" : roll < 0.99 ? "hidden" : "rejected";
        const createdAt = new Date(Date.now() - Math.floor(rand() * 300) * DAY - Math.floor(rand() * DAY));
        rows.push({
          id,
          // Phần lớn chủ xe có một hai xe, một số ít có cả đội xe: gần với thực tế hơn là chia đều.
          ownerId: owners[Math.floor(rand() ** 1.6 * owners.length)].id,
          title: [model.brand, model.model, trim.name, year].filter(Boolean).join(" "),
          brand: model.brand,
          model: model.model,
          year,
          plateNumber,
          seats: model.seats,
          transmission: trim.transmission,
          fuel: model.fuel,
          description,
          city,
          district,
          pricePerDay,
          depositRate: pick([20, 25, 30, 30]),
          status,
          rejectReason: status === "rejected" ? pick(REJECT_VEHICLE) : null,
          reviewedById: status === "pending" ? null : admin.id,
          reviewedAt: status === "pending" ? null : new Date(createdAt.getTime() + 6 * HOUR),
          createdAt,
        });
        // Mỗi xe có bản sao file riêng: chủ xe xóa ảnh của xe này không làm hỏng xe khác dùng chung bộ ảnh.
        for (const [position, photo] of set.photos.entries()) {
          const storageKey = `vehicles/${id}/${randomUUID()}.webp`;
          await save(UPLOAD_DIR, storageKey, await toWebp(path.join(DATA_DIR, photo)));
          imageRows.push({ vehicleId: id, storageKey, position });
        }
      }
      await prisma.vehicle.createMany({ data: rows });
      await prisma.vehicleImage.createMany({ data: imageRows });
      addedVehicles += rows.length;
      addedImages += imageRows.length;
    }
    const reused = sets.filter((entry) => entry.cities.size > 1).length;
    console.log(`Xe: thêm ${addedVehicles} xe, ${addedImages} ảnh, từ ${Math.min(sets.length, TARGET.vehicles)} bộ ảnh (${reused} bộ dùng cho hơn một xe, luôn ở thành phố khác nhau).`);
  }

  // ---- Đơn thuê ----
  const haveBookings = await prisma.booking.count({ where: { renter: { email: { endsWith: DEMO_DOMAIN } } } });
  const need = TARGET.bookings - haveBookings;
  let addedBookings = 0;
  if (need > 0 && haveBookings === 0) {
    const renters = (await prisma.user.findMany({ where: { role: "renter", licenseStatus: "verified", email: { endsWith: DEMO_DOMAIN } }, select: { id: true } })).map((u) => u.id);
    const cars = await prisma.vehicle.findMany({ where: { status: "approved", owner: { email: { endsWith: DEMO_DOMAIN } } }, select: { id: true, pricePerDay: true, depositRate: true, createdAt: true } });
    const perCar = Math.ceil(need / cars.length);
    const now = Date.now();
    // 08:00 giờ Việt Nam hôm nay (01:00 UTC), làm mốc cho các khoảng thuê.
    const today = new Date(new Date(now).toISOString().slice(0, 10) + "T01:00:00Z").getTime();
    const rows = [];

    for (const [carIndex, car] of cars.entries()) {
      // Mỗi xe một dãy khe thời gian cách nhau 6 ngày, mỗi đơn dài 1 đến 4 ngày: các đơn của một xe không bao giờ chồng nhau.
      const past = Math.ceil(perCar * 0.65);
      for (let k = 0; k < perCar && rows.length < need; k += 1) {
        const slot = k - past; // âm: quá khứ, 0: quanh hôm nay, dương: tương lai
        const days = 1 + Math.floor(rand() * 4);
        const start = today + slot * 6 * DAY + (carIndex % 3) * DAY + (slot === 0 ? -DAY : 0);
        // Xe mới đăng gần đây thì không thể có đơn từ trước đó.
        if (start < car.createdAt.getTime() + 2 * DAY) continue;
        const end = start + days * DAY;
        const total = car.pricePerDay * days;
        const deposit = Math.round((total * car.depositRate) / 100);
        const paid = total + deposit;
        const createdAt = new Date(Math.max(car.createdAt.getTime() + HOUR, Math.min(now - HOUR, start - (2 + Math.floor(rand() * 10)) * DAY)));
        const renterId = pick(renters);
        const base = {
          id: randomUUID(), renterId, vehicleId: car.id, startAt: new Date(start), endAt: new Date(end), rentalDays: days,
          pricePerDay: car.pricePerDay, totalAmount: total, depositAmount: deposit, createdAt,
        };
        const paidAt = new Date(createdAt.getTime() + 5 * 60_000);
        const approvedAt = new Date(createdAt.getTime() + 2 * HOUR);
        const roll = rand();

        if (slot < 0) {
          if (roll < 0.8) {
            rows.push({ ...base, status: "completed", paidAt, paidAmount: paid, ownerApprovedAt: approvedAt, ownerHandedOverAt: base.startAt, renterReceivedAt: base.startAt, startedAt: base.startAt, renterReturnedAt: base.endAt, ownerReceivedBackAt: base.endAt, completedAt: base.endAt, ownerPayoutAmount: total, refundAmount: deposit });
          } else if (roll < 0.92) {
            // Khách hủy sớm (trước giờ nhận xe hơn 48 giờ): hoàn toàn bộ.
            rows.push({ ...base, status: "cancelled", paidAt, paidAmount: paid, ownerApprovedAt: approvedAt, cancelledAt: new Date(Math.max(start - 3 * DAY, createdAt.getTime() + 3 * HOUR)), cancelledById: renterId, refundAmount: paid });
          } else if (roll < 0.97) {
            rows.push({ ...base, status: "rejected", paidAt, paidAmount: paid, rejectReason: pick(REJECT_BOOKING), refundAmount: paid });
          } else {
            rows.push({ ...base, status: "expired", expiresAt: new Date(createdAt.getTime() + 15 * 60_000) });
          }
        } else if (slot === 0) {
          // Đang thuê: đã giao xe hôm qua, chủ xe đã được ghi nhận một nửa tiền thuê.
          rows.push({ ...base, status: "in_use", paidAt, paidAmount: paid, ownerApprovedAt: approvedAt, ownerHandedOverAt: base.startAt, renterReceivedAt: base.startAt, startedAt: base.startAt, ownerPayoutAmount: Math.floor(total / 2) });
        } else if (roll < 0.65) {
          rows.push({ ...base, status: "confirmed", paidAt, paidAmount: paid, ownerApprovedAt: approvedAt });
        } else if (roll < 0.9) {
          // Khách vừa thanh toán, đang chờ chủ xe duyệt trong 6 giờ.
          const justPaid = new Date(now - Math.floor(rand() * 4 * HOUR) - 10 * 60_000);
          rows.push({ ...base, createdAt: new Date(justPaid.getTime() - 5 * 60_000), status: "pending", paidAt: justPaid, paidAmount: paid, expiresAt: new Date(Math.min(justPaid.getTime() + 6 * HOUR, start)) });
        } else {
          rows.push({ ...base, status: "cancelled", paidAt, paidAmount: paid, ownerApprovedAt: approvedAt, cancelledAt: new Date(now - Math.floor(rand() * 5) * DAY - HOUR), cancelledById: renterId, refundAmount: paid });
        }
      }
      if (rows.length >= need) break;
    }
    for (const part of chunks(rows, BATCH)) await prisma.booking.createMany({ data: part });
    addedBookings = rows.length;
  } else if (need > 0) {
    console.log("Đã có đơn mẫu từ lần chạy trước nên không nạp thêm (để không tạo đơn chồng lịch). Dùng --remove-all rồi chạy lại nếu cần đổi số lượng.");
  }
  console.log(`Đơn thuê: thêm ${addedBookings} đơn.`);
}

async function removeAll() {
  const demoUser = { email: { endsWith: DEMO_DOMAIN } };
  const bookings = await prisma.booking.deleteMany({ where: { OR: [{ renter: demoUser }, { vehicle: { owner: demoUser } }] } });
  const cars = await prisma.vehicle.findMany({ where: { owner: demoUser }, select: { id: true } });
  for (const part of chunks(cars.map((c) => c.id), BATCH)) await prisma.vehicle.deleteMany({ where: { id: { in: part } } });
  for (const car of cars) await rm(path.join(UPLOAD_DIR, "vehicles", car.id), { recursive: true, force: true });

  // Tài khoản đã xuất hiện trong nhật ký xem giấy phép không xóa được (nhật ký chỉ cho thêm dòng): giữ lại và báo ra.
  const logged = await prisma.licenseAccessLog.findMany({ select: { actorId: true, targetUserId: true } });
  const keep = new Set(logged.flatMap((l) => [l.actorId, l.targetUserId]));
  // Không xóa tài khoản dev: nó không phải dữ liệu mẫu nghiệp vụ và có mật khẩu riêng.
  const users = await prisma.user.findMany({ where: { ...demoUser, role: { not: "dev" } }, select: { id: true, role: true } });
  const removable = users.filter((u) => !keep.has(u.id)).sort((a, b) => Number(a.role === "admin") - Number(b.role === "admin"));
  for (const part of chunks(removable.filter((u) => u.role !== "admin").map((u) => u.id), BATCH)) await prisma.user.deleteMany({ where: { id: { in: part } } });
  for (const u of removable.filter((x) => x.role === "admin")) await prisma.user.delete({ where: { id: u.id } }).catch(() => keep.add(u.id));
  for (const u of removable) if (!keep.has(u.id)) await rm(path.join(PRIVATE_DIR, "licenses", u.id), { recursive: true, force: true });
  console.log(`Đã xóa ${bookings.count} đơn, ${cars.length} xe, ${removable.length - [...keep].filter((id) => removable.some((u) => u.id === id)).length} tài khoản mẫu. Giữ lại ${users.length - removable.length} tài khoản có trong nhật ký xem giấy phép.`);
}

try {
  await (process.argv.includes("--remove-all") ? removeAll() : importAll());
} finally {
  await prisma.$disconnect();
}
