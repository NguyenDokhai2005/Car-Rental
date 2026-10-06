import { Icon } from "@/components/icon";
import { pageWindow } from "@/lib/vehicles/search-params";

// Phân trang cho các bảng tải dữ liệu trên trình duyệt (trang tìm kiếm dùng liên kết vì nó dựng ở máy chủ).
export function Pager({ page, total, pageSize, unit, onPage }: { page: number; total: number; pageSize: number; unit: string; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const button = "flex size-9 items-center justify-center rounded-lg text-label-lg transition-colors disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-space-md">
      <p className="text-label-md text-on-surface-variant">
        Hiển thị <strong className="text-on-surface">{first} - {last}</strong> trên <strong className="text-on-surface">{total}</strong> {unit}
      </p>
      {pages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-1">
          <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${button} bg-surface-container-low`}>
            <Icon name="chevron_left" className="!text-[18px]" />
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-outline">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
                className={`${button} ${p === page ? "bg-primary-container text-on-primary shadow-sm" : "bg-surface-container-low text-on-surface hover:bg-surface-container"}`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" aria-label="Trang sau" disabled={page >= pages} onClick={() => onPage(page + 1)} className={`${button} bg-surface-container-low`}>
            <Icon name="chevron_right" className="!text-[18px]" />
          </button>
        </nav>
      )}
    </div>
  );
}
