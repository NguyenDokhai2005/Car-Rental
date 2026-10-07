import { pageTitle } from "@/lib/brand";
import { PaymentResult } from "./payment-result";

export const metadata = { title: pageTitle("Kết quả thanh toán") };

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  return <PaymentResult bookingId={booking ?? ""} />;
}
