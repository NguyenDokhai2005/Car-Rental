import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";

export const metadata = { title: pageTitle("Hỗ trợ") };

const SHORTCUTS = [
  { href: "#hoan-tien", label: "Chính sách hoàn tiền" },
  { href: "#tien-coc", label: "Nhận lại tiền cọc" },
  { href: "#huy-don", label: "Hủy đơn" },
  { href: "#gplx", label: "Xác minh GPLX" },
  { href: "#chu-xe", label: "Đăng xe cho thuê" },
];

const FACTS = [
  { icon: "timer", tone: "bg-tertiary-fixed/50 text-tertiary", value: "15 phút", note: "Giữ xe chờ thanh toán" },
  { icon: "hourglass_top", tone: "bg-primary-fixed text-primary", value: "6 giờ", note: "Chủ xe phải trả lời đơn" },
  { icon: "verified_user", tone: "bg-tertiary-fixed/50 text-tertiary", value: "100%", note: "Tiền cọc hoàn khi trả xe" },
  { icon: "event_available", tone: "bg-primary-fixed text-primary", value: "48 giờ", note: "Hủy trước mốc này: hoàn đủ" },
];

const TOPICS = [
  {
    icon: "person_pin",
    tone: "bg-primary-fixed text-primary",
    link: "text-primary",
    title: "Khách thuê xe",
    note: "Từ lúc đặt xe đến khi trả xe và nhận lại tiền cọc.",
    items: [
      { href: "#thanh-toan", label: "Thanh toán tiền thuê và tiền cọc khi đặt" },
      { href: "#gplx", label: "Điều kiện giấy phép lái xe hợp lệ" },
      { href: "#giao-xe", label: "Xác nhận nhận xe và trả xe trên ứng dụng" },
      { href: "#tien-coc", label: "Khi nào tôi nhận lại tiền cọc" },
    ],
    more: { href: "/bookings", label: "Mở Đơn của tôi" },
  },
  {
    icon: "key",
    tone: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    link: "text-tertiary",
    title: "Chủ xe",
    note: "Đăng xe, quản lý lịch và nhận tiền thuê.",
    items: [
      { href: "#chu-xe", label: "Đăng xe và chờ quản trị viên duyệt" },
      { href: "#chu-xe", label: "Chặn lịch những ngày bận" },
      { href: "#duyet-don", label: "Duyệt đơn trong 6 giờ" },
      { href: "#nhan-tien", label: "Khi nào tôi nhận tiền thuê" },
    ],
    more: { href: "/owner", label: "Mở trang chủ xe" },
  },
  {
    icon: "gavel",
    tone: "bg-primary-fixed text-primary",
    link: "text-on-surface-variant",
    title: "Chính sách & An toàn",
    note: "Quyền lợi hoàn tiền và điều khoản hủy đơn.",
    items: [
      { href: "#hoan-tien", label: "Quy tắc hoàn tiền khi hủy đơn" },
      { href: "#huy-don", label: "Chủ xe từ chối hoặc không trả lời" },
      { href: "#giao-xe", label: "Vì sao cần cả hai bên xác nhận" },
      { href: "#thanh-toan", label: "Thanh toán thử nghiệm là gì" },
    ],
    more: { href: "/terms", label: "Xem điều khoản sử dụng" },
  },
];

