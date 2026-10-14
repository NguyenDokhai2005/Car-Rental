import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminVehicles } from "./admin-vehicles";

export const metadata = { title: pageTitle("Quản lý xe") };

export default function AdminVehiclesPage() {
  return (
    <AdminShell active="/admin/vehicles" title="Quản lý xe">
      <AdminVehicles />
    </AdminShell>
  );
}
