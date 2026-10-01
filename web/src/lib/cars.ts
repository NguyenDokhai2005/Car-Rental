export type Car = {
  id: string;
  name: string;
  year: number;
  seats: number;
  transmission: "Số tự động" | "Số sàn";
  fuel: "Xăng" | "Dầu" | "Điện";
  district: string;
  city: string;
  rating: number;
  pricePerDay: number;
};

// Dữ liệu mẫu theo thiết kế; thay bằng dữ liệu từ API khi có endpoint danh sách xe.
export const CARS: Car[] = [
  { id: "vios", name: "Toyota Vios 2022", year: 2022, seats: 5, transmission: "Số tự động", fuel: "Xăng", district: "Quận 7", city: "TP. Hồ Chí Minh", rating: 4.9, pricePerDay: 650000 },
  { id: "accent", name: "Hyundai Accent 2023", year: 2023, seats: 5, transmission: "Số tự động", fuel: "Xăng", district: "Quận 1", city: "TP. Hồ Chí Minh", rating: 4.8, pricePerDay: 600000 },
  { id: "vf6", name: "VinFast VF 6 2024", year: 2024, seats: 5, transmission: "Số tự động", fuel: "Điện", district: "Thủ Đức", city: "TP. Hồ Chí Minh", rating: 4.9, pricePerDay: 1100000 },
  { id: "cx5", name: "Mazda CX-5 2021", year: 2021, seats: 5, transmission: "Số tự động", fuel: "Xăng", district: "Bình Thạnh", city: "TP. Hồ Chí Minh", rating: 4.7, pricePerDay: 1200000 },
  { id: "xpander", name: "Mitsubishi Xpander 2023", year: 2023, seats: 7, transmission: "Số tự động", fuel: "Xăng", district: "Quận 2", city: "TP. Hồ Chí Minh", rating: 4.8, pricePerDay: 950000 },
  { id: "seltos", name: "Kia Seltos 2022", year: 2022, seats: 5, transmission: "Số tự động", fuel: "Xăng", district: "Quận 10", city: "TP. Hồ Chí Minh", rating: 4.6, pricePerDay: 850000 },
  { id: "city", name: "Honda City 2021", year: 2021, seats: 5, transmission: "Số tự động", fuel: "Xăng", district: "Tân Bình", city: "TP. Hồ Chí Minh", rating: 4.7, pricePerDay: 620000 },
  { id: "vf5", name: "VinFast VF 5 2023", year: 2023, seats: 5, transmission: "Số tự động", fuel: "Điện", district: "Quận 9", city: "TP. Hồ Chí Minh", rating: 4.8, pricePerDay: 780000 },
  { id: "everest", name: "Ford Everest 2022", year: 2022, seats: 7, transmission: "Số tự động", fuel: "Dầu", district: "Quận 7", city: "TP. Hồ Chí Minh", rating: 4.9, pricePerDay: 1600000 },
];

export function getCar(id: string): Car | undefined {
  return CARS.find((car) => car.id === id);
}

const vnd = new Intl.NumberFormat("vi-VN");

export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}đ`;
}
