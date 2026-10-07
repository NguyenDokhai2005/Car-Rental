import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";
import { NewVehicleForm } from "./new-vehicle-form";

export const metadata = { title: pageTitle("Đăng xe cho thuê") };

const STEPS = [
  { title: "Thông tin xe", note: "Hãng, dòng xe, biển số" },
  { title: "Ảnh xe", note: "Tối đa 10 ảnh" },
  { title: "Giá và tiền cọc", note: "Giá mỗi ngày, tỷ lệ cọc" },
  { title: "Địa điểm", note: "Thành phố, quận" },
];

const CHECKLIST = ["Điền đủ thông tin xe", "Thêm ít nhất 1 ảnh rõ nét", "Đặt giá thuê và tỷ lệ cọc", "Bấm Lưu và gửi duyệt"];

export default function NewCarPage() {
  return (
    <>
      <Header active="/owner/new" />
      <main className="mx-auto flex w-full max-w-page flex-col gap-gutter px-margin-sm py-space-lg lg:px-margin">
        <div className="flex flex-col items-start gap-space-sm">
          <span className="flex items-center gap-space-sm rounded-full bg-primary-fixed px-space-md py-1 text-label-lg text-primary">
            <Icon name="directions_car" className="!text-[18px]" />
            Thêm xe vào đội hình cho thuê
          </span>
          <h1 className="text-headline-lg text-on-surface">Đăng ký xe cho thuê mới</h1>
          <p className="max-w-2xl text-body-lg text-on-surface-variant">
            Hoàn tất các mục bên dưới để gửi xe cho quản trị viên duyệt. Sau khi được duyệt, xe hiển thị cho khách thuê.
          </p>
        </div>

        <ol className="grid gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-center gap-space-md">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-label-lg text-primary">{i + 1}</span>
              <span className="flex flex-col">
                <span className="text-label-lg text-on-surface">{step.title}</span>
                <span className="text-label-md text-on-surface-variant">{step.note}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="grid items-start gap-gutter lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <NewVehicleForm />
          </div>

          <aside className="flex flex-col gap-gutter lg:sticky lg:top-24 lg:col-span-4">
            <section className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
              <div className="flex items-center justify-between gap-space-sm">
                <h2 className="text-title-lg text-on-surface">Trạng thái đăng ký</h2>
                <span className="rounded-lg bg-primary-fixed px-space-sm py-1 text-label-md text-primary">Chờ gửi duyệt</span>
              </div>
              <ul className="flex flex-col gap-space-sm">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-center gap-space-sm text-body-md text-on-surface-variant">
                    <Icon name="check_circle" className="!text-[18px] text-tertiary" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md">
              <h2 className="flex items-center gap-space-sm text-title-lg text-on-surface">
                <span className="flex size-8 items-center justify-center rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant">
                  <Icon name="verified" className="!text-[18px]" />
                </span>
                Quy trình kiểm duyệt
              </h2>
              <p className="text-body-md text-on-surface-variant">
                Quản trị viên duyệt xong, xe mới hiển thị cho khách thuê. Mỗi lần bạn sửa thông tin hoặc đổi ảnh, xe quay về trạng thái
                chờ duyệt lại.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
