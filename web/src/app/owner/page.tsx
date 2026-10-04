import { Header } from "@/components/header";
import { OwnerDashboard } from "./owner-dashboard";

export const metadata = { title: "Quản lý xe và đơn thuê — Car-Rental" };

export default function OwnerDashboardPage() {
  return (
    <>
      <Header active="/owner" />
      <OwnerDashboard />
    </>
  );
}
