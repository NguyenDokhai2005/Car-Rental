// Biểu tượng Material Symbols. `name` là tên biểu tượng trên fonts.google.com/icons (ví dụ "location_on").
// Biểu tượng chỉ để trang trí nên ẩn với trình đọc màn hình; chữ bên cạnh mới là nội dung.
export function Icon({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span aria-hidden className={`icon ${className}`} style={filled ? { fontVariationSettings: '"FILL" 1' } : undefined}>
      {name}
    </span>
  );
}
