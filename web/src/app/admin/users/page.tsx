import { AdminShell } from "@/components/admin-shell";
import { pageTitle } from "@/lib/brand";
import { AdminUsers } from "./admin-users";

export const metadata = { title: pageTitle("Quản lý người dùng") };

export default function AdminUsersPage() {
  return (
    <AdminShell active="/admin/users" title="Quản lý người dùng">
      <AdminUsers />
    </AdminShell>
  );
}
