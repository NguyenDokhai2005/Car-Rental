import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { pageTitle } from "@/lib/brand";
import { ProfileView } from "./profile-view";

export const metadata = { title: pageTitle("Hồ sơ cá nhân") };

export default function ProfilePage() {
  return (
    <>
      <Header />
      <ProfileView />
      <Footer />
    </>
  );
}
