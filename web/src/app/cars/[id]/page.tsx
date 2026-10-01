import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { CARS, formatVnd, getCar } from "@/lib/cars";

const AMENITIES = ["Camera hành trình", "Bluetooth", "Bản đồ định vị", "Cổng sạc USB"];
const GALLERY = ["[Ảnh 2]", "[Ảnh 3]", "[Ảnh 4]", "[Ảnh 5]"];
const RENTAL_DAYS = 2;

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return CARS.map((car) => ({ id: car.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const car = getCar((await params).id);
  return { title: car ? `${car.name} — Car-Rental` : "Không tìm thấy xe" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-[22px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function CarDetailPage({ params }: { params: Promise<Params> }) {
  const car = getCar((await params).id);
  if (!car) notFound();

  const specs = [
    { label: "Số chỗ", value: `${car.seats} chỗ` },
    { label: "Hộp số", value: car.transmission },
    { label: "Nhiên liệu", value: car.fuel },
    { label: "Năm sản xuất", value: String(car.year) },
  ];
  const subtotal = car.pricePerDay * RENTAL_DAYS;

  return (
    <>
      <Header />
      <main className="flex justify-center pt-6 pb-16">
        <div className="flex w-full max-w-page flex-col gap-6">
          <p className="text-sm whitespace-pre text-muted">
            <Link href="/cars">Tìm xe</Link>
            {`  /  ${car.city}  /  ${car.name}`}
          </p>

          <div className="flex gap-3">
            <div className="flex h-[380px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-placeholder">
              <Image src="/icons/hero-car.svg" alt="" width={72} height={72} />
              <p className="text-sm font-medium text-primary">[Ảnh chính]</p>
            </div>
            <div className="grid h-[380px] w-[590px] shrink-0 grid-cols-2 gap-3">
              {GALLERY.map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-center rounded-[14px] bg-placeholder text-[13px] font-medium text-primary"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h1 className="text-[34px] font-bold text-ink">{car.name}</h1>
                <div className="flex items-center gap-4 text-[15px]">
                  <span className="flex items-center gap-1 font-semibold text-ink">
                    <Image src="/icons/star-16.svg" alt="" width={16} height={16} />
                    {car.rating.toString().replace(".", ",")}
                  </span>
                  <span className="text-muted">
                    {car.district}, {car.city}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                {specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-line bg-white p-4"
                  >
                    <span className="text-[13px] text-muted">{spec.label}</span>
                    <span className="text-base font-semibold text-ink">{spec.value}</span>
                  </div>
                ))}
              </div>

              <Section title="Mô tả">
                <p className="text-base leading-[26px] text-[#33445b]">
                  [Mô tả của chủ xe: tình trạng xe, điều kiện nhận và trả xe, quy định về quãng đường
                  và nhiên liệu.]
                </p>
              </Section>

              <Section title="Tiện nghi">
                <div className="flex flex-wrap gap-3">
                  {AMENITIES.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink"
                    >
                      <Image src="/icons/check-blue-16.svg" alt="" width={16} height={16} />
                      {item}
                    </span>
                  ))}
                </div>
              </Section>

              <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary">
                  CX
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[17px] font-semibold text-ink">[Tên chủ xe]</p>
                  <p className="text-sm text-muted">Đã xác minh giấy tờ và số điện thoại</p>
                </div>
                <button className="h-12 rounded-xl border border-[#c5d2e3] bg-white px-6 text-[15px] font-semibold text-ink">
                  Nhắn tin
                </button>
              </div>

              <Section title="Đánh giá">
                {[0, 1].map((i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-5 text-[15px]">
                    <div className="flex items-center justify-between text-ink">
                      <span>[Tên người thuê]</span>
                      <span className="font-semibold">[Ngày]</span>
                    </div>
                    <p className="leading-6 text-[#33445b]">[Nội dung đánh giá của người thuê trước.]</p>
                  </div>
                ))}
              </Section>

              <Section title="Chính sách hủy và hoàn cọc">
                <p className="text-base leading-[26px] text-[#33445b]">
                  [Mô tả mức hoàn tiền theo thời điểm hủy; tiền cọc được hoàn sau khi chủ xe xác nhận
                  trả xe.]
                </p>
              </Section>
            </div>

            <aside className="flex w-[380px] shrink-0 flex-col gap-4 rounded-2xl border border-line bg-white p-6">
              <p className="flex items-end gap-1">
                <strong className="text-[28px] font-bold text-primary">{formatVnd(car.pricePerDay)}</strong>
                <span className="text-[15px] text-muted">/ngày</span>
              </p>
              <div className="flex gap-2.5">
                {[
                  { label: "Nhận xe", value: "12/10/2026" },
                  { label: "Trả xe", value: "14/10/2026" },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] border border-line bg-surface px-3.5 py-2.5"
                  >
                    <span className="text-xs font-medium text-muted">{field.label}</span>
                    <span className="text-[15px] font-semibold text-ink">{field.value}</span>
                  </div>
                ))}
              </div>
              <dl className="flex flex-col gap-2.5 text-[15px]">
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {formatVnd(car.pricePerDay)} x {RENTAL_DAYS} ngày
                  </dt>
                  <dd className="font-semibold text-ink">{formatVnd(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Phí dịch vụ</dt>
                  <dd className="font-semibold text-ink">[Phí]</dd>
                </div>
                <div className="flex justify-between font-bold text-ink">
                  <dt>Tổng thuê</dt>
                  <dd>{formatVnd(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Tiền cọc (hoàn lại)</dt>
                  <dd className="font-semibold text-ink">[Tiền cọc]</dd>
                </div>
              </dl>
              <Link
                href={`/checkout?car=${car.id}`}
                className="flex h-[52px] items-center justify-center rounded-xl bg-primary text-base font-semibold text-white"
              >
                Đặt xe
              </Link>
              <p className="text-center text-[13px] text-muted">Bạn chưa bị trừ tiền ở bước này</p>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
