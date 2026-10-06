import Link from "next/link";
import { CarCard } from "@/components/car-card";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { formatVnd } from "@/lib/cars";
import { searchVehicles, type PublicVehicle } from "@/lib/vehicles/public";
import { vnToday } from "@/lib/vehicles/search-params";

// Trang chủ lấy dữ liệu từ API lúc có người truy cập. Không dựng sẵn lúc build vì khi build (CI, Docker) chưa có API.
export const dynamic = "force-dynamic";

const PROMISES = [
  { icon: "verified_user", text: "Tiền được giữ hộ" },
  { icon: "lock_clock", text: "Không trùng lịch" },
  { icon: "credit_card_off", text: "Không cần thế chấp" },
];

const QUICK_FILTERS = [
  { href: "/cars?transmission=automatic", icon: "auto_transmission", tone: "text-primary", label: "Xe số tự động" },
  { href: "/cars?fuel=electric", icon: "bolt", tone: "text-tertiary", label: "Xe điện" },
  { href: "/cars?seats=7", icon: "airport_shuttle", tone: "text-primary", label: "Xe 7 chỗ" },
  { href: "/cars?sort=price_asc", icon: "savings", tone: "text-tertiary", label: "Giá thấp trước" },
];

const STANDARDS = [
  {
    icon: "shield_with_heart",
    box: "bg-primary-fixed text-on-primary-fixed",
    title: "Tiền được giữ hộ",
    text: "Chúng tôi giữ khoản thanh toán của bạn. Chủ xe chỉ nhận tiền khi cả hai bên xác nhận giao xe trên ứng dụng.",
  },
  {
    icon: "lock",
    box: "bg-tertiary-fixed text-on-tertiary-fixed",
    title: "Không trùng lịch",
    text: "Mỗi xe chỉ nhận một đơn cho một khoảng thời gian, nên xe bạn đặt luôn là của bạn.",
  },
  {
    icon: "account_balance_wallet",
    box: "bg-secondary-fixed text-on-secondary-fixed",
    title: "Thanh toán một lần",
    text: "Trả tiền thuê và tiền cọc khi đặt. Không cần thế chấp tài sản, và tiền cọc được hoàn khi trả xe.",
  },
  {
    icon: "schedule",
    box: "bg-surface-container-high text-primary",
    title: "Hủy linh hoạt",
    text: "Tiền cọc luôn được hoàn. Hủy trước 48 giờ, hoặc khi chủ xe chưa duyệt, bạn được hoàn 100% tiền thuê.",
  },
];

const CATEGORIES = [
  { query: "seats=4&seats=5", image: "/images/home/cat-sedan.webp", badge: "Đô thị linh hoạt", title: "Xe 4-5 chỗ", text: "Gọn gàng cho đi làm và đi phố" },
  { query: "seats=7", image: "/images/home/cat-7seat.webp", badge: "Rộng rãi gia đình", title: "Xe 7 chỗ", text: "Thoải mái cho cả nhà và nhóm bạn" },
  { query: "fuel=electric", image: "/images/home/cat-electric.webp", badge: "Tiết kiệm xanh", title: "Xe điện", text: "Êm ái, không tốn xăng", green: true },
  { query: "fuel=diesel", image: "/images/home/cat-pickup.webp", badge: "Chinh phục đường dài", title: "Xe máy dầu", text: "Bền bỉ cho những chuyến đi xa" },
];

const STEPS = [
  { title: "Tìm & Chọn xe", text: "Lọc theo khu vực, ngày thuê, giá, số chỗ và nhiên liệu. Xem lịch trống của từng xe." },
  { title: "Đặt xe & Thanh toán", text: "Xe được giữ cho bạn 15 phút. Trả tiền thuê và tiền cọc một lần để gửi đơn tới chủ xe." },
  { title: "Chủ xe duyệt & Nhận xe", text: "Chủ xe duyệt trong tối đa 6 giờ. Khi nhận xe, hai bên cùng bấm xác nhận trên ứng dụng." },
  { title: "Trả xe & Nhận lại cọc", text: "Trả xe đúng hẹn, hai bên xác nhận và tiền cọc được hoàn cho bạn." },
];

type Featured = { items: PublicVehicle[]; total: number };

