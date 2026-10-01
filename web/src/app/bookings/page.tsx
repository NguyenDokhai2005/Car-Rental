import { HeaderLoggedIn } from "@/components/header";
import { BookingList } from "./booking-list";

export const metadata = { title: "Đơn của tôi — Car-Rental" };

export default function BookingsPage() {
  return (
    <>
      <HeaderLoggedIn active="/bookings" />
      <main className="flex justify-center pt-10 pb-16">
        <div className="flex w-full max-w-[960px] flex-col gap-6">
          <h1 className="text-[34px] font-bold text-ink">Đơn của tôi</h1>
          <BookingList />
        </div>
      </main>
    </>
  );
}
