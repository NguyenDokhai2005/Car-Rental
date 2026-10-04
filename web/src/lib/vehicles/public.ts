import { cache } from "react";
import { serverGet, ServerApiError } from "@/lib/server/api";
import type { BusyPeriod } from "./availability";
import type { Fuel, Transmission } from "./labels";

// Khớp PublicVehicleListItem / PublicVehicleDetail của API (api/src/vehicles/public-vehicle.view.ts).
export type PublicVehicle = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  seats: number;
  transmission: Transmission;
  fuel: Fuel;
  city: string;
  district: string;
  pricePerDay: number;
  depositRate: number;
  coverUrl: string | null;
};

export type PublicVehicleDetail = PublicVehicle & {
  description: string;
  images: { id: string; url: string; position: number }[];
  owner: { fullName: string };
};

export type VehiclePage = { items: PublicVehicle[]; total: number; page: number; limit: number };

export function searchVehicles(query: URLSearchParams): Promise<VehiclePage> {
  return serverGet<VehiclePage>(`/vehicles?${query.toString()}`);
}

// Trả null khi xe không tồn tại hoặc chưa công khai; lỗi khác (API sập) được ném tiếp để trang báo lỗi.
// `cache` của React: trang chi tiết gọi hàm này hai lần trong một lần render (generateMetadata và phần thân trang),
// nên dùng chung một lần gọi API thay vì hai, đỡ tốn hạn mức và nhanh hơn.
export const getVehicle = cache(async (id: string): Promise<PublicVehicleDetail | null> => {
  try {
    return await serverGet<PublicVehicleDetail>(`/vehicles/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
});

export async function getBusyPeriods(id: string, month: string): Promise<BusyPeriod[]> {
  const data = await serverGet<{ busy: BusyPeriod[] }>(`/vehicles/${encodeURIComponent(id)}/availability?month=${month}`);
  return data.busy;
}
