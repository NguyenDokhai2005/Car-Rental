const vnd = new Intl.NumberFormat("vi-VN");

export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}đ`;
}
