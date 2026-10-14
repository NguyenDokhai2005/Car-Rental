import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminOverview } from "./admin-overview";

export const metadata = { title: pageTitle("Tổng quan") };

export default function AdminOverviewPage() {
  return (
    <AdminShell active="/admin/overview" title="Tổng quan">
      <AdminOverview />
    </AdminShell>
  );
}
