export type Transmission = "automatic" | "manual";
export type Fuel = "petrol" | "diesel" | "electric";

export const TRANSMISSIONS: Transmission[] = ["automatic", "manual"];
export const FUELS: Fuel[] = ["petrol", "diesel", "electric"];

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  automatic: "Số tự động",
  manual: "Số sàn",
};

export const FUEL_LABELS: Record<Fuel, string> = {
  petrol: "Xăng",
  diesel: "Dầu",
  electric: "Điện",
};
