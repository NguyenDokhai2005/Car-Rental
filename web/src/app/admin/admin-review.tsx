"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";

type Submission = { id: string; carName: string; owner: string; sentAt: string; location: string };

// Dữ liệu mẫu theo thiết kế; thay bằng dữ liệu từ API duyệt xe khi có.
const INITIAL: Submission[] = [
  { id: "s1", carName: "Toyota Vios 2022", owner: "[Tên chủ xe]", sentAt: "01/10/2026", location: "Quận 7" },
  { id: "s2", carName: "Hyundai Accent 2023", owner: "[Tên chủ xe]", sentAt: "30/09/2026", location: "Quận 1" },
  { id: "s3", carName: "Kia Seltos 2022", owner: "[Tên chủ xe]", sentAt: "29/09/2026", location: "Quận 10" },
];

const CHECKLIST = [
  "Ảnh rõ, đúng xe",
  "Thông tin xe đầy đủ",
  "Giá thuê hợp lý",
  "Mô tả không vi phạm quy định",
];

const ROW_GRID = "grid grid-cols-[286px_196px_1fr] items-center px-6";

export function AdminReview() {
  const [items, setItems] = useState(INITIAL);
  const [selectedId, setSelectedId] = useState("s2");
  const [checked, setChecked] = useState<boolean[]>([true, true, false, false]);
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<"cars" | "licenses">("cars");

  const selected = items.find((i) => i.id === selectedId) ?? items[0];

  function select(id: string) {
    setSelectedId(id);
    setChecked([false, false, false, false]);
    setReason("");
  }

  function resolve() {
    if (!selected) return;
    const rest = items.filter((i) => i.id !== selected.id);
    setItems(rest);
    setChecked([false, false, false, false]);
    setReason("");
    if (rest[0]) setSelectedId(rest[0].id);
  }

  const tabs = [
    { id: "cars" as const, label: `Xe chờ duyệt (${items.length})` },
    { id: "licenses" as const, label: "Giấy phép lái xe chờ xác minh (2)" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-[32px] font-bold text-ink">Duyệt xe và người dùng</h1>

      <div role="tablist" className="flex gap-2 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-5 py-3.5 text-base font-semibold ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "licenses" ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-[15px] text-muted">
          Danh sách giấy phép lái xe chờ xác minh sẽ hiển thị ở đây.
        </p>
      ) : (
        <div className="flex items-start gap-7">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
            <div className={`${ROW_GRID} h-[45px] bg-surface text-[13px] font-semibold text-muted`}>
              <span>Xe</span>
              <span>Chủ xe</span>
              <span>Ngày gửi</span>
            </div>
            {items.length === 0 && (
              <p className="px-6 py-8 text-center text-[15px] text-muted">Không còn xe nào chờ duyệt.</p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                aria-pressed={item.id === selected?.id}
                className={`${ROW_GRID} h-[89px] w-full border-t border-line text-left ${
                  item.id === selected?.id ? "bg-primary-50" : "bg-white"
                }`}
              >
                <span className="flex items-center gap-3.5">
                  <span className="flex h-[52px] w-[72px] shrink-0 items-center justify-center rounded-[10px] bg-placeholder text-[11px] font-medium text-primary">
                    [Ảnh]
                  </span>
                  <span className="text-base font-semibold text-ink">{item.carName}</span>
                </span>
                <span className="text-base text-ink">{item.owner}</span>
                <span className="text-base text-muted">{item.sentAt}</span>
              </button>
            ))}
          </div>

          {selected && (
            <aside className="flex w-[420px] shrink-0 flex-col gap-4 rounded-2xl border border-line bg-white p-6">
              <div className="flex h-[200px] items-center justify-center rounded-xl bg-placeholder text-base font-medium text-primary">
                [Ảnh xe đang xem]
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-[22px] font-bold text-ink">{selected.carName}</h2>
                <p className="text-sm text-muted">
                  Chủ xe: {selected.owner} - {selected.location}, TP. Hồ Chí Minh
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="text-[15px] font-semibold text-ink">Danh sách kiểm tra</p>
                {CHECKLIST.map((label, i) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                      className="sr-only"
                    />
                    <span
                      className={`flex size-5 items-center justify-center rounded-[5px] border text-white ${
                        checked[i] ? "border-primary bg-primary" : "border-[#c5d2e3] bg-white"
                      }`}
                    >
                      {checked[i] && <CheckIcon />}
                    </span>
                    {label}
                  </label>
                ))}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink">Lý do từ chối (nếu có)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ghi rõ để chủ xe sửa lại"
                  className="h-20 resize-none rounded-[10px] border border-[#c5d2e3] bg-white p-3.5 text-[15px] placeholder:text-[#8a99ae]"
                />
              </label>

              <div className="flex gap-3">
                <button
                  onClick={resolve}
                  disabled={!checked.every(Boolean)}
                  className="h-12 flex-1 rounded-xl bg-primary text-[15px] font-semibold text-white disabled:opacity-50"
                >
                  Duyệt xe
                </button>
                <button
                  onClick={resolve}
                  disabled={reason.trim() === ""}
                  className="h-12 flex-1 rounded-xl border border-[#c5d2e3] bg-white text-[15px] font-semibold text-[#c0281c] disabled:opacity-50"
                >
                  Từ chối
                </button>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
