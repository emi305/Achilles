import { GatewayClient } from "./components/GatewayClient";
import { BrandHeader } from "./components/BrandHeader";
import { getViewerContext } from "./lib/authContext";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const viewer = await getViewerContext();
  if (viewer.isAuthenticated) {
    redirect(viewer.hasActiveAccess ? "/app" : "/pricing");
  }

  return (
    <section className="space-y-10 pt-6 text-center sm:pt-10">
      <BrandHeader subtitle="Sign up, verify your email, and start Achilles Insight." />
      <p className="text-sm text-stone-700">Sign up or log in to continue.</p>
      <GatewayClient viewer={viewer} />
    </section>
  );
}
