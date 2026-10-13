// Tính toán cho biểu đồ đường của trang kỹ thuật. Tách khỏi phần vẽ để kiểm thử được.

// Đỉnh trục dọc "tròn" (1, 2, 5 nhân lũy thừa của 10) vừa đủ chứa giá trị lớn nhất, để nhãn trục dễ đọc.
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

export function seriesMax(series: { values: (number | null)[] }[]): number {
  let max = 0;
  for (const { values } of series) {
    for (const value of values) if (value !== null && value > max) max = value;
  }
  return max;
}

// Đường vẽ SVG trong khung 100 x 100 (gốc ở góc trên trái). Chỗ thiếu dữ liệu (null) làm đứt nét thay vì nối thẳng qua,
// để khoảng không đo được không bị đọc nhầm thành số liệu thật.
export function linePath(values: (number | null)[], max: number): string {
  const lastIndex = Math.max(1, values.length - 1);
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = ((index / lastIndex) * 100).toFixed(2);
    const y = (100 - (Math.min(value, max) / max) * 100).toFixed(2);
    path += `${drawing ? "L" : "M"}${x},${y}`;
    drawing = true;
  });
  return path;
}

// Điểm dữ liệu gần con trỏ nhất, theo tỷ lệ vị trí ngang (0 đến 1) của con trỏ trong vùng vẽ.
export function indexAt(ratio: number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.round(ratio * (length - 1))));
}
