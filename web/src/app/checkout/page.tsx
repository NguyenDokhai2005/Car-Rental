import { CARS, getCar } from "@/lib/cars";
import { CheckoutView } from "./checkout-view";

export const metadata = { title: "Thanh toán — Car-Rental" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ car?: string }>;
}) {
  const { car: carId } = await searchParams;
  const car = (carId && getCar(carId)) || CARS[0];
  return <CheckoutView car={car} />;
}
