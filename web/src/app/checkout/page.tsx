import { CheckoutView } from "./checkout-view";

export const metadata = { title: "Thanh toán — Car-Rental" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  return <CheckoutView bookingId={booking ?? ""} />;
}