const FAQ = [
  {
    id: "hoan-tien",
    q: "Chính sách hoàn tiền khi hủy đơn như thế nào?",
    a: "Tiền cọc luôn được hoàn đủ khi hủy. Tiền thuê hoàn 100% nếu chủ xe chưa duyệt đơn hoặc bạn hủy trước giờ nhận xe từ 48 giờ; hoàn 50% nếu hủy từ 24 đến dưới 48 giờ; không hoàn nếu hủy dưới 24 giờ.",
  },
  {
    id: "huy-don",
    q: "Chủ xe từ chối hoặc không trả lời thì sao?",
    a: "Sau khi bạn thanh toán, chủ xe có tối đa 6 giờ để duyệt. Nếu họ từ chối hoặc hết 6 giờ mà chưa trả lời, đơn tự kết thúc và bạn được hoàn toàn bộ số tiền đã trả.",
  },
  {
    id: "thanh-toan",
    q: "Tôi phải trả những khoản nào khi đặt xe?",
    a: "Bạn trả một lần gồm tiền thuê và tiền cọc (tính theo phần trăm tiền thuê do chủ xe đặt). Sau khi bấm Đặt xe, xe được giữ cho bạn 15 phút để thanh toán; quá hạn thì đơn tự hủy. Hiện đây là thanh toán thử nghiệm, không trừ tiền thật.",
  },
  {
    id: "tien-coc",
    q: "Khi nào tôi nhận lại tiền cọc?",
    a: "Tiền cọc được hoàn khi cả bạn và chủ xe cùng xác nhận trả xe trên ứng dụng. Nếu một bên chưa xác nhận, đơn tự hoàn tất sau 24 giờ kể từ giờ trả xe và tiền cọc vẫn được hoàn.",
  },
  {
    id: "giao-xe",
    q: "Xác nhận nhận xe và trả xe hoạt động ra sao?",
    a: "Lúc nhận xe, chủ xe bấm Giao xe và bạn bấm Đã nhận xe; cần đủ cả hai bên thì chuyến đi mới bắt đầu. Lúc trả xe cũng vậy: bạn bấm Đã trả xe và chủ xe xác nhận đã nhận lại. Cách này để không bên nào tự ý đổi trạng thái đơn.",
  },
  {
    id: "gplx",
    q: "Vì sao phải xác minh giấy phép lái xe?",
    a: "Chỉ tài khoản có giấy phép lái xe đã được duyệt mới đặt được xe. Trang Giấy phép lái xe cho biết trạng thái hồ sơ của bạn. Trong giai đoạn thử nghiệm, quản trị viên xác minh tài khoản trực tiếp.",
  },
  {
    id: "chu-xe",
    q: "Tôi muốn đăng xe cho thuê thì làm thế nào?",
    a: "Đăng ký tài khoản với vai trò Chủ xe, vào Đăng xe mới để nhập thông tin và ảnh xe. Xe hiển thị cho khách sau khi quản trị viên duyệt. Bạn có thể chặn những ngày bận trong trang quản lý xe.",
  },
  {
    id: "duyet-don",
    q: "Chủ xe có bao lâu để duyệt đơn?",
    a: "Tối đa 6 giờ kể từ lúc khách thanh toán. Quá hạn, đơn tự hết hạn và khách được hoàn toàn bộ.",
  },
  {
    id: "nhan-tien",
    q: "Chủ xe nhận tiền thuê vào lúc nào?",
    a: "Khi cả hai bên xác nhận giao xe, chủ xe được ghi nhận 50% tiền thuê. Phần còn lại được ghi nhận khi cả hai bên xác nhận trả xe. Nền tảng không thu phí ở giai đoạn thử nghiệm.",
  },
];

