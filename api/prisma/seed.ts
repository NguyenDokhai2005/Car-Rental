// Dữ liệu mẫu cho môi trường dev, lấy theo các xe và đơn trong thiết kế giao diện.
// Chạy: pnpm --filter api db:seed. Script XÓA SẠCH dữ liệu cũ trước khi nạp.
import { hash } from "@node-rs/argon2";
import { BookingStatus, FuelType, PrismaClient, Transmission } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_PASSWORD = "Password123!";

// Giờ Việt Nam (UTC+7) sang Date UTC. Ví dụ ict("2026-10-12", 9) là 09:00 ICT.
function ict(date: string, hour = 9): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+07:00`);
}

function depositOf(total: number, ratePercent: number): number {
  return Math.round((total * ratePercent) / 100);
}

type CarSeed = {
  key: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  seats: number;
  transmission: Transmission;
  fuel: FuelType;
  city: string;
  district: string;
  price: number;
  owner: "tran" | "le";
  status: "approved" | "pending";
};

const HCM = "TP. Hồ Chí Minh";

const CARS: CarSeed[] = [
  { key: "vios", title: "Toyota Vios 2022", brand: "Toyota", model: "Vios", year: 2022, plate: "51K12345", seats: 5, transmission: "automatic", fuel: "petrol", city: HCM, district: "Quận 7", price: 650000, owner: "tran", status: "approved" },
  { key: "accent", title: "Hyundai Accent 2023", brand: "Hyundai", model: "Accent", year: 2023, plate: "51L23456", seats: 5, transmission: "automatic", fuel: "petrol", city: HCM, district: "Quận 1", price: 600000, owner: "tran", status: "approved" },
  { key: "vf6", title: "VinFast VF 6 2024", brand: "VinFast", model: "VF 6", year: 2024, plate: "51K34567", seats: 5, transmission: "automatic", fuel: "electric", city: HCM, district: "Thủ Đức", price: 1100000, owner: "le", status: "approved" },
  { key: "cx5", title: "Mazda CX-5 2021", brand: "Mazda", model: "CX-5", year: 2021, plate: "51H45678", seats: 5, transmission: "automatic", fuel: "petrol", city: HCM, district: "Bình Thạnh", price: 1200000, owner: "tran", status: "approved" },
  { key: "xpander", title: "Mitsubishi Xpander 2023", brand: "Mitsubishi", model: "Xpander", year: 2023, plate: "51G56789", seats: 7, transmission: "automatic", fuel: "petrol", city: HCM, district: "Quận 2", price: 950000, owner: "le", status: "approved" },
  { key: "seltos", title: "Kia Seltos 2022", brand: "Kia", model: "Seltos", year: 2022, plate: "51F67890", seats: 5, transmission: "automatic", fuel: "petrol", city: HCM, district: "Quận 10", price: 850000, owner: "le", status: "approved" },
  { key: "city", title: "Honda City 2021", brand: "Honda", model: "City", year: 2021, plate: "51A78901", seats: 5, transmission: "automatic", fuel: "petrol", city: HCM, district: "Tân Bình", price: 620000, owner: "tran", status: "approved" },
  { key: "vf5", title: "VinFast VF 5 2023", brand: "VinFast", model: "VF 5", year: 2023, plate: "51K89012", seats: 5, transmission: "automatic", fuel: "electric", city: HCM, district: "Quận 9", price: 780000, owner: "le", status: "approved" },
  { key: "everest", title: "Ford Everest 2022", brand: "Ford", model: "Everest", year: 2022, plate: "51D90123", seats: 7, transmission: "automatic", fuel: "diesel", city: HCM, district: "Quận 7", price: 1600000, owner: "le", status: "approved" },
  // Hai xe chờ admin duyệt
  { key: "xl7", title: "Suzuki XL7 2022", brand: "Suzuki", model: "XL7", year: 2022, plate: "51B01234", seats: 7, transmission: "automatic", fuel: "petrol", city: HCM, district: "Quận 3", price: 800000, owner: "tran", status: "pending" },
  { key: "fortuner", title: "Toyota Fortuner 2021", brand: "Toyota", model: "Fortuner", year: 2021, plate: "51C12340", seats: 7, transmission: "manual", fuel: "diesel", city: HCM, district: "Quận 12", price: 1400000, owner: "le", status: "pending" },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Không chạy seed ở môi trường production.");
  }

  // TRUNCATE không kích hoạt trigger chặn xóa của license_access_logs.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE license_access_logs, payments, bookings, vehicle_blocks, vehicle_images, vehicles, refresh_tokens, users CASCADE`,
  );

  const passwordHash = await hash(DEV_PASSWORD);

  const admin = await prisma.user.create({
    data: { email: "admin@carrental.test", passwordHash, fullName: "Quản Trị Viên", phone: "0900000001", role: "admin" },
  });
  const ownerTran = await prisma.user.create({
    data: { email: "chuxe.tran@carrental.test", passwordHash, fullName: "Trần Minh Chủ", phone: "0900000002", role: "owner" },
  });
  const ownerLe = await prisma.user.create({
    data: { email: "chuxe.le@carrental.test", passwordHash, fullName: "Lê Hoàng Xe", phone: "0900000003", role: "owner" },
  });
  const renterAn = await prisma.user.create({
    data: {
      email: "khach.an@carrental.test",
      passwordHash,
      fullName: "Nguyễn Văn An",
      phone: "0900000004",
      role: "renter",
      licenseStatus: "verified",
      licenseNumber: "790123456789",
      licenseClass: "B1",
      licenseExpiresOn: new Date("2030-05-20"),
      licenseFrontKey: "licenses/seed-an/front.jpg",
      licenseBackKey: "licenses/seed-an/back.jpg",
      licenseReviewedById: admin.id,
      licenseReviewedAt: new Date(),
    },
  });
  // Khách chờ admin xác minh GPLX
  await prisma.user.create({
    data: {
      email: "khach.binh@carrental.test",
      passwordHash,
      fullName: "Phạm Thị Bình",
      phone: "0900000005",
      role: "renter",
      licenseStatus: "pending",
      licenseNumber: "790987654321",
      licenseClass: "B2",
      licenseExpiresOn: new Date("2031-01-15"),
      licenseFrontKey: "licenses/seed-binh/front.jpg",
      licenseBackKey: "licenses/seed-binh/back.jpg",
    },
  });
  // Khách mới, chưa nộp GPLX
  await prisma.user.create({
    data: { email: "khach.cuong@carrental.test", passwordHash, fullName: "Võ Quốc Cường", phone: "0900000006", role: "renter" },
  });

  const owners = { tran: ownerTran.id, le: ownerLe.id };
  const vehicleIds: Record<string, string> = {};
  const vehiclePrice: Record<string, number> = {};

  for (const car of CARS) {
    const approved = car.status === "approved";
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: owners[car.owner],
        title: car.title,
        brand: car.brand,
        model: car.model,
        year: car.year,
        plateNumber: car.plate,
        seats: car.seats,
        transmission: car.transmission,
        fuel: car.fuel,
        description: "Xe sạch sẽ, bảo dưỡng định kỳ. Nhận và trả xe đúng giờ, đổ đầy bình khi trả.",
        city: car.city,
        district: car.district,
        pricePerDay: car.price,
        status: car.status,
        reviewedById: approved ? admin.id : null,
        reviewedAt: approved ? new Date() : null,
        images: {
          create: [0, 1, 2].map((position) => ({
            position,
            storageKey: `vehicles/${car.key}/${position + 1}.jpg`,
          })),
        },
      },
    });
    vehicleIds[car.key] = vehicle.id;
    vehiclePrice[car.key] = car.price;
  }

  // Chủ xe tự chặn lịch
  await prisma.vehicleBlock.create({
    data: { vehicleId: vehicleIds.cx5, startAt: ict("2026-10-26", 0), endAt: ict("2026-10-28", 0), reason: "Xe đi bảo dưỡng" },
  });

  // Ba đơn của khách An, khớp màn "Đơn của tôi"
  type BookingSeed = {
    car: string;
    start: string;
    end: string;
    days: number;
    status: BookingStatus;
    approved: boolean;
    paid: boolean;
  };
  const bookings: BookingSeed[] = [
    // Chưa thanh toán: còn 15 phút để trả, chủ xe chưa thấy đơn
    { car: "vios", start: "2026-10-12", end: "2026-10-14", days: 2, status: "pending", approved: false, paid: false },
    // Đã thanh toán và chủ xe đã duyệt
    { car: "vf6", start: "2026-10-25", end: "2026-10-27", days: 2, status: "confirmed", approved: true, paid: true },
    // Đã thanh toán, đang chờ chủ xe duyệt trong 6 giờ
    { car: "cx5", start: "2026-11-02", end: "2026-11-05", days: 3, status: "pending", approved: false, paid: true },
  ];

  for (const [index, b] of bookings.entries()) {
    const price = vehiclePrice[b.car];
    const total = price * b.days;
    const deposit = depositOf(total, 30);
    const now = new Date();
    const booking = await prisma.booking.create({
      data: {
        renterId: renterAn.id,
        vehicleId: vehicleIds[b.car],
        startAt: ict(b.start),
        endAt: ict(b.end),
        status: b.status,
        rentalDays: b.days,
        pricePerDay: price,
        totalAmount: total,
        depositAmount: deposit,
        // Đơn pending: 15 phút để thanh toán, hoặc 6 giờ để chủ xe duyệt nếu đã thanh toán (SPEC §2)
        expiresAt: b.status === "pending" ? new Date(now.getTime() + (b.paid ? 6 * 60 : 15) * 60 * 1000) : null,
        // Khách trả tiền thuê + tiền cọc một lần khi đặt
        paidAt: b.paid ? now : null,
        paidAmount: b.paid ? total + deposit : 0,
        ownerApprovedAt: b.approved ? now : null,
      },
    });
    if (b.paid) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          provider: "vnpay",
          txnRef: `SEED-${index + 1}`,
          providerTxnId: `VNP-SEED-${index + 1}`,
          amount: total + deposit,
          status: "paid",
          paidAt: now,
          rawPayload: { note: "dữ liệu mẫu" },
        },
      });
    }
  }

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.vehicle.count(),
    prisma.vehicleImage.count(),
    prisma.vehicleBlock.count(),
    prisma.booking.count(),
    prisma.payment.count(),
  ]);
  console.log(
    `Seed xong: ${counts[0]} người dùng, ${counts[1]} xe, ${counts[2]} ảnh, ${counts[3]} lịch chặn, ${counts[4]} đơn, ${counts[5]} thanh toán.`,
  );
  console.log(`Mật khẩu mọi tài khoản mẫu: ${DEV_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
