import Image from "next/image";
import Link from "next/link";
import { CarCard } from "@/components/car-card";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { CARS } from "@/lib/cars";

export const metadata = { title: "Tìm xe — Car-Rental" };

const TOP_FIELDS = [
  { label: "Địa điểm", value: "TP. Hồ Chí Minh" },
  { label: "Ngày nhận", value: "12/10/2026" },
  { label: "Ngày trả", value: "14/10/2026" },
  { label: "Sắp xếp", value: "Giá thấp đến cao" },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] border border-line bg-surface px-3.5 py-2.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-[15px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function Check({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2.5 text-[15px] text-ink">
      <span
        className={`flex size-5 items-center justify-center rounded-[5px] border ${
          checked ? "border-primary bg-primary" : "border-[#c5d2e3] bg-white"
        }`}
      >
        {checked && <Image src="/icons/check-white-14.svg" alt="" width={14} height={14} />}
      </span>
      {label}
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children}
    </div>
  );
}

function Chip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-2 text-sm font-medium ${
        active ? "border-primary bg-primary-50 text-primary" : "border-[#c5d2e3] bg-white text-ink"
      }`}
    >
      {label}
    </span>
  );
}

export default function SearchPage() {
  return (
    <>
      <Header />
      <section className="flex justify-center border-b border-line bg-white py-5">
        <div className="flex w-full max-w-page items-end gap-3">
          {TOP_FIELDS.map((field) => (
            <Field key={field.label} {...field} />
          ))}
          <button className="h-12 shrink-0 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white">
            Cập nhật
          </button>
        </div>
      </section>
      <main className="flex justify-center pt-8 pb-16">
        <div className="flex w-full max-w-page items-start gap-8">
          <aside className="flex w-[260px] shrink-0 flex-col gap-6 rounded-2xl border border-line bg-white p-6">
            <p className="text-xl font-bold text-ink">Bộ lọc</p>
            <Group title="Giá mỗi ngày">
              <div className="flex flex-col gap-2">
                <Field label="Từ" value="300.000đ" />
                <Field label="Đến" value="2.000.000đ" />
              </div>
            </Group>
            <Group title="Số chỗ ngồi">
              <div className="flex gap-1.5">
                <Chip label="4 chỗ" />
                <Chip label="5 chỗ" active />
                <Chip label="7 chỗ" />
              </div>
            </Group>
            <Group title="Nhiên liệu">
              <Check label="Xăng" checked />
              <Check label="Dầu" />
              <Check label="Điện" />
            </Group>
            <Group title="Hộp số">
              <Check label="Số tự động" checked />
              <Check label="Số sàn" />
            </Group>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-[28px] font-bold text-ink">Xe tại TP. Hồ Chí Minh</h1>
              <p className="text-[15px] text-muted">{CARS.length} xe còn trống trong khoảng ngày bạn chọn</p>
            </div>
            <div className="flex flex-wrap gap-x-[25px] gap-y-6">
              {CARS.map((car) => (
                <CarCard key={car.id} car={car} showRating />
              ))}
            </div>
            <nav className="flex justify-center gap-2">
              {[1, 2, 3].map((page) => (
                <Link
                  key={page}
                  href="/cars"
                  className={`flex size-10 items-center justify-center rounded-[10px] border text-[15px] font-semibold ${
                    page === 1
                      ? "border-primary bg-primary text-white"
                      : "border-[#c5d2e3] bg-white text-ink"
                  }`}
                >
                  {page}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
