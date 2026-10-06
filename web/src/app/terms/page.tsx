import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Điều khoản & Chính sách hủy, hoàn tiền"),
  description: "Cách đặt xe, thanh toán, hủy đơn, hoàn tiền, giao xe và trả xe trên AutoRent VN.",
};

const FACTS = [
  { icon: "timer", label: "Giữ chỗ", value: "15 phút" },
  { icon: "how_to_reg", label: "Chủ xe duyệt", value: "Tối đa 6 giờ" },
  { icon: "savings", label: "Tiền cọc", value: "Hoàn khi trả xe" },
  { icon: "percent", label: "Phí nền tảng", value: "0 đ" },
];

const SECTIONS = [
  { id: "dinh-nghia", no: "01", title: "Định nghĩa & Phạm vi áp dụng" },
  { id: "khach-thue", no: "02", title: "Điều kiện khách thuê" },
  { id: "dat-xe", no: "03", title: "Đặt xe và thanh toán" },
  { id: "huy-don", no: "04", title: "Hủy đơn & Hoàn tiền" },
  { id: "giao-xe", no: "05", title: "Giao xe và trả xe" },
];

// Bảng hoàn tiền khi hủy. Số liệu phải khớp api/src/bookings/booking-rules.ts (cancelSettlement) và SPEC §4.
const CANCEL_ROWS = [
  { when: "Chủ xe chưa duyệt, hoặc hủy trước từ 48 giờ", rental: "100%", owner: "Không nhận khoản nào" },
  { when: "Hủy từ 24 đến dưới 48 giờ", rental: "50%", owner: "50% tiền thuê" },
  { when: "Hủy dưới 24 giờ", rental: "0%", owner: "Toàn bộ tiền thuê" },
  { when: "Chủ xe từ chối hoặc không trả lời trong 6 giờ", rental: "100%", owner: "Không nhận khoản nào" },
];

