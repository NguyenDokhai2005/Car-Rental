import Link from "next/link";
import { Header } from "@/components/header";
import { StatusPill } from "@/components/status-pill";
import { formatVnd } from "@/lib/cars";
import { OwnerRequests } from "./owner-requests";

export const metadata = { title: "Quản lý xe và đơn thuê — Car-Rental" };

const STATS = [
  { label: "Đơn chờ bạn duyệt", value: 2, accent: true },
  { label: "Xe đang hiển thị", value: 3, accent: false },
  { label: "Xe chờ quản trị viên duyệt", value: 1, accent: false },
];

const MY_CARS = [
  { name: "Toyota Vios 2022", price: 650000, tone: "info", status: "Đang hiển thị" },
  { name: "Mazda CX-5 2021", price: 1200000, tone: "info", status: "Đang hiển thị" },
  { name: "Hyundai Accent 2023", price: 600000, tone: "info", status: "Chờ duyệt" },
] as const;

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const BOOKED_DAYS = new Set([12, 13, 14, 20, 21]);
const BLOCKED_DAYS = new Set([26, 27]);
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

function dayClass(day: number) {
  if (BOOKED_DAYS.has(day)) return "bg-primary text-white";
  if (BLOCKED_DAYS.has(day)) return "bg-[#c5d2e3] text-ink";
  return "bg-surface text-ink";
}

export default function OwnerDashboardPage() {
  return (
    <>
      <Header active="/owner" />
      <main className="flex justify-center pt-10 pb-14">
        <div className="flex w-full max-w-page flex-col gap-8">
          <div className="flex items-center justify-between">
            <h1 className="text-[32px] font-bold text-ink">Quản lý xe và đơn thuê</h1>
            <Link
              href="/owner/new"
              className="flex h-12 items-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-white"
            >
              Đăng xe mới
            </Link>
          </div>

          <div className="flex gap-5">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl border border-line bg-white p-6"
              >
                <span className="text-sm text-muted">{s.label}</span>
                <span className={`text-4xl font-bold ${s.accent ? "text-primary" : "text-ink"}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <OwnerRequests />

          <div className="flex items-start gap-6">
            <section className="flex min-w-0 flex-1 flex-col gap-4">
              <h2 className="text-2xl font-bold text-ink">Xe của tôi</h2>
              {MY_CARS.map((car) => (
                <article
                  key={car.name}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4"
                >
                  <div className="flex h-20 w-[120px] shrink-0 items-center justify-center rounded-[10px] bg-placeholder text-xs font-medium text-primary">
                    [Ảnh xe]
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="text-xl font-semibold text-ink">{car.name}</h3>
                    <p className="text-base text-muted">{formatVnd(car.price)} mỗi ngày</p>
                  </div>
                  <StatusPill tone={car.tone}>{car.status}</StatusPill>
                </article>
              ))}
            </section>

            <section className="flex w-[440px] shrink-0 flex-col gap-4">
              <h2 className="text-2xl font-bold text-ink">Lịch xe tháng 10</h2>
              <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
                <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted">
                  {WEEKDAYS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <span
                      key={day}
                      className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium ${dayClass(day)}`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4 text-[13px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <i className="size-3 rounded-sm bg-primary" /> Đã có đơn
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="size-3 rounded-sm bg-[#c5d2e3]" /> Bạn chặn ngày
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
