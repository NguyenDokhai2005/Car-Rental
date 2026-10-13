import { Icon } from "@/components/icon";
import type { SystemStatus } from "@/lib/dev/api";
import { formatUptime, Health, percent, usageHealth } from "@/lib/dev/format";
import { apiHealth, databaseHealth, serverHealth, webHealth } from "@/lib/dev/health";

export const HEALTH: Record<Health, { label: string; pill: string; bar: string }> = {
  good: { label: "Hoạt động", pill: "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant", bar: "bg-tertiary" },
  warn: { label: "Cần chú ý", pill: "bg-warning-container text-warning", bar: "bg-warning" },
  bad: { label: "Có sự cố", pill: "bg-error-container text-on-error-container", bar: "bg-error" },
};

const number = (value: number) => value.toLocaleString("vi-VN");

function Panel({ icon, title, health, children }: { icon: string; title: string; health: Health; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex items-center justify-between gap-space-sm">
        <h3 className="flex items-center gap-space-sm text-title-lg text-on-surface">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <Icon name={icon} />
          </span>
          {title}
        </h3>
        <span className={`rounded-full px-3 py-1 text-label-md ${HEALTH[health].pill}`}>{HEALTH[health].label}</span>
      </div>
      {children}
    </section>
  );
}

function Rows({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-space-md gap-y-1.5 text-body-md">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-on-surface-variant">{label}</dt>
          <dd className="text-right font-medium break-all text-on-surface">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Meter({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const value = percent(used, total);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-label-md text-on-surface-variant">
        <span>{label}</span>
        <span>
          {number(used)} / {number(total)} {unit} ({value}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={`h-full rounded-full ${HEALTH[usageHealth(value)].bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Unavailable({ error }: { error: string }) {
  return (
    <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
      Không lấy được thông tin phần này ({error}).
    </p>
  );
}

function ServerPanel({ server }: { server: SystemStatus["server"] }) {
  return (
    <Panel icon="memory" title="Máy chủ" health={serverHealth(server)}>
      {!server.ok ? (
        <Unavailable error={server.error} />
      ) : (
        <>
          <Meter label="RAM" used={server.memoryMb.total - server.memoryMb.available} total={server.memoryMb.total} unit="MB" />
          {server.swapMb && server.swapMb.total > 0 && <Meter label="Swap" used={server.swapMb.used} total={server.swapMb.total} unit="MB" />}
          <Meter label="Đĩa chứa ảnh tải lên" used={Number((server.uploadDisk.totalGb - server.uploadDisk.freeGb).toFixed(1))} total={server.uploadDisk.totalGb} unit="GB" />
          <Rows
            items={[
              ["Tên máy", server.hostname],
              ["Hệ điều hành", server.platform],
              ["Đã chạy", formatUptime(server.uptimeSeconds)],
              ["Số CPU", String(server.cpuCount)],
              ["Tải trung bình (1 / 5 / 15 phút)", server.loadAverage.join(" / ")],
              ["Giới hạn RAM của container", server.containerMemoryLimitMb === null ? "Không giới hạn" : `${number(server.containerMemoryLimitMb)} MB`],
              ["Đĩa còn trống", `${number(server.uploadDisk.freeGb)} GB`],
            ]}
          />
        </>
      )}
    </Panel>
  );
}

function ApiPanel({ api }: { api: SystemStatus["api"] }) {
  return (
    <Panel icon="dns" title="Backend (API)" health={apiHealth(api)}>
      <Meter label="Bộ nhớ heap" used={api.memoryMb.heapUsed} total={api.memoryMb.heapLimit} unit="MB" />
      <Rows
        items={[
          ["Môi trường", api.environment],
          ["Node.js", api.nodeVersion],
          ["Mã tiến trình (PID)", String(api.pid)],
          ["Đã chạy", formatUptime(api.uptimeSeconds)],
          ["Bộ nhớ tiến trình (RSS)", `${number(api.memoryMb.rss)} MB`],
          ["Độ trễ vòng lặp sự kiện (TB / p99 / max)", `${api.eventLoopDelayMs.mean} / ${api.eventLoopDelayMs.p99} / ${api.eventLoopDelayMs.max} ms`],
          ["Yêu cầu 5 phút gần nhất", number(api.last5Minutes.count)],
          ["Lỗi 4xx / 5xx trong 5 phút", `${api.last5Minutes.clientErrors} / ${api.last5Minutes.serverErrors}`],
          ["Thời gian xử lý trung bình", `${api.last5Minutes.avgMs} ms`],
        ]}
      />
    </Panel>
  );
}

function WebPanel({ web }: { web: SystemStatus["web"] }) {
  return (
    <Panel icon="web" title="Frontend (Web)" health={webHealth(web)}>
      {!web.ok ? (
        <Unavailable error={web.error} />
      ) : (
        <Rows
          items={[
            ["Mã trạng thái khi API gọi thử", String(web.status)],
            ["Thời gian phản hồi", `${number(web.responseMs)} ms`],
          ]}
        />
      )}
      <p className="text-label-md text-on-surface-variant">API gọi thử trang đăng nhập của máy chủ web qua mạng nội bộ. Lỗi JavaScript trên máy người dùng xem ở mục Console log.</p>
    </Panel>
  );
}

function DatabasePanel({ database }: { database: SystemStatus["database"] }) {
  return (
    <Panel icon="database" title="Cơ sở dữ liệu" health={databaseHealth(database)}>
      {!database.ok ? (
        <Unavailable error={database.error} />
      ) : (
        <>
          <Meter label="Kết nối đang mở" used={database.connections.total} total={database.connections.max} unit="kết nối" />
          <Rows
            items={[
              ["Phiên bản", database.version],
              ["Đã chạy", formatUptime(database.uptimeSeconds)],
              ["Độ trễ truy vấn thử", `${database.pingMs} ms`],
              ["Kích thước", `${number(database.sizeMb)} MB`],
              ["Kết nối đang chạy truy vấn", String(database.connections.active)],
              ["Truy vấn đang chạy lâu nhất", `${database.longestQuerySeconds} giây`],
              ["Tỷ lệ đọc từ bộ nhớ đệm", database.cacheHitPercent === null ? "–" : `${database.cacheHitPercent}%`],
              ["Giao dịch bị hủy / deadlock (từ lúc khởi động)", `${number(database.rollbacks)} / ${number(database.deadlocks)}`],
              ["Migration đã áp dụng", String(database.migrations.applied)],
              ["Migration mới nhất", database.migrations.latest ?? "–"],
            ]}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-md">
              <caption className="pb-1 text-left text-label-md text-on-surface-variant">Số dòng là ước lượng của PostgreSQL, không phải số đếm chính xác.</caption>
              <thead>
                <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className="rounded-l-lg px-space-sm py-space-sm font-semibold">Bảng</th>
                  <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Số dòng</th>
                  <th scope="col" className="rounded-r-lg px-space-sm py-space-sm text-right font-semibold">Kích thước</th>
                </tr>
              </thead>
              <tbody>
                {database.tables.map((table) => (
                  <tr key={table.name}>
                    <td className="px-space-sm py-1.5 font-mono text-on-surface">{table.name}</td>
                    <td className="px-space-sm py-1.5 text-right text-on-surface">{number(table.rows)}</td>
                    <td className="px-space-sm py-1.5 text-right text-on-surface-variant">{number(table.sizeMb)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

export function StatusDetails({ status }: { status: SystemStatus }) {
  return (
    <div className="grid items-start gap-gutter xl:grid-cols-2">
      <ServerPanel server={status.server} />
      <ApiPanel api={status.api} />
      <WebPanel web={status.web} />
      <DatabasePanel database={status.database} />
    </div>
  );
}
