"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { formatVnd, type Car } from "@/lib/cars";

const RENTAL_DAYS = 2;

const METHODS = [
  { id: "vnpay", name: "VNPay", note: "Thẻ ATM nội địa, QR" },
  { id: "momo", name: "MoMo", note: "Ví điện tử" },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        placeholder={placeholder}
        className="h-12 w-full rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 text-[15px] text-ink placeholder:text-[#8a99ae]"
      />
    </label>
  );
}

function Step({ index, label, state }: { index: number; label: string; state: "done" | "active" | "todo" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex size-7 items-center justify-center rounded-full border-2 text-[13px] font-bold ${
          state === "todo" ? "border-[#c5d2e3] bg-white text-muted" : "border-primary bg-primary text-white"
        }`}
      >
        {state === "done" ? <Image src="/icons/check-white-16.svg" alt="" width={16} height={16} /> : index}
      </span>
      <span className={`text-[15px] ${state === "todo" ? "font-medium text-muted" : "font-semibold text-ink"}`}>
        {label}
      </span>
    </div>
  );
}

function Line() {
  return <span className="h-0.5 w-16 bg-[#c5d2e3]" />;
}

export function CheckoutView({ car }: { car: Car }) {
  const [method, setMethod] = useState("vnpay");
  const [agreed, setAgreed] = useState(false);
  const subtotal = car.pricePerDay * RENTAL_DAYS;

  const rows = [
    { label: "Nhận xe", value: "12/10/2026, 09:00" },
    { label: "Trả xe", value: "14/10/2026, 09:00" },
  ];

  return (
    <>
      <Header />
      <main className="flex justify-center pt-8 pb-16">
        <div className="flex w-full max-w-page flex-col gap-7">
          <div className="flex items-center justify-center gap-3">
            <Step index={1} label="Chọn xe" state="done" />
            <Line />
            <Step index={2} label="Thanh toán" state="active" />
            <Line />
            <Step index={3} label="Xác nhận" state="todo" />
          </div>

          <div className="flex items-start gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <div className="flex items-center gap-3 rounded-xl border border-[#f5c877] bg-[#fff6e5] px-[18px] py-3.5">
                <Image src="/icons/clock-22.svg" alt="" width={22} height={22} />
                <p className="flex-1 text-sm leading-[22px] font-medium text-[#5c3b00]">
                  Xe được giữ cho bạn trong 14:32. Hết thời gian, đơn sẽ tự hủy và xe mở lại cho người khác.
                </p>
              </div>

              <Card title="Thông tin người thuê">
                <div className="flex gap-4">
                  <Input label="Họ và tên" placeholder="[Họ và tên]" />
                  <Input label="Số điện thoại" placeholder="[Số điện thoại]" />
                </div>
                <div className="flex w-fit items-center gap-2 rounded-[10px] bg-[#e8f6ee] px-3.5 py-2.5">
                  <Image src="/icons/shield-check-18.svg" alt="" width={18} height={18} />
                  <span className="text-sm font-semibold text-[#137a43]">
                    Giấy phép lái xe đã được xác minh
                  </span>
                </div>
              </Card>

              <Card title="Phương thức thanh toán">
                {METHODS.map((m) => {
                  const selected = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3.5 rounded-xl p-4 text-left ${
                        selected ? "border-2 border-primary bg-primary-50" : "border border-[#c5d2e3] bg-white"
                      }`}
                    >
                      <span
                        className={`size-5 rounded-full bg-white ${
                          selected ? "border-[6px] border-primary" : "border-2 border-[#c5d2e3]"
                        }`}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-base font-semibold text-ink">{m.name}</span>
                        <span className="text-[13px] text-muted">{m.note}</span>
                      </span>
                    </button>
                  );
                })}
                <p className="text-[13px] text-muted">Đây là môi trường thanh toán thử nghiệm, không trừ tiền thật.</p>
              </Card>

              <label className="flex items-start gap-3 text-sm leading-[22px] text-ink">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-px size-5 shrink-0 accent-primary"
                />
                Tôi đã đọc và đồng ý với điều khoản thuê xe và chính sách hủy, hoàn cọc.
              </label>
            </div>

            <aside className="flex w-[400px] shrink-0 flex-col gap-4 rounded-2xl border border-line bg-white p-6">
              <div className="flex items-center gap-3.5">
                <div className="flex h-[68px] w-24 items-center justify-center rounded-[10px] bg-placeholder text-[11px] font-medium text-primary">
                  [Ảnh xe]
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[17px] font-semibold text-ink">{car.name}</p>
                  <p className="text-[13px] text-muted">
                    {car.district}, {car.city}
                  </p>
                </div>
              </div>
              <hr className="border-line" />
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between text-[15px]">
                  <span className="text-muted">{row.label}</span>
                  <span className="font-semibold text-ink">{row.value}</span>
                </div>
              ))}
              <hr className="border-line" />
              <div className="flex justify-between text-[15px]">
                <span className="text-muted">
                  {formatVnd(car.pricePerDay)} x {RENTAL_DAYS} ngày
                </span>
                <span className="font-semibold text-ink">{formatVnd(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[15px]">
                <span className="text-muted">Phí dịch vụ</span>
                <span className="font-semibold text-ink">[Phí]</span>
              </div>
              <div className="flex justify-between text-[15px]">
                <span className="text-muted">Tiền cọc (hoàn lại sau khi trả xe)</span>
                <span className="font-semibold text-ink">[Tiền cọc]</span>
              </div>
              <hr className="border-line" />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-ink">Cần thanh toán</span>
                <span className="text-primary">[Tổng]</span>
              </div>
              <Link
                href="/bookings"
                aria-disabled={!agreed}
                tabIndex={agreed ? undefined : -1}
                className={`flex h-[52px] items-center justify-center rounded-xl bg-primary text-base font-semibold text-white ${
                  agreed ? "" : "pointer-events-none opacity-50"
                }`}
              >
                Thanh toán
              </Link>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
