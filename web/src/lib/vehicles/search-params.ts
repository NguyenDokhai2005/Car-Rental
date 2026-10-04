import { Fuel, FUELS, Transmission, TRANSMISSIONS } from "./labels";

// Bộ lọc tìm xe lưu hoàn toàn trên URL (/cars?city=...&seats=5&seats=7): chia sẻ được, tải lại không mất, công cụ tìm
// kiếm đọc được. Mọi giá trị trên URL đều do người dùng gõ nên không tin: giá trị sai bị bỏ qua (kèm thông báo nếu
// cần), không bao giờ làm hỏng trang.

export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  newest: "Mới đăng",
  price_asc: "Giá thấp đến cao",
  price_desc: "Giá cao đến thấp",
};

export const PAGE_SIZE = 12;
const MAX_RANGE_DAYS = 366;
const MAX_PAGE = 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RawParams = Record<string, string | string[] | undefined>;

export type SearchFilters = {
  city: string;
  startDate: string; // yyyy-mm-dd theo giờ Việt Nam, rỗng nếu không lọc theo ngày
  endDate: string;
  sort: Sort;
  minPrice?: number;
  maxPrice?: number;
  seats: number[];
  fuel: Fuel[];
  transmission: Transmission[];
  page: number;
};

export function vnToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function dayNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  // Date.parse sửa ngày không có thật (2026-02-31 thành 03-03): so lại để loại.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return Math.floor(ms / DAY_MS);
}

// Số ngày thuê khi nhận đầu ngày startDate và trả cuối ngày endDate (tính cả hai ngày). Khớp cách API làm tròn lên theo 24 giờ.
export function rentalDays(startDate: string, endDate: string): number | null {
  const start = dayNumber(startDate);
  const end = dayNumber(endDate);
  if (start === null || end === null || end < start) return null;
  return end - start + 1;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function list(value: string | string[] | undefined): string[] {
  const parts = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return parts.flatMap((part) => part.split(",")).map((p) => p.trim()).filter(Boolean);
}

function money(value: string | string[] | undefined): number | undefined {
  const text = first(value);
  if (!/^\d{1,9}$/.test(text)) return undefined;
  return Number(text);
}

// Thông báo cho người dùng nếu khoảng ngày không dùng được để lọc; null nếu hợp lệ.
function dateProblem(startDate: string, endDate: string, today: string): string | null {
  if (!startDate || !endDate) return "Hãy chọn cả ngày nhận và ngày trả để lọc xe còn trống.";
  const days = rentalDays(startDate, endDate);
  if (days === null) return "Ngày nhận hoặc ngày trả không hợp lệ, hoặc ngày trả đứng trước ngày nhận.";
  if (startDate < today) return "Ngày nhận đã qua. Hãy chọn ngày từ hôm nay trở đi.";
  if (days > MAX_RANGE_DAYS) return `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày.`;
  return null;
}

export function parseFilters(raw: RawParams, today: string = vnToday()): { filters: SearchFilters; notices: string[] } {
  const notices: string[] = [];

  let startDate = first(raw.startDate);
  let endDate = first(raw.endDate);
  if (startDate || endDate) {
    const problem = dateProblem(startDate, endDate, today);
    if (problem) {
      notices.push(problem);
      startDate = "";
      endDate = "";
    }
  }

  let minPrice = money(raw.minPrice);
  let maxPrice = money(raw.maxPrice);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    notices.push("Giá bắt đầu lớn hơn giá kết thúc nên đã được đổi chỗ cho nhau.");
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const sortRaw = first(raw.sort);
  const page = Number(first(raw.page));

  const filters: SearchFilters = {
    city: first(raw.city).slice(0, 100),
    startDate,
    endDate,
    sort: (SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as Sort) : "newest",
    minPrice,
    maxPrice,
    seats: [...new Set(list(raw.seats).map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 16))].slice(0, 10),
    fuel: [...new Set(list(raw.fuel).filter((f): f is Fuel => (FUELS as string[]).includes(f)))],
    transmission: [
      ...new Set(list(raw.transmission).filter((t): t is Transmission => (TRANSMISSIONS as string[]).includes(t))),
    ],
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
  return { filters, notices };
}

// Chuỗi truy vấn gửi cho API. Ngày chọn theo ngày nguyên: nhận từ 00:00 ngày nhận, trả đến hết ngày trả (giờ Việt Nam).
export function toApiQuery(filters: SearchFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.city) query.set("city", filters.city);
  if (filters.startDate && filters.endDate) {
    query.set("startAt", `${filters.startDate}T00:00:00+07:00`);
    query.set("endAt", `${filters.endDate}T23:59:59+07:00`);
  }
  if (filters.minPrice !== undefined) query.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) query.set("maxPrice", String(filters.maxPrice));
  if (filters.seats.length) query.set("seats", filters.seats.join(","));
  if (filters.fuel.length) query.set("fuel", filters.fuel.join(","));
  if (filters.transmission.length) query.set("transmission", filters.transmission.join(","));
  query.set("sort", filters.sort);
  query.set("page", String(filters.page));
  query.set("limit", String(PAGE_SIZE));
  return query;
}

// Chuỗi truy vấn cho các liên kết của chính trang web (phân trang): chỉ giữ giá trị khác mặc định.
export function toUrlQuery(filters: SearchFilters, overrides: Partial<SearchFilters> = {}): string {
  const f = { ...filters, ...overrides };
  const query = new URLSearchParams();
  if (f.city) query.set("city", f.city);
  if (f.startDate && f.endDate) {
    query.set("startDate", f.startDate);
    query.set("endDate", f.endDate);
  }
  if (f.minPrice !== undefined) query.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) query.set("maxPrice", String(f.maxPrice));
  f.seats.forEach((s) => query.append("seats", String(s)));
  f.fuel.forEach((v) => query.append("fuel", v));
  f.transmission.forEach((v) => query.append("transmission", v));
  if (f.sort !== "newest") query.set("sort", f.sort);
  if (f.page > 1) query.set("page", String(f.page));
  return query.toString();
}

// Dãy số trang hiển thị: luôn có trang đầu, trang cuối và 2 trang quanh trang hiện tại; null là dấu "...".
export function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) out.push(null);
    out.push(page);
  });
  return out;
}
