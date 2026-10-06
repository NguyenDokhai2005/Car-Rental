import { pageTitle } from "@/lib/brand";
import { CheckoutView } from "./checkout-view";

export const metadata = { title: pageTitle("Thanh toán") };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  return <CheckoutView bookingId={booking ?? ""} />;
}
