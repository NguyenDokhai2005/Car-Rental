import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminBookings } from "./admin-bookings";

export const metadata = { title: pageTitle("Quản lý đơn & Sổ tiền") };

export default function AdminBookingsPage() {
  return (
    <AdminShell active="/admin/bookings" title="Quản lý đơn & Sổ tiền">
      <AdminBookings />
    </AdminShell>
  );
}
