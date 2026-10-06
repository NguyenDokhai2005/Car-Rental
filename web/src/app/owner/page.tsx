import { Header } from "@/components/header";
import { pageTitle } from "@/lib/brand";
import { OwnerDashboard } from "./owner-dashboard";

export const metadata = { title: pageTitle("Quản lý xe và đơn thuê") };

export default function OwnerDashboardPage() {
  return (
    <>
      <Header active="/owner" />
      <OwnerDashboard />
    </>
  );
}