// Xe nổi bật = 6 xe mới được duyệt gần nhất. Lỗi API thì ẩn mục này thay vì làm hỏng cả trang chủ.
async function loadFeatured(): Promise<Featured> {
  try {
    const page = await searchVehicles(new URLSearchParams({ sort: "newest", limit: "6" }));
    return { items: page.items, total: page.total };
  } catch {
    return { items: [], total: 0 };
  }
}

async function lowestPrice(query: string): Promise<number | null> {
  try {
    const page = await searchVehicles(new URLSearchParams(`${query}&sort=price_asc&limit=1`));
    return page.items[0]?.pricePerDay ?? null;
  } catch {
    return null;
  }
}

const FIELD = "flex flex-col justify-between rounded-lg bg-surface-container-lowest p-space-md";
const FIELD_LABEL = "mb-1 flex items-center gap-space-xs text-on-surface-variant";
const FIELD_INPUT = "w-full bg-transparent text-title-lg text-on-surface outline-none placeholder:font-normal placeholder:text-outline";

export default async function HomePage() {
  const [featured, ...prices] = await Promise.all([loadFeatured(), ...CATEGORIES.map((c) => lowestPrice(c.query))]);
  const today = vnToday();
  const spotlight = featured.items.find((car) => car.coverUrl) ?? null;

  return (
    <>
      <Header active="/" />
      <main className="w-full bg-surface">
        <section className="relative w-full overflow-hidden bg-surface-container-low pb-space-xl">
          <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 -left-20 size-80 rounded-full bg-tertiary-fixed-dim/20 blur-3xl" />
          <div className="mx-auto max-w-7xl px-margin-sm pt-space-lg lg:px-margin lg:pt-space-xl">
            <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
              <div className="z-10 flex flex-col gap-space-md lg:col-span-7">
                <div className="inline-flex w-fit items-center gap-space-xs rounded-full bg-surface-container-lowest px-space-md py-1 text-primary shadow-sm">
                  <Icon name="verified" className="!text-[18px]" />
                  <span className="text-label-md">Nền tảng thuê xe tự lái giữa chủ xe và khách thuê</span>
                </div>
                <h1 className="text-headline-lg leading-tight tracking-tight text-on-surface lg:text-display lg:leading-tight">
                  Thuê Xe Tự Lái Uy Tín, <br className="hidden sm:inline" />
                  <span className="text-primary">Đặt Xe Trực Tuyến</span> Nhanh Chóng
                </h1>
                <p className="max-w-2xl text-body-lg text-on-surface-variant">
                  Chọn xe từ các chủ xe đã được kiểm duyệt, xem lịch trống và giá rõ ràng trước khi đặt. Trả tiền một lần, chủ xe
                  chỉ nhận tiền khi bạn đã nhận xe.
                </p>
                <div className="flex flex-wrap items-center gap-space-lg pt-space-xs text-on-surface">
                  {PROMISES.map((promise) => (
                    <div key={promise.text} className="flex items-center gap-space-xs">
                      <Icon name={promise.icon} className="!text-[22px] text-tertiary" />
                      <span className="text-label-md">{promise.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative lg:col-span-5">
                <div className="relative overflow-hidden rounded-2xl bg-surface-container shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ trong public/, hoặc ảnh xe đã được API xử lý */}
                  <img
                    src={spotlight?.coverUrl ?? "/images/home/hero.webp"}
                    alt={spotlight ? spotlight.title : "Xe tự lái trên đường phố"}
                    className="h-80 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-transparent to-transparent" />
                  <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between text-on-primary">
                    <div>
                      <p className="text-label-sm text-surface-variant">{spotlight ? "Xe mới đăng" : "Thuê xe tự lái"}</p>
                      <p className="text-headline-sm">{spotlight ? spotlight.title : "Sẵn sàng cho chuyến đi của bạn"}</p>
                    </div>
                    {spotlight && (
                      <Link
                        href={`/cars/${spotlight.id}`}
                        className="rounded-full bg-tertiary-container px-3 py-1 text-label-md text-on-tertiary transition-colors hover:bg-tertiary"
                      >
                        Xem xe
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <form action="/cars" className="relative z-20 mt-space-xl rounded-2xl bg-surface-container-lowest p-space-md shadow-xl lg:p-space-lg">
              <div className="grid grid-cols-1 gap-space-sm rounded-xl bg-surface-container-low p-space-sm md:grid-cols-12 lg:gap-space-md">
                <label className={`${FIELD} md:col-span-4`}>
                  <span className={FIELD_LABEL}>
                    <Icon name="location_on" className="text-primary" />
                    <span className="text-label-sm tracking-wider uppercase">Địa điểm nhận xe</span>
                  </span>
                  <input name="city" placeholder="TP. Hồ Chí Minh" maxLength={100} className={FIELD_INPUT} />
                </label>
                <label className={`${FIELD} md:col-span-3`}>
                  <span className={FIELD_LABEL}>
                    <Icon name="calendar_today" className="text-primary" />
                    <span className="text-label-sm tracking-wider uppercase">Ngày nhận xe</span>
                  </span>
                  <input type="date" name="startDate" min={today} className={FIELD_INPUT} />
                </label>
                <label className={`${FIELD} md:col-span-3`}>
                  <span className={FIELD_LABEL}>
                    <Icon name="event_repeat" className="text-primary" />
                    <span className="text-label-sm tracking-wider uppercase">Ngày trả xe</span>
                  </span>
                  <input type="date" name="endDate" min={today} className={FIELD_INPUT} />
                </label>
                <div className="flex md:col-span-2">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-space-xs rounded-lg bg-primary py-space-md text-headline-sm text-on-primary shadow-md transition-all hover:bg-primary-container"
                  >
                    <Icon name="search" className="!text-[24px]" />
                    Tìm xe
                  </button>
                </div>
              </div>
              <div className="mt-space-md flex flex-wrap items-center gap-space-sm">
                <span className="mr-1 text-label-md text-on-surface-variant">Tìm nhanh:</span>
                {QUICK_FILTERS.map((filter) => (
                  <Link
                    key={filter.href}
                    href={filter.href}
                    className="flex items-center gap-1 rounded-full bg-surface-container-low px-space-md py-1.5 text-label-md text-on-surface transition-colors hover:bg-primary-fixed hover:text-on-primary-fixed"
                  >
                    <Icon name={filter.icon} className={`!text-[16px] ${filter.tone}`} />
                    {filter.label}
                  </Link>
                ))}
              </div>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-margin-sm py-space-xl lg:px-margin">
          <div className="mx-auto mb-space-lg max-w-2xl text-center">
            <span className="text-label-md tracking-wider text-primary uppercase">Tiêu chuẩn dịch vụ AutoRent</span>
            <h2 className="mt-1 text-headline-lg text-on-surface">An Tâm Trọn Vẹn Trên Mọi Cung Đường</h2>
          </div>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
            {STANDARDS.map((item) => (
              <div key={item.title} className="rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm transition-shadow hover:shadow-md">
                <div className={`mb-space-md flex size-12 items-center justify-center rounded-xl ${item.box}`}>
                  <Icon name={item.icon} className="!text-[28px]" />
                </div>
                <h3 className="mb-space-xs text-headline-sm text-on-surface">{item.title}</h3>
                <p className="text-body-md text-on-surface-variant">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-low py-space-xl">
          <div className="mx-auto max-w-7xl px-margin-sm lg:px-margin">
            <div className="mb-space-lg flex flex-col justify-between gap-space-sm md:flex-row md:items-end">
              <div>
                <span className="text-label-md tracking-wider text-primary uppercase">Phân hạng xe</span>
                <h2 className="mt-1 text-headline-lg text-on-surface">Danh Mục Xe Phổ Biến</h2>
              </div>
              <p className="max-w-md text-body-md text-on-surface-variant">
                Chọn nhanh dòng xe phù hợp với nhu cầu đi làm, đi cùng gia đình hay chuyến du lịch xa.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIES.map((category, index) => {
                const price = prices[index];
                return (
                  <Link
                    key={category.query}
                    href={`/cars?${category.query}`}
                    className="group overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="relative h-44 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ (WebP) trong public/ */}
                      <img
                        src={category.image}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span
                        className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-label-sm ${
                          category.green
                            ? "bg-tertiary-container text-on-tertiary"
                            : "bg-surface-container-lowest/90 text-on-surface backdrop-blur-md"
                        }`}
                      >
                        {category.badge}
                      </span>
                    </div>
                    <div className="p-space-md">
                      <h3 className="text-title-lg text-on-surface transition-colors group-hover:text-primary">{category.title}</h3>
                      <p className="mt-1 text-body-md text-on-surface-variant">{category.text}</p>
                      <div className="mt-space-md flex items-center justify-between">
                        {price === null ? (
                          <span className="flex items-center gap-1 text-label-lg text-primary">
                            Xem xe <Icon name="arrow_forward" className="!text-[16px]" />
                          </span>
                        ) : (
                          <>
                            <span className="text-label-sm text-outline">Chỉ từ</span>
                            <span className="text-title-lg font-bold text-primary">
                              {formatVnd(price)}
                              <span className="text-body-md font-normal text-on-surface-variant">/ngày</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {featured.items.length > 0 && (
          <section className="mx-auto max-w-7xl px-margin-sm py-space-xl lg:px-margin">
            <div className="mb-space-lg flex flex-col justify-between md:flex-row md:items-end">
              <div>
                <span className="text-label-md tracking-wider text-primary uppercase">Vừa được duyệt</span>
                <h2 className="mt-1 text-headline-lg text-on-surface">Xe Nổi Bật Sẵn Sàng Bàn Giao</h2>
              </div>
              <Link
                href="/cars"
                className="mt-2 inline-flex items-center gap-1 text-label-lg text-primary transition-colors hover:text-primary-container md:mt-0"
              >
                Xem tất cả {featured.total} xe
                <Icon name="arrow_forward" className="!text-[18px]" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
              {featured.items.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </section>
        )}

        <section className="bg-surface-container-low py-space-xl">
          <div className="mx-auto max-w-7xl px-margin-sm lg:px-margin">
            <div className="mx-auto mb-space-xl max-w-2xl text-center">
              <span className="text-label-md tracking-wider text-primary uppercase">Quy trình đơn giản</span>
              <h2 className="mt-1 text-headline-lg text-on-surface">Thuê Xe Tự Lái Chỉ Với 4 Bước Nhanh</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Mọi bước đều làm trên ứng dụng, và tiền của bạn được giữ hộ cho tới khi bạn nhận xe.
              </p>
            </div>
            <ol className="grid grid-cols-1 gap-gutter md:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col items-start rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm">
                  <div className="mb-space-md flex size-10 items-center justify-center rounded-full bg-primary text-headline-sm text-on-primary">
                    {index + 1}
                  </div>
                  <h3 className="mb-1 text-title-lg text-on-surface">{step.title}</h3>
                  <p className="text-body-md text-on-surface-variant">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-margin-sm py-space-xl lg:px-margin">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary-container p-space-lg text-on-primary shadow-xl lg:p-space-xl">
            <div className="pointer-events-none absolute -right-20 -bottom-20 size-80 rounded-full bg-tertiary-fixed-dim/20 blur-2xl" />
            <div className="relative z-10 grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
              <div className="flex flex-col gap-space-sm lg:col-span-8">
                <span className="inline-block w-fit rounded-full bg-surface-container-lowest/20 px-3 py-1 text-label-md text-on-primary backdrop-blur-md">
                  Dành cho chủ xe ô tô
                </span>
                <h2 className="text-headline-lg tracking-tight text-on-primary lg:text-display">
                  Bạn có xe nhàn rỗi? <br className="hidden sm:inline" />
                  <span className="text-tertiary-fixed">Cho thuê</span> cùng AutoRent
                </h2>
                <p className="max-w-xl text-body-lg text-surface-container-low">
                  Bạn duyệt từng đơn và chỉ nhận khách đã xác minh giấy phép lái xe. Nhận 50% tiền thuê ngay khi giao xe, phần còn
                  lại khi nhận lại xe.
                </p>
              </div>
              <div className="flex flex-col items-start gap-space-sm sm:flex-row lg:col-span-4 lg:flex-col lg:items-end">
                <Link
                  href="/owner/new"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-surface-container-lowest px-space-xl py-space-md text-headline-sm text-primary shadow-md transition-all hover:bg-surface-bright sm:w-auto"
                >
                  Đăng xe miễn phí
                </Link>
                <p className="flex items-center gap-1 text-label-sm text-surface-container-low">
                  <Icon name="check_circle" className="!text-[16px]" />
                  Không thu phí nền tảng
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
