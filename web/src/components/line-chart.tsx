"use client";

import { useState } from "react";
import { indexAt, linePath, niceMax, seriesMax } from "@/lib/dev/chart";
import { formatLogTime } from "@/lib/dev/format";

export type ChartSeries = { label: string; color: string; values: (number | null)[] };

type Props = {
  title: string;
  hint: string;
  unit: string;
  times: string[];
  series: ChartSeries[];
  // Đỉnh trục dọc cố định (ví dụ 100 cho phần trăm). Không đặt thì tự co giãn theo dữ liệu.
  max?: number;
  // Cách hiện một mốc thời gian trên trục và trong chú giải. Mặc định là giờ:phút:giây.
  formatTime?: (time: string) => string;
  emptyText?: string;
};

const clock = (iso: string) => formatLogTime(iso).split(" ")[0];
const show = (value: number | null, unit: string) => (value === null ? "–" : `${value.toLocaleString("vi-VN")} ${unit}`);

export function LineChart({ title, hint, unit, times, series, max, formatTime = clock, emptyText = "Đang thu thập dữ liệu, biểu đồ hiện sau khoảng 20 giây." }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const top = max ?? niceMax(seriesMax(series));
  const lastIndex = times.length - 1;
  const focus = hover !== null && hover <= lastIndex ? hover : null;
  const shown = focus ?? lastIndex;
  const left = focus === null ? 0 : (focus / Math.max(1, lastIndex)) * 100;

  return (
    <figure className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-title-lg text-on-surface">{title}</span>
        <span className="text-label-md text-on-surface-variant">{hint}</span>
      </figcaption>

      <ul className="flex flex-wrap gap-x-space-md gap-y-1 text-label-md">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-on-surface-variant">
            <i aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
            <span className="font-semibold text-on-surface">{times.length > 0 ? show(s.values[shown] ?? null, unit) : "–"}</span>
          </li>
        ))}
        {times.length > 0 && <li className="ml-auto text-outline">{focus === null ? "Mới nhất" : formatTime(times[shown])}</li>}
      </ul>

      {times.length < 2 ? (
        <p className="flex h-44 items-center justify-center rounded-xl bg-surface-container-low text-body-md text-on-surface-variant">
          {emptyText}
        </p>
      ) : (
        <div className="flex gap-space-sm">
          <div aria-hidden className="flex h-40 w-12 shrink-0 flex-col justify-between text-right text-label-sm text-outline">
            <span>{top.toLocaleString("vi-VN")}</span>
            <span>{(top / 2).toLocaleString("vi-VN")}</span>
            <span>0</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              className="relative h-40 cursor-crosshair touch-none"
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                setHover(indexAt((event.clientX - box.left) / box.width, times.length));
              }}
              onPointerLeave={() => setHover(null)}
            >
              <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
                <i className="border-t border-outline-variant/60" />
                <i className="border-t border-dashed border-outline-variant/60" />
                <i className="border-t border-outline-variant" />
              </div>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${title}: ${series.map((s) => `${s.label} ${show(s.values[lastIndex] ?? null, unit)}`).join(", ")}`}
                className="absolute inset-0 size-full overflow-visible"
              >
                {series.map((s) => (
                  <path
                    key={s.label}
                    d={linePath(s.values, top)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {focus !== null && (
                <>
                  <i aria-hidden className="absolute inset-y-0 w-px bg-on-surface/40" style={{ left: `${left}%` }} />
                  {series.map((s) => {
                    const value = s.values[focus];
                    if (value === null || value === undefined) return null;
                    return (
                      <i
                        key={s.label}
                        aria-hidden
                        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-container-lowest"
                        style={{ left: `${left}%`, top: `${100 - (Math.min(value, top) / top) * 100}%`, backgroundColor: s.color }}
                      />
                    );
                  })}
                </>
              )}
            </div>
            <div aria-hidden className="flex justify-between text-label-sm text-outline">
              <span>{formatTime(times[0])}</span>
              <span>{formatTime(times[Math.floor(lastIndex / 2)])}</span>
              <span>{formatTime(times[lastIndex])}</span>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
