import { windowStart } from "./admin-overview.service";

describe("windowStart", () => {
  it("bắt đầu từ 00:00 giờ Việt Nam, gồm cả hôm nay", () => {
    // 10:00 ngày 13/10 giờ Việt Nam.
    const now = new Date("2026-10-13T03:00:00Z");
    expect(windowStart(1, now).toISOString()).toBe("2026-10-12T17:00:00.000Z");
    expect(windowStart(7, now).toISOString()).toBe("2026-10-06T17:00:00.000Z");
  });

  it("sau nửa đêm giờ Việt Nam (vẫn là hôm trước theo UTC) đã tính là ngày mới", () => {
    // 00:30 ngày 14/10 giờ Việt Nam = 17:30 ngày 13/10 UTC.
    expect(windowStart(1, new Date("2026-10-13T17:30:00Z")).toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });
});
