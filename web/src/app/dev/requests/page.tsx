import { DevShell } from "@/components/dev-shell";
import { pageTitle } from "@/lib/brand";
import { DevRequests } from "./dev-requests";

export const metadata = { title: pageTitle("Nhật ký yêu cầu") };

export default function DevRequestsPage() {
  return (
    <DevShell active="/dev/requests" title="Nhật ký yêu cầu">
      <DevRequests />
    </DevShell>
  );
}