function Section({ id, no, title, tag, children }: { id: string; no: string; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-line bg-white p-6 shadow-card lg:p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-lg bg-surface-low px-3 py-1 text-xs font-semibold tracking-[0.02em] text-primary-strong">Mục {no}</span>
        {tag && <span className="text-xs font-semibold text-outline">{tag}</span>}
      </div>
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-on-surface">{title}</h2>
      <div className="flex flex-col gap-4 text-base leading-6 text-on-surface-variant">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-page flex-col gap-8 px-4 pt-8 pb-16 lg:px-8">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold tracking-[0.08em] text-primary-strong">ĐIỀU KHOẢN SỬ DỤNG</span>
          <h1 className="text-[32px] leading-10 font-bold tracking-tight text-on-surface">Điều khoản dịch vụ & Chính sách hủy, hoàn tiền</h1>
          <p className="max-w-3xl text-base leading-6 text-on-surface-variant">
            Cập nhật tháng 10/2026. Đây là dự án thử nghiệm, thanh toán ở chế độ thử và không trừ tiền thật. Vui lòng đọc kỹ trước
            khi đặt xe.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.label} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-low text-primary-strong">
                <Icon name={fact.icon} />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-outline">{fact.label}</span>
                <span className="text-base font-semibold text-on-surface">{fact.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-28 lg:w-[300px]">
            <nav aria-label="Mục lục" className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-base font-semibold text-on-surface">Mục lục</span>
                <span className="rounded-full bg-surface-low px-2.5 py-0.5 text-[11px] font-medium text-on-surface-variant">5 mục</span>
              </div>
              <ul className="flex flex-col gap-1">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                    >
                      <span className="text-xs font-semibold text-outline">{section.no}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="rounded-2xl bg-surface-low p-4">
              <div className="mb-2 flex items-center gap-2 text-base font-semibold text-on-surface">
                <Icon name="shield_lock" className="text-primary-strong" />
                Tiền được giữ hộ
              </div>
              <p className="text-sm leading-5 text-on-surface-variant">
                Chúng tôi giữ khoản thanh toán của bạn. Chủ xe chỉ nhận tiền khi cả hai bên xác nhận giao xe trên ứng dụng.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-success-container px-3 py-1 text-xs font-semibold text-success">
                <Icon name="check_circle" filled className="!text-[14px]" />
                Tiền cọc luôn được hoàn
              </span>
            </div>
            <Link href="/support" className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 text-sm font-semibold text-on-surface shadow-card">
              Cần hỗ trợ?
              <span className="flex items-center gap-1 text-primary-strong">
                Trung tâm hỗ trợ <Icon name="arrow_forward" className="!text-[16px]" />
              </span>
            </Link>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <Section id="dinh-nghia" no="01" title="1. Định nghĩa & Phạm vi áp dụng">
              <p>
                Điều khoản này quy định quyền và nghĩa vụ giữa <strong className="text-on-surface">AutoRent VN</strong> (nền tảng),{" "}
                <strong className="text-on-surface">Chủ xe</strong> (người đăng xe cho thuê) và{" "}
                <strong className="text-on-surface">Khách thuê</strong> (người đặt thuê xe tự lái).
              </p>
              <ul className="flex list-disc flex-col gap-2 pl-5">
                <li>
                  <strong className="text-on-surface">Nền tảng AutoRent:</strong> website trung gian kết nối khách thuê và chủ xe, không sở
                  hữu xe.
                </li>
                <li>
                  <strong className="text-on-surface">Đơn thuê:</strong> yêu cầu thuê xe do khách tạo trên hệ thống, có hiệu lực khi khách đã
                  thanh toán và chủ xe đã duyệt.
                </li>
              </ul>
            </Section>

            <Section id="khach-thue" no="02" title="2. Điều kiện khách thuê" tag="Xác minh thủ công">
              <p>Khách thuê phải được xác minh giấy phép lái xe trước khi đặt xe.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { icon: "badge", title: "Giấy phép lái xe", text: "Còn hiệu lực, phù hợp loại xe thuê." },
                  { icon: "photo_camera", title: "Ảnh giấy phép", text: "Tải ảnh mặt trước rõ nét để quản trị viên duyệt." },
                  { icon: "person_check", title: "Tài khoản", text: "Không bị khóa do vi phạm điều khoản." },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl bg-surface-low p-4">
                    <Icon name={item.icon} className="mb-2 text-primary-strong" />
                    <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                    <p className="text-sm leading-5">{item.text}</p>
                  </div>
                ))}
              </div>
              <Link href="/verify-license" className="w-fit text-sm font-semibold text-primary-strong hover:underline">
                Xác minh giấy phép lái xe của bạn
              </Link>
            </Section>

            <Section id="dat-xe" no="03" title="3. Đặt xe và thanh toán" tag="Giữ chỗ 15 phút">
              <p>
                Sau khi bấm Đặt xe, xe được giữ cho bạn 15 phút để thanh toán. Bạn trả một lần gồm tiền thuê và tiền cọc. Tiền cọc tính
                theo tỷ lệ do chủ xe đặt và được hoàn khi trả xe.
              </p>
              <p>
                Quá 15 phút chưa thanh toán, đơn tự hủy và xe mở lại cho người khác. Sau khi bạn thanh toán, chủ xe có tối đa 6 giờ để
                duyệt; nếu họ từ chối hoặc không trả lời, bạn được hoàn 100%.
              </p>
              <p>Số ngày thuê được tính tròn theo từng 24 giờ: 60 giờ thuê là 3 ngày.</p>
            </Section>

            <Section id="huy-don" no="04" title="4. Hủy đơn & Hoàn tiền" tag="Quan trọng">
              <div className="flex items-center gap-2 rounded-xl bg-success-container px-4 py-3 text-sm font-semibold text-success">
                <Icon name="verified" filled />
                Tiền cọc luôn được hoàn, dù bạn hủy lúc nào.
              </div>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-surface-low text-xs font-semibold tracking-[0.02em] text-on-surface-variant">
                    <tr>
                      <th scope="col" className="px-4 py-3">Thời điểm hủy</th>
                      <th scope="col" className="px-4 py-3">Tiền thuê được hoàn</th>
                      <th scope="col" className="px-4 py-3">Chủ xe nhận</th>
                      <th scope="col" className="px-4 py-3">Tiền cọc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANCEL_ROWS.map((row) => (
                      <tr key={row.when} className="border-t border-line">
                        <td className="px-4 py-3 font-medium text-on-surface">{row.when}</td>
                        <td className="px-4 py-3 font-semibold text-on-surface">{row.rental}</td>
                        <td className="px-4 py-3">{row.owner}</td>
                        <td className="px-4 py-3 font-semibold text-success">Hoàn 100%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Thời điểm hủy tính theo số giờ còn lại tới giờ nhận xe ghi trên đơn.</p>
            </Section>

            <Section id="giao-xe" no="05" title="5. Giao xe và trả xe" tag="Hai bên cùng xác nhận">
              <p>Không cần thế chấp tiền mặt hay tài sản. Mỗi bước cần cả khách và chủ xe xác nhận trên ứng dụng.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-line p-4">
                  <span className="text-xs font-semibold tracking-[0.08em] text-primary-strong">GIAO XE</span>
                  <p className="mt-1 text-base font-semibold text-on-surface">Chủ xe bấm Giao xe, khách bấm Đã nhận xe</p>
                  <p className="mt-1 text-sm leading-5">Khi đủ cả hai, chuyến đi bắt đầu và chủ xe nhận 50% tiền thuê.</p>
                </div>
                <div className="rounded-xl border border-line p-4">
                  <span className="text-xs font-semibold tracking-[0.08em] text-primary-strong">TRẢ XE</span>
                  <p className="mt-1 text-base font-semibold text-on-surface">Khách bấm Đã trả xe, chủ xe bấm Đã nhận lại xe</p>
                  <p className="mt-1 text-sm leading-5">
                    Khi đủ cả hai, chủ xe nhận phần còn lại và khách được hoàn tiền cọc. Nếu quá 24 giờ sau giờ trả xe mà chưa đủ xác
                    nhận, đơn tự hoàn tất.
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
