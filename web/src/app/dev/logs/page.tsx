import { DevShell } from "@/components/dev-shell";
import { pageTitle } from "@/lib/brand";
import { DevLogs } from "./dev-logs";

export const metadata = { title: pageTitle("Console log") };

export default function DevLogsPage() {
  return (
    <DevShell active="/dev/logs" title="Console log">
      <DevLogs />
    </DevShell>
  );
}
