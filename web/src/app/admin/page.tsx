import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminReview } from "./admin-review";

export const metadata = { title: pageTitle("Kiểm duyệt xe") };

export default function AdminPage() {
  return (
    <AdminShell active="/admin" title="Kiểm duyệt xe">
      <AdminReview />
    </AdminShell>
  );
}
