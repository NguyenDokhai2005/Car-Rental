import { Header } from "@/components/header";
import { pageTitle } from "@/lib/brand";
import { OwnerEarnings } from "./owner-earnings";

export const metadata = { title: pageTitle("Thu nhập") };

export default function OwnerEarningsPage() {
  return (
    <>
      <Header active="/owner/earnings" />
      <OwnerEarnings />
    </>
  );
}
