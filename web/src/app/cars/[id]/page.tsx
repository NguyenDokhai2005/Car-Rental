import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { formatVnd } from "@/lib/cars";
import { siteUrl } from "@/lib/server/api";
import { BusyPeriod, currentMonth, isMonth } from "@/lib/vehicles/availability";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/vehicles/labels";
import { getBusyPeriods, getVehicle } from "@/lib/vehicles/public";
import { parseFilters } from "@/lib/vehicles/search-params";
import { AvailabilityCalendar } from "./availability-calendar";
import { BookingPanel } from "./booking-panel";

type Params = { id: string };
type SearchParams = { startDate?: string; endDate?: string; month?: string };

function summarize(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const vehicle = await getVehicle((await params).id).catch(() => null);
  if (!vehicle) return { title: "Không tìm thấy xe — Car-Rental" };

  const title = `Thuê ${vehicle.title} tại ${vehicle.district}, ${vehicle.city} — Car-Rental`;
  const description = vehicle.description
    ? summarize(vehicle.description)
    : `Thuê ${vehicle.title} tự lái, giá ${formatVnd(vehicle.pricePerDay)} mỗi ngày tại ${vehicle.district}, ${vehicle.city}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: vehicle.coverUrl ? [`${siteUrl()}${vehicle.coverUrl}`] : undefined,
    },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-[22px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const CANCEL_POLICY = [
  { when: "Chủ xe chưa duyệt, từ chối hoặc không trả lời trong 6 giờ", refund: "Hoàn toàn bộ" },
  { when: "Hủy trước giờ nhận xe từ 48 giờ", refund: "Hoàn 100% tiền thuê và tiền cọc" },
  { when: "Hủy từ 24 đến dưới 48 giờ", refund: "Hoàn 50% tiền thuê và tiền cọc" },
  { when: "Hủy dưới 24 giờ", refund: "Chỉ hoàn tiền cọc" },
];

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const car = await getVehicle(id);
  if (!car) notFound();

  const month = isMonth(sp.month) ? sp.month : currentMonth();
  let busy: BusyPeriod[] | null = null;
  try {
    busy = await getBusyPeriods(id, month);
  } catch {
    busy = null;
  }

  // Ngày khách đã chọn ở trang tìm kiếm được mang sang đây để điền sẵn vào khung đặt xe. Giá trị sai bị bỏ qua.
  const { filters } = parseFilters({ startDate: sp.startDate, endDate: sp.endDate });

  const dateQuery = filters.startDate ? `startDate=${filters.startDate}&endDate=${filters.endDate}&` : "";
  const monthHref = (m: string) => `/cars/${id}?${dateQuery}month=${m}`;

  const [mainImage, ...otherImages] = car.images;
  const gallery = otherImages.slice(0, 4);
  const specs = [
    { label: "Số chỗ", value: `${car.seats} chỗ` },
    { label: "Hộp số", value: TRANSMISSION_LABELS[car.transmission] },
    { label: "Nhiên liệu", value: FUEL_LABELS[car.fuel] },
    { label: "Năm sản xuất", value: String(car.year) },
  ];

  // Dữ liệu có cấu trúc cho công cụ tìm kiếm. Mô tả do chủ xe nhập nên phải thoát "<", nếu không chuỗi "</script>" trong
  // mô tả sẽ đóng thẻ sớm và cho phép chèn mã vào trang.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: car.title,
    description: car.description || undefined,
    brand: { "@type": "Brand", name: car.brand },
    image: car.images.map((image) => `${siteUrl()}${image.url}`),
    offers: {
      "@type": "Offer",
      price: car.pricePerDay,
      priceCurrency: "VND",
      url: `${siteUrl()}/cars/${car.id}`,
    },
  }).replace(/</g, "\\u003c");

  return (
    <>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="flex justify-center pt-6 pb-16">
        <div className="flex w-full max-w-page flex-col gap-6">
          <p className="text-sm whitespace-pre text-muted">
            <Link href="/cars">Tìm xe</Link>
            {`  /  ${car.city}  /  ${car.title}`}
          </p>

          <div className="flex gap-3">
            <div className="flex h-[380px] min-w-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-placeholder">
              {mainImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
                <img src={mainImage.url} alt={car.title} className="size-full object-cover" />
              ) : (
                <>
                  <Image src="/icons/hero-car.svg" alt="" width={72} height={72} />
                  <p className="text-sm font-medium text-primary">Chủ xe chưa đăng ảnh</p>
                </>
              )}
            </div>
            {gallery.length > 0 && (
              <div className="grid h-[380px] w-[590px] shrink-0 grid-cols-2 gap-3">
                {gallery.map((image, index) => (
                  <div key={image.id} className="overflow-hidden rounded-[14px] bg-placeholder">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý */}
                    <img src={image.url} alt={`${car.title}, ảnh ${index + 2}`} loading="lazy" className="size-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h1 className="text-[34px] font-bold text-ink">{car.title}</h1>
                <p className="text-[15px] text-muted">
                  {car.district}, {car.city}
                </p>
              </div>

              <div className="flex gap-3">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-line bg-white p-4">
                    <span className="text-[13px] text-muted">{spec.label}</span>
                    <span className="text-base font-semibold text-ink">{spec.value}</span>
                  </div>
                ))}
              </div>

              <Section title="Mô tả">
                {car.description ? (
                  <p className="text-base leading-[26px] whitespace-pre-line text-[#33445b]">{car.description}</p>
                ) : (
                  <p className="text-base text-muted">Chủ xe chưa viết mô tả.</p>
                )}
              </Section>

              <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
                <span
                  aria-hidden
                  className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary"
                >
                  {car.owner.fullName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[17px] font-semibold text-ink">{car.owner.fullName}</p>
                  <p className="text-sm text-muted">Chủ xe</p>
                </div>
              </div>

              <Section title="Lịch trống">
                <AvailabilityCalendar month={month} busy={busy} href={monthHref} />
              </Section>

              <Section title="Chính sách hủy và hoàn tiền">
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
                  {CANCEL_POLICY.map((row) => (
                    <div key={row.when} className="flex justify-between gap-4 border-t border-line px-5 py-3 text-[15px] first:border-t-0">
                      <span className="text-ink">{row.when}</span>
                      <span className="font-semibold text-ink">{row.refund}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <BookingPanel
              vehicleId={car.id}
              pricePerDay={car.pricePerDay}
              depositRate={car.depositRate}
              initialStartDate={filters.startDate}
              initialEndDate={filters.endDate}
              returnTo={`/cars/${id}${dateQuery ? `?${dateQuery.slice(0, -1)}` : ""}`}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
