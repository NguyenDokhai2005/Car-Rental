const COLUMNS = [
  { title: "Khám phá", links: ["Tìm xe", "Điểm đến phổ biến"] },
  { title: "Chủ xe", links: ["Đăng xe", "Chính sách cho thuê"] },
  { title: "Hỗ trợ", links: ["Trung tâm trợ giúp", "Chính sách hủy và hoàn cọc"] },
];

export function Footer() {
  return (
    <footer className="flex w-full justify-center bg-ink py-14">
      <div className="flex w-full max-w-page gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-base font-bold text-white">Car-Rental</p>
          <p className="text-sm leading-[22px] text-footer-text">
            Nền tảng cho thuê xe tự lái giữa chủ xe và người thuê.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-3 whitespace-nowrap">
            <p className="text-base font-bold text-white">{col.title}</p>
            {col.links.map((link) => (
              <p key={link} className="text-sm leading-[22px] text-footer-text">
                {link}
              </p>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}
