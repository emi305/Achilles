import { redirect } from "next/navigation";
import { BrandHeader } from "../components/BrandHeader";
import { PricingClient } from "../components/PricingClient";
import { getViewerContext } from "../lib/authContext";

export default async function PricingPage() {
  const viewer = await getViewerContext();

  if (!viewer.isAuthenticated) {
    redirect("/");
  }

  if (viewer.hasActiveAccess) {
    redirect("/app");
  }

  return (
    <section className="space-y-10 pt-6 text-center sm:pt-10">
      <BrandHeader subtitle="Choose a plan to continue." />
      <PricingClient viewer={viewer} />
    </section>
  );
}
