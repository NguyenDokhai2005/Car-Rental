import { Header } from "@/components/header";
import { pageTitle } from "@/lib/brand";
import { BookingDetail } from "./booking-detail";

export const metadata = { title: pageTitle("Chi tiết đơn") };

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Header active="/bookings" />
      <BookingDetail bookingId={id} />
    </>
  );
}
