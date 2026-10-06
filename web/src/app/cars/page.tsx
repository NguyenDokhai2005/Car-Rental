import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";
import { FUEL_LABELS, FUELS, TRANSMISSION_LABELS, TRANSMISSIONS } from "@/lib/vehicles/labels";
import { searchVehicles, VehiclePage } from "@/lib/vehicles/public";
import {
  pageWindow,
  PAGE_SIZE,
  parseFilters,
  RawParams,
  rentalDays,
  SearchFilters,
  SORT_LABELS,
  SORTS,
  toApiQuery,
  toUrlQuery,
  vnToday,
} from "@/lib/vehicles/search-params";
import { CarResultCard } from "./car-result-card";

export const metadata = { title: pageTitle("Tìm xe") };

const SEAT_OPTIONS = [4, 5, 7];

const PILL = "flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm";
const PILL_INPUT =
  "w-full bg-transparent text-label-lg text-on-surface outline-none placeholder:font-normal placeholder:text-outline";
const PRICE_INPUT =
  "w-full rounded-lg bg-surface-container-low px-space-sm py-space-sm text-body-md text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary/30";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex w-full flex-col gap-space-sm">
      <legend className="mb-space-sm text-title-lg text-on-surface">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-space-sm text-body-md text-on-surface">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-4 rounded accent-primary" />
      {label}
    </label>
  );
}

function Chip({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="block rounded-lg bg-surface-container-low px-space-md py-1.5 text-label-md text-on-surface-variant transition-colors peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
        {label}
      </span>
    </label>
  );
}

type ActiveChip = { label: string; href: string };

