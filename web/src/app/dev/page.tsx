import { DevShell } from "@/components/dev-shell";
import { pageTitle } from "@/lib/brand";
import { DevStatus } from "./dev-status";

export const metadata = { title: pageTitle("Hiện trạng hệ thống") };

export default function DevStatusPage() {
  return (
    <DevShell active="/dev" title="Hiện trạng hệ thống">
      <DevStatus />
    </DevShell>
  );
}
