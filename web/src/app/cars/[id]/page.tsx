import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { VehicleImage } from "@/components/vehicle-image";
import { pageTitle } from "@/lib/brand";
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
  if (!vehicle) return { title: pageTitle("Không tìm thấy xe") };

  const title = pageTitle(`Thuê ${vehicle.title} tại ${vehicle.district}, ${vehicle.city}`);
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

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className={`flex w-full flex-col gap-space-md ${CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        {badge && (
          <span className="rounded-full bg-surface-container-low px-space-sm py-1 text-label-sm text-on-surface-variant">{badge}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-space-sm text-body-md text-on-surface-variant">
      <Icon name="check_circle" className="mt-0.5 !text-[18px] text-tertiary" />
      <span>{children}</span>
    </li>
  );
}

const CANCEL_POLICY = [
  {
    badge: "Hoàn 100% tiền thuê",
    tone: "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant",
    when: "Hủy trước từ 48 giờ",
    note: "Hoặc bất cứ lúc nào khi chủ xe chưa duyệt đơn.",
  },
  {
    badge: "Hoàn 50% tiền thuê",
    tone: "bg-surface-container-high text-on-surface-variant",
    when: "Hủy từ 24 đến dưới 48 giờ",
    note: "Chủ xe nhận 50% tiền thuê vì đã giữ xe cho bạn.",
  },
  {
    badge: "Không hoàn tiền thuê",
    tone: "bg-error-container text-on-error-container",
    when: "Hủy dưới 24 giờ",
    note: "Chủ xe nhận toàn bộ tiền thuê.",
  },
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
    { icon: "airline_seat_recline_normal", label: "Chỗ ngồi", value: `${car.seats} chỗ` },
    { icon: "settings", label: "Hộp số", value: TRANSMISSION_LABELS[car.transmission] },
    { icon: "local_gas_station", label: "Nhiên liệu", value: FUEL_LABELS[car.fuel] },
    { icon: "calendar_month", label: "Năm sản xuất", value: `Đời ${car.year}` },
    { icon: "directions_car", label: "Hãng xe", value: car.brand },
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
      <Header active="/cars" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main>
        <section className="bg-surface-container-lowest">
          <div className="mx-auto flex max-w-page flex-col gap-space-md px-margin-sm pt-space-md pb-space-lg lg:px-margin">
            <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 text-label-md text-on-surface-variant">
              <Link href="/" className="hover:text-primary">
                Trang chủ
              </Link>
              <Icon name="chevron_right" className="!text-[16px]" />
              <Link href={`/cars?city=${encodeURIComponent(car.city)}`} className="hover:text-primary">
                Thuê xe {car.city}
              </Link>
              <Icon name="chevron_right" className="!text-[16px]" />
              <span className="text-on-surface">{car.title}</span>
            </nav>

            <div className="flex flex-wrap items-end justify-between gap-space-md">
              <div className="flex min-w-0 flex-col gap-space-sm">
                <h1 className="text-headline-lg text-on-surface">{car.title}</h1>
                <p className="flex items-center gap-1 text-body-md text-on-surface-variant">
                  <Icon name="location_on" className="!text-[18px] text-primary" />
                  {car.district}, {car.city}
                </p>
              </div>
              <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm">
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-full bg-primary text-label-lg text-on-primary"
                >
                  {car.owner.fullName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="flex flex-col">
                  <span className="text-label-lg text-on-surface">Chủ xe: {car.owner.fullName}</span>
                  <span className="text-label-sm text-on-surface-variant">Xe đã được quản trị viên duyệt</span>
                </span>
              </div>
            </div>

            {gallery.length > 0 ? (
              <div className="grid h-[320px] grid-cols-2 gap-1 overflow-hidden rounded-2xl md:h-[500px] md:grid-cols-4 md:grid-rows-2">
                <div className="col-span-2 md:row-span-2">
                  <VehicleImage src={mainImage?.url} alt={car.title} lazy={false} />
                </div>
                {gallery.map((image, index) => (
                  <div key={image.id} className="hidden md:block">
                    <VehicleImage src={image.url} alt={`${car.title}, ảnh ${index + 2}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[320px] overflow-hidden rounded-2xl md:h-[500px]">
                <VehicleImage src={mainImage?.url} alt={car.title} lazy={false} />
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto flex max-w-page flex-col items-start gap-gutter px-margin-sm py-space-lg lg:flex-row lg:px-margin">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-gutter">
            <Section title="Thông số xe">
              <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-3 lg:grid-cols-5">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-low p-space-md text-center">
                    <Icon name={spec.icon} className="text-primary" />
                    <span className="text-label-sm text-on-surface-variant">{spec.label}</span>
                    <span className="text-label-lg text-on-surface">{spec.value}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Mô tả của chủ xe">
              {car.description ? (
                <p className="text-body-lg whitespace-pre-line text-on-surface-variant">{car.description}</p>
              ) : (
                <p className="text-body-md text-outline">Chủ xe chưa viết mô tả.</p>
              )}
            </Section>

            <Section title="Giấy tờ & Thủ tục nhận xe">
              <div className="grid gap-space-md md:grid-cols-2">
                <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <h3 className="flex items-center gap-space-sm text-title-lg text-primary">
                    <Icon name="badge" />
                    1. Giấy tờ bắt buộc
                  </h3>
                  <ul className="flex flex-col gap-space-sm">
                    <Tick>
                      Giấy phép lái xe còn hiệu lực, đã{" "}
                      <Link href="/verify-license" className="font-semibold text-primary hover:underline">
                        xác minh trên AutoRent VN
                      </Link>
                      .
                    </Tick>
                  </ul>
                </div>
                <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <h3 className="flex items-center gap-space-sm text-title-lg text-primary">
                    <Icon name="account_balance_wallet" />
                    2. Tiền cọc
                  </h3>
                  <ul className="flex flex-col gap-space-sm">
                    <Tick>Trả cùng lúc khi đặt xe, bằng {car.depositRate}% tiền thuê.</Tick>
                    <Tick>Không cần thế chấp tiền mặt hay xe máy.</Tick>
                    <Tick>Hoàn 100% khi cả hai bên xác nhận trả xe.</Tick>
                  </ul>
                </div>
              </div>
            </Section>

            <Section title="Lịch trống" badge="Giờ Việt Nam">
              <AvailabilityCalendar month={month} busy={busy} href={monthHref} />
            </Section>

            <Section title="Chính sách hủy đơn & hoàn tiền">
              <div className="grid gap-space-sm md:grid-cols-3">
                {CANCEL_POLICY.map((row) => (
                  <div key={row.when} className="flex flex-col items-center gap-space-sm rounded-xl bg-surface-container-low p-space-md text-center">
                    <span className={`rounded-full px-space-sm py-0.5 text-label-sm ${row.tone}`}>{row.badge}</span>
                    <p className="text-label-lg text-on-surface">{row.when}</p>
                    <p className="text-body-md text-on-surface-variant">{row.note}</p>
                  </div>
                ))}
              </div>
              <p className="text-body-md text-on-surface-variant">
                Tiền cọc luôn được hoàn đủ khi hủy. Chủ xe từ chối hoặc không trả lời trong 6 giờ thì bạn được hoàn toàn bộ.{" "}
                <Link href="/terms#huy-don" className="font-semibold text-primary hover:underline">
                  Xem điều khoản
                </Link>
              </p>
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
      </main>
      <Footer />
    </>
  );
}
