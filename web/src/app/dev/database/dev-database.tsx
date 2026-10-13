"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Pager } from "@/components/pager";
import { listTableRows, listTables, RowsQuery, TABLE_PAGE_SIZE, TableInfo } from "@/lib/dev/api";
import { usePolling } from "../use-polling";

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const FIELD = "h-10 rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface outline-none focus:ring-2 focus:ring-primary/30";
const EMPTY_QUERY: RowsQuery = { page: 1, sort: null, order: "asc", filterColumn: "", filterValue: "" };

function Cell({ value, masked }: { value: string | null; masked: boolean }) {
  if (value === null) return <span className="text-outline italic">null</span>;
  if (masked) {
    return (
      <span className="flex items-center gap-1 text-outline" title="Cột bí mật, đã che tại máy chủ">
        <Icon name="lock" className="!text-[14px]" />
        đã che
      </span>
    );
  }
  return (
    <span className="block max-w-72 truncate" title={value}>
      {value}
    </span>
  );
}

function TableData({ table }: { table: TableInfo }) {
  const [query, setQuery] = useState<RowsQuery>(EMPTY_QUERY);
  const [draft, setDraft] = useState({ column: "", value: "" });
  const { data, error, loading } = usePolling(() => listTableRows(table.name, query), JSON.stringify(query), null);
  const filterable = table.columns.filter((column) => !column.masked);
  const maskedCount = table.columns.length - filterable.length;

  function sortBy(column: string) {
    setQuery((q) => ({ ...q, page: 1, sort: column, order: q.sort === column && q.order === "asc" ? "desc" : "asc" }));
  }

  function applyFilter(event: React.FormEvent) {
    event.preventDefault();
    if (draft.column) setQuery((q) => ({ ...q, page: 1, filterColumn: draft.column, filterValue: draft.value }));
  }

  function clearFilter() {
    setDraft({ column: "", value: "" });
    setQuery((q) => ({ ...q, page: 1, filterColumn: "", filterValue: "" }));
  }

  return (
    <section className={`flex min-w-0 flex-col gap-space-md ${CARD}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-mono text-title-lg text-on-surface">{table.name}</h2>
        <p className="text-label-md text-on-surface-variant">
          {table.columns.length} cột{maskedCount > 0 && `, trong đó ${maskedCount} cột bí mật đã bị che`}. Chỉ đọc: trang này không sửa hay xóa được dữ liệu.
        </p>
      </div>

      <details className="rounded-xl bg-surface-container-low px-space-md py-space-sm">
        <summary className="cursor-pointer text-label-lg text-on-surface">Cấu trúc bảng</summary>
        <ul className="mt-space-sm grid gap-x-space-md gap-y-1 text-label-md sm:grid-cols-2 xl:grid-cols-3">
          {table.columns.map((column) => (
            <li key={column.name} className="flex items-center justify-between gap-space-sm">
              <span className="flex items-center gap-1 font-mono text-on-surface">
                {column.masked && <Icon name="lock" className="!text-[14px] text-outline" />}
                {column.name}
              </span>
              <span className="text-on-surface-variant">
                {column.type}
                {column.nullable ? ", cho phép null" : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <form onSubmit={applyFilter} className="flex flex-wrap items-center gap-space-sm">
        <select aria-label="Cột để lọc" value={draft.column} onChange={(e) => setDraft((d) => ({ ...d, column: e.target.value }))} className={FIELD}>
          <option value="">Lọc theo cột...</option>
          {filterable.map((column) => (
            <option key={column.name} value={column.name}>
              {column.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={draft.value}
          maxLength={200}
          onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          placeholder="bằng đúng giá trị này"
          aria-label="Giá trị cần lọc"
          className={`min-w-48 flex-1 placeholder:text-outline ${FIELD}`}
        />
        <button type="submit" disabled={!draft.column} className="h-10 rounded-xl bg-primary px-space-md text-label-lg text-on-primary disabled:opacity-40">
          Lọc
        </button>
        {query.filterColumn && (
          <button type="button" onClick={clearFilter} className="h-10 rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface">
            Bỏ lọc
          </button>
        )}
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}
      {loading && <p className="text-body-md text-on-surface-variant">Đang tải dữ liệu...</p>}
      {data && data.items.length === 0 && (
        <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">
          {query.filterColumn ? "Không có dòng nào khớp điều kiện lọc." : "Bảng này chưa có dòng nào."}
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-left text-label-lg">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant">
                  {data.columns.map((column) => (
                    <th key={column.name} scope="col" aria-sort={query.sort === column.name ? (query.order === "asc" ? "ascending" : "descending") : undefined} className="px-space-sm py-space-sm font-semibold whitespace-nowrap">
                      {column.masked ? (
                        <span className="font-mono">{column.name}</span>
                      ) : (
                        <button type="button" onClick={() => sortBy(column.name)} className="flex items-center gap-1 font-mono hover:text-primary">
                          {column.name}
                          {query.sort === column.name && <Icon name={query.order === "asc" ? "arrow_upward" : "arrow_downward"} className="!text-[14px]" />}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, index) => (
                  <tr key={index} className="border-b border-outline-variant/40 last:border-0">
                    {data.columns.map((column) => (
                      <td key={column.name} className="px-space-sm py-1.5 font-mono whitespace-nowrap text-on-surface">
                        <Cell value={row[column.name]} masked={column.masked} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={query.page} total={data.total} pageSize={TABLE_PAGE_SIZE} unit="dòng" onPage={(page) => setQuery((q) => ({ ...q, page }))} />
        </>
      )}
    </section>
  );
}

export function DevDatabase() {
  const tables = usePolling(listTables, "tables", null);
  const [selected, setSelected] = useState<string | null>(null);
  const current = tables.data?.items.find((table) => table.name === selected) ?? null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Cơ sở dữ liệu</h1>
        <p className="text-body-md text-on-surface-variant">
          Xem dữ liệu trong các bảng để tra cứu khi gỡ lỗi. Đây là dữ liệu thật của khách hàng: mỗi lần xem đều được ghi log, và các cột mật khẩu, token, số và ảnh GPLX luôn bị che.
        </p>
      </div>

      {tables.error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {tables.error}
        </p>
      )}
      {tables.loading && <p className="text-body-md text-on-surface-variant">Đang tải danh sách bảng...</p>}

      {tables.data && (
        <div className="grid items-start gap-gutter xl:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Các bảng" className={`flex flex-col gap-1 ${CARD}`}>
            <p className="px-space-sm pb-1 text-label-sm tracking-widest text-on-surface-variant uppercase">{tables.data.items.length} bảng</p>
            {tables.data.items.map((table) => {
              const active = table.name === selected;
              return (
                <button
                  key={table.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(table.name)}
                  className={`flex items-center justify-between gap-space-sm rounded-xl px-space-sm py-2 text-left transition-colors ${
                    active ? "bg-primary-container text-on-primary" : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span className="font-mono text-label-lg break-all">{table.name}</span>
                  <span className={`shrink-0 text-right text-label-sm ${active ? "text-on-primary" : "text-on-surface-variant"}`}>
                    ~{table.rows.toLocaleString("vi-VN")} dòng
                    <br />
                    {table.sizeMb.toLocaleString("vi-VN")} MB
                  </span>
                </button>
              );
            })}
          </nav>

          {/* key: đổi bảng thì dựng lại từ đầu, bộ lọc và trang của bảng trước không dính sang bảng mới. */}
          {current ? (
            <TableData key={current.name} table={current} />
          ) : (
            <p className={`text-center text-body-md text-on-surface-variant ${CARD}`}>Chọn một bảng ở bên trái để xem dữ liệu.</p>
          )}
        </div>
      )}
    </>
  );
}