function activeChips(filters: SearchFilters): ActiveChip[] {
  const without = (overrides: Partial<SearchFilters>) => `/cars?${toUrlQuery(filters, { ...overrides, page: 1 })}`;
  const short = (date: string) => date.split("-").reverse().slice(0, 2).join("/");
  const chips: ActiveChip[] = [];
  if (filters.city) chips.push({ label: filters.city, href: without({ city: "" }) });
  if (filters.startDate && filters.endDate) {
    chips.push({
      label: `${short(filters.startDate)} - ${short(filters.endDate)}`,
      href: without({ startDate: "", endDate: "" }),
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    chips.push({ label: "Khoảng giá", href: without({ minPrice: undefined, maxPrice: undefined }) });
  }
  filters.seats.forEach((seats) =>
    chips.push({ label: `${seats} chỗ`, href: without({ seats: filters.seats.filter((s) => s !== seats) }) }),
  );
  filters.fuel.forEach((fuel) =>
    chips.push({ label: FUEL_LABELS[fuel], href: without({ fuel: filters.fuel.filter((f) => f !== fuel) }) }),
  );
  filters.transmission.forEach((t) =>
    chips.push({
      label: TRANSMISSION_LABELS[t],
      href: without({ transmission: filters.transmission.filter((x) => x !== t) }),
    }),
  );
  return chips;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { filters, notices } = parseFilters(await searchParams);
  const hasDates = Boolean(filters.startDate && filters.endDate);
  const dateQuery = hasDates ? `startDate=${filters.startDate}&endDate=${filters.endDate}` : "";
  const days = hasDates ? rentalDays(filters.startDate, filters.endDate) : null;

  let result: VehiclePage | null = null;
  try {
    result = await searchVehicles(toApiQuery(filters));
  } catch {
    // API sập hoặc quá chậm: báo bằng câu dễ hiểu thay vì làm hỏng cả trang.
    result = null;
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const today = vnToday();
  const chips = activeChips(filters);

  return (
    <>
      <Header active="/cars" />
      {/* Toàn bộ bộ lọc nằm trong một form GET: gửi đi là URL đổi theo, nên chia sẻ và tải lại đều giữ nguyên kết quả. */}
      <form action="/cars" method="get">
        <section className="w-full bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex max-w-page flex-wrap items-center gap-space-md px-margin-sm py-space-md lg:px-margin">
            <label className={`${PILL} min-w-[220px] flex-1`}>
              <Icon name="near_me" className="text-primary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-label-sm text-on-surface-variant">Địa điểm</span>
                <input name="city" defaultValue={filters.city} placeholder="TP. Hồ Chí Minh" maxLength={100} className={PILL_INPUT} />
              </span>
            </label>
            <div className={`${PILL} min-w-[300px] flex-1`}>
              <Icon name="calendar_month" className="text-primary" />
              <label className="flex min-w-0 flex-1 flex-col">
                <span className="text-label-sm text-on-surface-variant">Ngày nhận</span>
                <input type="date" name="startDate" defaultValue={filters.startDate} min={today} className={PILL_INPUT} />
              </label>
              <span aria-hidden className="text-outline">
                —
              </span>
              <label className="flex min-w-0 flex-1 flex-col">
                <span className="text-label-sm text-on-surface-variant">Ngày trả</span>
                <input type="date" name="endDate" defaultValue={filters.endDate} min={today} className={PILL_INPUT} />
              </label>
            </div>
            {result && (
              <span className="flex items-center gap-1 rounded-full bg-tertiary-fixed/40 px-space-md py-1.5 text-label-md text-on-tertiary-fixed-variant">
                <Icon name="verified" filled className="!text-[16px]" />
                {result.total} xe{hasDates ? " còn trống" : ""}
              </span>
            )}
            <button
              type="submit"
              className="ml-auto flex items-center gap-space-xs rounded-xl bg-primary px-space-lg py-space-sm text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
            >
              <Icon name="search" className="!text-[18px]" />
              Tìm xe
            </button>
          </div>
        </section>

        <main className="mx-auto max-w-page px-margin-sm pt-space-lg pb-space-xl lg:px-margin">
          <div className="flex flex-col items-start gap-gutter lg:flex-row">
            <aside className="flex w-full shrink-0 flex-col gap-space-lg rounded-2xl bg-surface-container-lowest p-space-md shadow-sm lg:sticky lg:top-24 lg:w-[280px]">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-space-sm text-headline-sm text-on-surface">
                  <Icon name="filter_list" />
                  Bộ lọc tìm kiếm
                </p>
                <Link href="/cars" className="text-label-md text-primary hover:underline">
                  Thiết lập lại
                </Link>
              </div>

              <label className="flex flex-col gap-space-sm">
                <span className="text-title-lg text-on-surface">Sắp xếp theo</span>
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  className="w-full rounded-lg bg-surface-container-low px-space-sm py-space-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                      {SORT_LABELS[sort]}
                    </option>
                  ))}
                </select>
              </label>

              <Group title="Giá thuê 1 ngày (đồng)">
                <div className="flex items-center gap-space-sm">
                  <input
                    type="number"
                    name="minPrice"
                    min={0}
                    step={10000}
                    defaultValue={filters.minPrice}
                    placeholder="Từ"
                    aria-label="Giá từ"
                    className={PRICE_INPUT}
                  />
                  <span aria-hidden className="text-outline">
                    —
                  </span>
                  <input
                    type="number"
                    name="maxPrice"
                    min={0}
                    step={10000}
                    defaultValue={filters.maxPrice}
                    placeholder="Đến"
                    aria-label="Giá đến"
                    className={PRICE_INPUT}
                  />
                </div>
              </Group>

              <Group title="Số chỗ ngồi">
                {SEAT_OPTIONS.map((seats) => (
                  <Check key={seats} name="seats" value={String(seats)} label={`${seats} chỗ`} checked={filters.seats.includes(seats)} />
                ))}
              </Group>

              <Group title="Truyền động & Nhiên liệu">
                <div className="flex flex-wrap gap-space-sm">
                  {TRANSMISSIONS.map((t) => (
                    <Chip key={t} name="transmission" value={t} label={TRANSMISSION_LABELS[t]} checked={filters.transmission.includes(t)} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-space-sm">
                  {FUELS.map((fuel) => (
                    <Chip key={fuel} name="fuel" value={fuel} label={FUEL_LABELS[fuel]} checked={filters.fuel.includes(fuel)} />
                  ))}
                </div>
              </Group>

              <button
                type="submit"
                className="rounded-xl bg-primary py-space-sm text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
              >
                Áp dụng bộ lọc
              </button>
            </aside>

            <div className="flex w-full min-w-0 flex-1 flex-col gap-space-md">
              <div className="flex flex-wrap items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm">
                <h1 className="mr-auto text-label-lg text-on-surface">
                  {filters.city ? `Thuê xe tự lái tại ${filters.city}` : "Thuê xe tự lái"}
                  {result ? ` · ${result.total} xe` : ""}
                </h1>
                {chips.length > 0 && <span className="text-label-md text-on-surface-variant">Bộ lọc đang chọn:</span>}
                {chips.map((chip) => (
                  <Link
                    key={chip.href}
                    href={chip.href}
                    aria-label={`Bỏ lọc ${chip.label}`}
                    className="flex items-center gap-1 rounded-full bg-surface-container-lowest px-space-sm py-1 text-label-md text-primary shadow-sm transition-colors hover:bg-primary-fixed"
                  >
                    {chip.label}
                    <Icon name="close" className="!text-[14px]" />
                  </Link>
                ))}
                {chips.length > 0 && (
                  <Link href="/cars" className="text-label-md text-error hover:underline">
                    Xóa tất cả
                  </Link>
                )}
              </div>

              {notices.map((notice) => (
                <p key={notice} role="status" className="rounded-xl bg-warning-container px-space-md py-space-sm text-body-md text-warning">
                  {notice}
                </p>
              ))}

              {result === null ? (
                <p role="alert" className="rounded-2xl bg-surface-container-lowest p-space-xl text-center text-body-lg text-on-surface-variant shadow-sm">
                  Hiện chưa tải được danh sách xe. Vui lòng thử lại sau ít phút.
                </p>
              ) : result.items.length === 0 ? (
                <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
                  <Icon name="search_off" className="!text-[40px] text-outline" />
                  <p className="text-title-lg text-on-surface">Không có xe phù hợp</p>
                  <p className="text-body-md text-on-surface-variant">Thử đổi ngày hoặc bỏ bớt bộ lọc.</p>
                  <Link
                    href={result.total > 0 ? `/cars?${toUrlQuery(filters, { page: 1 })}` : "/cars"}
                    className="text-label-lg text-primary hover:underline"
                  >
                    {result.total > 0 ? "Về trang đầu" : "Xóa bộ lọc"}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                  {result.items.map((car) => (
                    <CarResultCard key={car.id} car={car} query={dateQuery} days={days} />
                  ))}
                </div>
              )}

              {result && totalPages > 1 && (
                <nav aria-label="Phân trang" className="flex items-center gap-space-sm">
                  <span className="mr-1 text-label-md text-on-surface-variant">Trang</span>
                  {pageWindow(filters.page, totalPages).map((page, i) =>
                    page === null ? (
                      <span key={`gap-${i}`} className="flex size-9 items-center justify-center text-outline">
                        …
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={`/cars?${toUrlQuery(filters, { page })}`}
                        aria-current={page === filters.page ? "page" : undefined}
                        className={`flex size-9 items-center justify-center rounded-lg text-label-lg transition-colors ${
                          page === filters.page
                            ? "bg-primary text-on-primary shadow-sm"
                            : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        {page}
                      </Link>
                    ),
                  )}
                </nav>
              )}

              <div className="flex flex-wrap items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-tertiary shadow-sm">
                  <Icon name="verified_user" filled className="!text-[26px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-title-lg text-on-surface">Tiền của bạn được giữ hộ</p>
                  <p className="text-body-md text-on-surface-variant">
                    Trả tiền thuê và tiền cọc một lần khi đặt. Chủ xe chỉ nhận tiền khi cả hai bên xác nhận giao xe, và tiền cọc
                    được hoàn khi trả xe.
                  </p>
                </div>
                <Link
                  href="/terms"
                  className="rounded-xl bg-surface-container-lowest px-space-md py-space-sm text-label-lg text-on-surface shadow-sm transition-colors hover:bg-surface-bright"
                >
                  Tìm hiểu chi tiết
                </Link>
              </div>
            </div>
          </div>
        </main>
      </form>
      <Footer />
    </>
  );
}
