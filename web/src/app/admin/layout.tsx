import { RequireRole } from "@/components/require-role";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["admin"]}>{children}</RequireRole>;
}
