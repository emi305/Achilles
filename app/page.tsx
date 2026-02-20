import { GatewayClient } from "./components/GatewayClient";
import { BrandHeader } from "./components/BrandHeader";
import { getViewerContext } from "./lib/authContext";

export default async function HomePage() {
  const viewer = await getViewerContext();

  return (
    <section className="space-y-10 pt-6 text-center sm:pt-10">
      <BrandHeader subtitle="Sign up, verify your email, and start Achilles Insight." />
      <GatewayClient viewer={viewer} />
    </section>
  );
}
