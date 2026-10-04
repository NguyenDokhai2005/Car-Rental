import Link from "next/link";
import { CarCard } from "@/components/car-card";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { FUEL_LABELS, FUELS, TRANSMISSION_LABELS, TRANSMISSIONS } from "@/lib/vehicles/labels";
import { searchVehicles, VehiclePage } from "@/lib/vehicles/public";
import {
  pageWindow,
  PAGE_SIZE,
  parseFilters,
  RawParams,
  SORT_LABELS,
  SORTS,
  toApiQuery,
  toUrlQuery,
  vnToday,
} from "@/lib/vehicles/search-params";

export const metadata = { title: "Tìm xe — Car-Rental" };

const SEAT_OPTIONS = [4, 5, 7];

const INPUT = "w-full bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-[#8a99ae]";

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] border border-line bg-surface px-3.5 py-2.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex w-full flex-col gap-2.5">
      <legend className="mb-2.5 text-[15px] font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-5 accent-primary" />
      {label}
    </label>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { filters, notices } = parseFilters(await searchParams);
  const hasDates = Boolean(filters.startDate && filters.endDate);
  const dateQuery = hasDates ? `startDate=${filters.startDate}&endDate=${filters.endDate}` : "";

  let result: VehiclePage | null = null;
  try {
    result = await searchVehicles(toApiQuery(filters));
  } catch {
    // API sập hoặc quá chậm: báo bằng câu dễ hiểu thay vì làm hỏng cả trang.
    result = null;
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const today = vnToday();

  return (
    <>
      <Header />
      {/* Toàn bộ bộ lọc nằm trong một form GET: gửi đi là URL đổi theo, nên chia sẻ và tải lại đều giữ nguyên kết quả. */}
      <form action="/cars" method="get">
        <section className="flex justify-center border-b border-line bg-white py-5">
          <div className="flex w-full max-w-page items-end gap-3">
            <FieldBox label="Địa điểm">
              <input name="city" defaultValue={filters.city} placeholder="TP. Hồ Chí Minh" maxLength={100} className={INPUT} />
            </FieldBox>
            <FieldBox label="Ngày nhận">
              <input type="date" name="startDate" defaultValue={filters.startDate} min={today} className={INPUT} />
            </FieldBox>
            <FieldBox label="Ngày trả">
              <input type="date" name="endDate" defaultValue={filters.endDate} min={today} className={INPUT} />
            </FieldBox>
            <FieldBox label="Sắp xếp">
              <select name="sort" defaultValue={filters.sort} className={INPUT}>
                {SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </FieldBox>
            <button type="submit" className="h-12 shrink-0 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white">
              Tìm xe
            </button>
          </div>
        </section>

        <main className="flex justify-center pt-8 pb-16">
          <div className="flex w-full max-w-page items-start gap-8">
            <aside className="flex w-[260px] shrink-0 flex-col gap-6 rounded-2xl border border-line bg-white p-6">
              <p className="text-xl font-bold text-ink">Bộ lọc</p>
              <Group title="Giá mỗi ngày (đồng)">
                <div className="flex flex-col gap-2">
                  <FieldBox label="Từ">
                    <input type="number" name="minPrice" min={0} step={10000} defaultValue={filters.minPrice} placeholder="300000" className={INPUT} />
                  </FieldBox>
                  <FieldBox label="Đến">
                    <input type="number" name="maxPrice" min={0} step={10000} defaultValue={filters.maxPrice} placeholder="2000000" className={INPUT} />
                  </FieldBox>
                </div>
              </Group>
              <Group title="Số chỗ ngồi">
                {SEAT_OPTIONS.map((seats) => (
                  <Check key={seats} name="seats" value={String(seats)} label={`${seats} chỗ`} checked={filters.seats.includes(seats)} />
                ))}
              </Group>
              <Group title="Nhiên liệu">
                {FUELS.map((fuel) => (
                  <Check key={fuel} name="fuel" value={fuel} label={FUEL_LABELS[fuel]} checked={filters.fuel.includes(fuel)} />
                ))}
              </Group>
              <Group title="Hộp số">
                {TRANSMISSIONS.map((t) => (
                  <Check key={t} name="transmission" value={t} label={TRANSMISSION_LABELS[t]} checked={filters.transmission.includes(t)} />
                ))}
              </Group>
              <div className="flex flex-col gap-2">
                <button type="submit" className="h-11 rounded-xl bg-primary text-[15px] font-semibold text-white">
                  Áp dụng bộ lọc
                </button>
                <Link href="/cars" className="text-center text-sm font-semibold text-primary">
                  Xóa bộ lọc
                </Link>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-[28px] font-bold text-ink">
                  {filters.city ? `Xe tại ${filters.city}` : "Tất cả xe"}
                </h1>
                {result && (
                  <p className="text-[15px] text-muted">
                    {result.total} xe{hasDates ? " còn trống trong khoảng ngày bạn chọn" : ""}
                  </p>
                )}
              </div>

              {notices.map((notice) => (
                <p key={notice} role="status" className="rounded-[10px] bg-[#fff6e5] px-3.5 py-3 text-sm text-[#8a5a00]">
                  {notice}
                </p>
              ))}

              {result === null ? (
                <p role="alert" className="rounded-2xl border border-line bg-white p-8 text-center text-[15px] text-muted">
                  Hiện chưa tải được danh sách xe. Vui lòng thử lại sau ít phút.
                </p>
              ) : result.items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-10 text-center">
                  <p className="text-[17px] font-semibold text-ink">Không tìm thấy xe phù hợp</p>
                  <p className="text-[15px] text-muted">Thử đổi ngày, mở rộng khoảng giá hoặc bỏ bớt bộ lọc.</p>
                  <Link
                    href={result.total > 0 ? `/cars?${toUrlQuery(filters, { page: 1 })}` : "/cars"}
                    className="text-[15px] font-semibold text-primary"
                  >
                    {result.total > 0 ? "Về trang đầu" : "Xóa bộ lọc"}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-[25px] gap-y-6">
                  {result.items.map((car) => (
                    <CarCard key={car.id} car={car} query={dateQuery} />
                  ))}
                </div>
              )}

              {result && totalPages > 1 && (
                <nav aria-label="Phân trang" className="flex justify-center gap-2">
                  {pageWindow(filters.page, totalPages).map((page, i) =>
                    page === null ? (
                      <span key={`gap-${i}`} className="flex size-10 items-center justify-center text-muted">
                        …
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={`/cars?${toUrlQuery(filters, { page })}`}
                        aria-current={page === filters.page ? "page" : undefined}
                        className={`flex size-10 items-center justify-center rounded-[10px] border text-[15px] font-semibold ${
                          page === filters.page
                            ? "border-primary bg-primary text-white"
                            : "border-[#c5d2e3] bg-white text-ink"
                        }`}
                      >
                        {page}
                      </Link>
                    ),
                  )}
                </nav>
              )}
            </div>
          </div>
        </main>
      </form>
      <Footer />
    </>
  );
}
