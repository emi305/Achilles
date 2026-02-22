import { BrandHeader } from "../components/BrandHeader";
import { ResetPasswordClient } from "../components/ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <section className="space-y-10 pt-6 text-center sm:pt-10">
      <BrandHeader subtitle="Choose a new password to finish your password reset." />
      <ResetPasswordClient />
    </section>
  );
}
