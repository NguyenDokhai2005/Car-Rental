import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminLicenses } from "./admin-licenses";

export const metadata = { title: pageTitle("Duyệt GPLX") };

export default function AdminLicensesPage() {
  return (
    <AdminShell active="/admin/licenses" title="Duyệt GPLX">
      <AdminLicenses />
    </AdminShell>
  );
}
