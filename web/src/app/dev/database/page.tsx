import { DevShell } from "@/components/dev-shell";
import { pageTitle } from "@/lib/brand";
import { DevDatabase } from "./dev-database";

export const metadata = { title: pageTitle("Cơ sở dữ liệu") };

export default function DevDatabasePage() {
  return (
    <DevShell active="/dev/database" title="Cơ sở dữ liệu">
      <DevDatabase />
    </DevShell>
  );
}
