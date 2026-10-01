import Link from "next/link";
import { HeaderLoggedIn } from "@/components/header";
import { UploadIcon } from "@/components/icons";

export const metadata = { title: "Đăng xe của bạn — Car-Rental" };

const STEPS = [
  "Thông tin xe",
  "Ảnh xe",
  "Giá và đặt cọc",
  "Địa điểm nhận xe",
  "Xem lại và gửi duyệt",
];

type FieldProps = {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  list?: string;
};

function Field({ name, label, placeholder, type = "text", list }: FieldProps) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        name={name}
        type={type}
        list={list}
        placeholder={placeholder}
        className="h-12 w-full rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 text-[15px] placeholder:text-[#8a99ae]"
      />
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-7">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function NewCarPage() {
  return (
    <>
      <HeaderLoggedIn variant="owner" active="/owner/new" />
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

          <form action="/owner" className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-[34px] font-bold text-ink">Đăng xe của bạn</h1>
              <p className="text-base text-muted">
                Xe sẽ được quản trị viên duyệt trước khi hiển thị cho người thuê.
              </p>
            </div>

            <Card title="1. Thông tin xe">
              <div className="flex gap-4">
                <Field name="brand" label="Hãng xe" placeholder="Toyota" />
                <Field name="model" label="Mẫu xe" placeholder="Vios" />
                <Field name="year" label="Năm sản xuất" placeholder="2022" type="number" />
              </div>
              <div className="flex gap-4">
                <Field name="seats" label="Số chỗ ngồi" placeholder="5" type="number" />
                <Field name="transmission" label="Hộp số" placeholder="Số tự động" list="transmissions" />
                <Field name="fuel" label="Nhiên liệu" placeholder="Xăng" list="fuels" />
              </div>
              <datalist id="transmissions">
                <option value="Số tự động" />
                <option value="Số sàn" />
              </datalist>
              <datalist id="fuels">
                <option value="Xăng" />
                <option value="Dầu" />
                <option value="Điện" />
              </datalist>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink">Mô tả</span>
                <textarea
                  name="description"
                  placeholder="Tình trạng xe, quy định về quãng đường và nhiên liệu..."
                  className="h-[120px] resize-none rounded-[10px] border border-[#c5d2e3] bg-white p-3.5 text-[15px] placeholder:text-[#8a99ae]"
                />
              </label>
            </Card>

            <Card title="2. Ảnh xe">
              <div className="flex gap-3">
                <label className="flex h-40 w-[420px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#9db6dd] bg-surface text-primary">
                  <UploadIcon />
                  <span className="text-[15px] font-semibold">Tải ảnh lên</span>
                  <span className="text-[13px] text-muted">Ảnh đầu tiên là ảnh bìa</span>
                  <input type="file" name="photos" accept="image/jpeg,image/png" multiple className="sr-only" />
                </label>
                {["[Ảnh 2]", "[Ảnh 3]"].map((label) => (
                  <div
                    key={label}
                    className="flex h-40 min-w-0 flex-1 items-center justify-center rounded-xl bg-placeholder text-[13px] font-medium text-primary"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="3. Giá và đặt cọc">
              <div className="flex gap-4">
                <Field name="pricePerDay" label="Giá mỗi ngày (đồng)" placeholder="650000" type="number" />
                <Field name="deposit" label="Tiền cọc (đồng)" placeholder="[Tiền cọc]" type="number" />
              </div>
            </Card>

            <Card title="4. Địa điểm nhận xe">
              <div className="flex gap-4">
                <Field name="city" label="Thành phố" placeholder="TP. Hồ Chí Minh" />
                <Field name="district" label="Quận hoặc huyện" placeholder="Quận 7" />
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Link
                href="/owner"
                className="flex h-13 items-center rounded-xl border border-[#c5d2e3] bg-white px-7 text-base font-semibold text-ink"
              >
                Lưu nháp
              </Link>
              <button
                type="submit"
                className="h-13 rounded-xl bg-primary px-7 text-base font-semibold text-white"
              >
                Gửi duyệt
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
