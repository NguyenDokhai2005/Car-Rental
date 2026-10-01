import Image from "next/image";
import Link from "next/link";
import { CarCard } from "@/components/car-card";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { CARS, type Car } from "@/lib/cars";

const STEPS = [
  {
    icon: "/icons/step-search.svg",
    title: "1. Chọn xe",
    text: "Lọc theo thành phố, giá, số chỗ ngồi và loại nhiên liệu, xem lịch trống của từng xe.",
  },
  {
    icon: "/icons/step-payment.svg",
    title: "2. Đặt xe và thanh toán",
    text: "Chọn ngày, xem tổng chi phí và tiền cọc, rồi thanh toán trực tuyến.",
  },
  {
    icon: "/icons/step-car.svg",
    title: "3. Nhận xe và lên đường",
    text: "Gặp chủ xe tại điểm hẹn, kiểm tra xe cùng nhau và bắt đầu chuyến đi.",
  },
];

// Quận hiển thị theo thiết kế trang chủ (khác dữ liệu mẫu ở trang tìm xe).
const FEATURED_DISTRICTS: Record<string, string> = {
  vios: "Quận 7",
  vf6: "Cầu Giấy",
  cx5: "Hải Châu",
  xpander: "Thủ Đức",
};

const FEATURED: Car[] = CARS.filter((car) => car.id in FEATURED_DISTRICTS)
  .sort((a, b) => Object.keys(FEATURED_DISTRICTS).indexOf(a.id) - Object.keys(FEATURED_DISTRICTS).indexOf(b.id))
  .map((car) => ({ ...car, district: FEATURED_DISTRICTS[car.id] }));

const SEARCH_FIELDS = [
  { label: "Địa điểm nhận xe", value: "TP. Hồ Chí Minh" },
  { label: "Ngày nhận", value: "[Chọn ngày]" },
  { label: "Ngày trả", value: "[Chọn ngày]" },
];

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section className="flex justify-center bg-primary-50 py-[72px]">
          <div className="flex w-full max-w-page items-center gap-12">
            <div className="flex w-[640px] shrink-0 flex-col gap-5">
              <h1 className="text-[44px] leading-[56px] font-bold text-ink">
                Thuê xe tự lái từ chủ xe ngay trong thành phố của bạn
              </h1>
              <p className="text-[17px] leading-7 text-muted">
                Chọn xe, đặt lịch và nhận xe nhanh chóng. Không cần đến cửa hàng, giá niêm yết rõ
                ràng trước khi đặt.
              </p>
              <form
                action="/cars"
                className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4"
              >
                <div className="flex gap-2.5">
                  {SEARCH_FIELDS.map((field) => (
                    <div
                      key={field.label}
                      className="flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] border border-line bg-surface px-3.5 py-2.5"
                    >
                      <span className="text-xs font-medium text-muted">{field.label}</span>
                      <span className="text-[15px] font-semibold text-ink">{field.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="submit"
                  className="h-12 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white"
                >
                  Tìm xe
                </button>
              </form>
            </div>
            <div className="flex h-[400px] w-[512px] shrink-0 flex-col items-center justify-center gap-2.5 rounded-3xl bg-primary-100">
              <Image src="/icons/hero-car.svg" alt="" width={72} height={72} />
              <p className="text-sm font-medium text-primary">[Ảnh chính: xe và khung cảnh]</p>
            </div>
          </div>
        </section>

        <section className="flex justify-center bg-white py-16">
          <div className="flex w-full max-w-page flex-col gap-8">
            <h2 className="text-center text-[32px] font-bold text-ink">Thuê xe chỉ với 3 bước</h2>
            <div className="flex gap-6">
              {STEPS.map((step) => (
                <div
                  key={step.title}
                  className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface p-7"
                >
                  <span className="flex size-12 items-center justify-center rounded-3xl bg-primary-50">
                    <Image src={step.icon} alt="" width={24} height={24} />
                  </span>
                  <h3 className="text-xl font-semibold text-ink">{step.title}</h3>
                  <p className="text-[15px] leading-6 text-muted">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex justify-center py-16">
          <div className="flex w-full max-w-page flex-col gap-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[32px] font-bold text-ink">Xe nổi bật</h2>
              <Link href="/cars" className="text-[15px] font-semibold text-primary">
                Xem tất cả xe
              </Link>
            </div>
            <div className="flex gap-[18px]">
              {FEATURED.map((car) => (
                <CarCard key={car.name} car={car} />
              ))}
            </div>
          </div>
        </section>

        <section className="flex justify-center pb-[72px]">
          <div className="flex w-full max-w-page items-center justify-between gap-6 rounded-3xl bg-primary p-12">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <h2 className="text-[30px] leading-10 font-bold text-white">
                Xe của bạn đang nằm yên? Cho thuê để tận dụng những ngày không dùng
              </h2>
              <p className="text-base text-cta-text">
                Bạn tự đặt giá, tự chặn ngày bận và chọn đơn muốn nhận.
              </p>
            </div>
            <Link
              href="/owner"
              className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-white px-6 text-[15px] font-semibold text-primary"
            >
              Đăng xe của bạn
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