export default function SupportPage() {
  return (
    <>
      <Header active="/support" />
      <main>
        <section className="bg-gradient-to-b from-primary-fixed/60 to-transparent">
          <div className="mx-auto flex max-w-page flex-col items-center gap-space-md px-margin-sm pt-space-lg pb-space-xl text-center lg:px-margin">
            <span className="flex items-center gap-space-sm rounded-full bg-surface-container-lowest/70 px-space-md py-1 text-label-lg text-primary">
              <Icon name="support_agent" className="!text-[18px]" />
              Trung tâm Hỗ trợ
            </span>
            <h1 className="text-display text-on-surface">AutoRent VN đồng hành cùng bạn</h1>
            <p className="max-w-2xl text-body-lg text-on-surface-variant">
              Tra cứu nhanh quy trình thuê xe, thanh toán, hủy đơn và hoàn tiền. Mọi câu trả lời dưới đây đúng với cách hệ thống đang
              vận hành.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-space-sm">
              <span className="text-label-md tracking-wider text-on-surface-variant uppercase">Xem nhanh:</span>
              {SHORTCUTS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-full bg-surface-container-lowest px-space-md py-1.5 text-label-md text-on-surface shadow-sm transition-colors hover:text-primary"
                >
                  # {item.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto flex max-w-page flex-col gap-space-xl px-margin-sm pb-space-xl lg:px-margin">
          <ul className="-mt-space-lg grid gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((fact) => (
              <li key={fact.note} className="flex items-center gap-space-md">
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${fact.tone}`}>
                  <Icon name={fact.icon} />
                </span>
                <span className="flex flex-col">
                  <span className="text-title-lg text-on-surface">{fact.value}</span>
                  <span className="text-body-md text-on-surface-variant">{fact.note}</span>
                </span>
              </li>
            ))}
          </ul>

          <section className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1">
              <p className="text-label-lg tracking-wider text-primary uppercase">Cẩm nang</p>
              <h2 className="text-headline-md text-on-surface">Chủ đề hỗ trợ trọng tâm</h2>
            </div>
            <div className="grid gap-gutter md:grid-cols-3">
              {TOPICS.map((topic) => (
                <article key={topic.title} className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                  <span className={`flex size-12 items-center justify-center rounded-xl ${topic.tone}`}>
                    <Icon name={topic.icon} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-headline-sm text-on-surface">{topic.title}</h3>
                    <p className="text-body-md text-on-surface-variant">{topic.note}</p>
                  </div>
                  <ul className="flex flex-1 flex-col gap-space-sm">
                    {topic.items.map((item) => (
                      <li key={item.label}>
                        <a href={item.href} className="flex items-start gap-space-sm text-body-md text-on-surface-variant hover:text-primary">
                          <Icon name="check_circle" className="mt-0.5 !text-[18px] text-primary" />
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <Link href={topic.more.href} className={`flex items-center gap-1 text-label-lg hover:underline ${topic.link}`}>
                    {topic.more.label}
                    <Icon name="chevron_right" className="!text-[18px]" />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="grid items-center gap-gutter rounded-2xl bg-primary p-space-lg text-on-primary lg:grid-cols-2 lg:p-10">
            <div className="flex flex-col items-start gap-space-md">
              <span className="flex items-center gap-space-sm rounded-full bg-white/15 px-space-md py-1 text-label-lg">
                <Icon name="handshake" className="!text-[18px]" />
                Tránh tranh chấp khi giao xe
              </span>
              <h2 className="text-headline-lg">Cả hai bên cùng xác nhận khi giao và trả xe</h2>
              <p className="text-body-lg opacity-90">
                Hãy cùng chủ xe xem kỹ tình trạng xe trước khi bấm xác nhận. Chuyến đi chỉ bắt đầu, và tiền chỉ chuyển cho chủ xe,
                khi cả hai bên đã bấm xác nhận trên ứng dụng.
              </p>
              <Link
                href="/terms#giao-xe"
                className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest px-space-md py-space-sm text-label-lg text-primary transition-colors hover:bg-primary-fixed"
              >
                <Icon name="description" className="!text-[18px]" />
                Xem quy định giao và trả xe
              </Link>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ trong thư mục public */}
            <img src="/images/home/hero.webp" alt="" className="hidden h-64 w-full rounded-xl object-cover lg:block" />
          </section>

          <section className="mx-auto flex w-full max-w-3xl flex-col gap-space-md">
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-label-lg tracking-wider text-primary uppercase">Giải đáp</p>
              <h2 className="text-headline-lg text-on-surface">Câu hỏi thường gặp nhất</h2>
              <p className="text-body-md text-on-surface-variant">Các thắc mắc liên quan đến tiền thuê, tiền cọc và quy trình giao nhận xe.</p>
            </div>
            <div className="flex flex-col gap-space-sm">
              {FAQ.map((item, index) => (
                <details key={item.id} id={item.id} className="group scroll-mt-24 rounded-xl bg-surface-container-lowest shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center gap-space-md p-space-md [&::-webkit-details-marker]:hidden">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-label-lg text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-title-lg text-on-surface">{item.q}</span>
                    <Icon name="expand_more" className="text-on-surface-variant transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-space-md pb-space-md pl-[72px] text-body-md text-on-surface-variant">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1">
              <p className="text-label-lg tracking-wider text-primary uppercase">Liên hệ</p>
              <h2 className="text-headline-md text-on-surface">Cần hỗ trợ thêm?</h2>
            </div>
            <div className="grid gap-gutter md:grid-cols-3">
              <article className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                <Icon name="receipt_long" className="!text-[28px] text-primary" />
                <h3 className="text-title-lg text-on-surface">Vấn đề về một đơn thuê</h3>
                <p className="flex-1 text-body-md text-on-surface-variant">Mở đơn để xem tình trạng mới nhất và số tiền được hoàn.</p>
                <Link href="/bookings" className="text-label-lg text-primary hover:underline">
                  Mở Đơn của tôi
                </Link>
              </article>
              <article className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                <Icon name="lock_reset" className="!text-[28px] text-primary" />
                <h3 className="text-title-lg text-on-surface">Quên mật khẩu</h3>
                <p className="flex-1 text-body-md text-on-surface-variant">
                  Hệ thống chưa gửi được mã qua email hay tin nhắn. Quản trị viên của dự án sẽ cấp lại mật khẩu theo email bạn đã đăng
                  ký.
                </p>
              </article>
              <article className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md">
                <Icon name="science" className="!text-[28px] text-tertiary" />
                <h3 className="text-title-lg text-on-surface">Dự án thử nghiệm</h3>
                <p className="flex-1 text-body-md text-on-surface-variant">
                  AutoRent VN đang chạy thử: chưa có tổng đài hay cứu hộ, và thanh toán không trừ tiền thật.
                </p>
              </article>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
