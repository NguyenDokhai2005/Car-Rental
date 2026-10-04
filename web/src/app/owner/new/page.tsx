import { Header } from "@/components/header";
import { NewVehicleForm } from "./new-vehicle-form";

export const metadata = { title: "Đăng xe của bạn — Car-Rental" };

const STEPS = [
  "Thông tin xe",
  "Ảnh xe",
  "Giá và đặt cọc",
  "Địa điểm nhận xe",
  "Xem lại và gửi duyệt",
];

export default function NewCarPage() {
  return (
    <>
      <Header active="/owner/new" />
      <main className="flex justify-center pt-10 pb-14">
        <div className="flex w-full max-w-page items-start gap-10">
          <ol className="flex w-[240px] shrink-0 flex-col gap-1">
            {STEPS.map((label, i) => {
              const active = i === 0;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-3 rounded-[10px] px-3.5 py-3 text-[15px] font-semibold ${
                    active ? "bg-primary-50 text-primary" : "text-muted"
                  }`}
                >
                  <span
                    className={`flex size-[26px] items-center justify-center rounded-full border-2 text-xs font-bold ${
                      active ? "border-primary bg-primary text-white" : "border-[#c5d2e3] text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>

          <NewVehicleForm />
        </div>
      </main>
    </>
  );
}
