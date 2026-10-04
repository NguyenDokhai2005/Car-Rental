import { Header } from "@/components/header";
import { VehicleManager } from "./vehicle-manager";

export const metadata = { title: "Quản lý xe — Car-Rental" };

export default async function ManageVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Header active="/owner" />
      <VehicleManager id={id} />
    </>
  );
}
