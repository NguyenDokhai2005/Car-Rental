import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminUserDetailView } from "./admin-user-detail";

export const metadata = { title: pageTitle("Chi tiết người dùng") };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell active="/admin/users" title="Chi tiết người dùng">
      <AdminUserDetailView userId={id} />
    </AdminShell>
  );
}
