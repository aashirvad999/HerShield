import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isLoginDisabled } from "@/lib/auth";
import { DEMO_PASSWORDS } from "@/lib/seed-data";

export default function VolunteerLoginPage() {
  if (isLoginDisabled()) {
    redirect("/volunteer");
  }
  return (
    <LoginForm
      portalTitle="Community Volunteer Sign In"
      portalSubtitle="Access your verification status, add your Telegram ID for alerts, and view PrivacyShield incident previews."
      expectedRole="volunteer"
      redirectTo="/volunteer"
      demoEmail="ananya.demo@hershield.demo"
      demoPassword={DEMO_PASSWORDS.volunteer}
      extraDemoAccounts={[
        {
          label: "Ananya (Verified • Indiranagar)",
          email: "ananya.demo@hershield.demo",
          password: DEMO_PASSWORDS.volunteer,
        },
        {
          label: "Priya (Verified • Indiranagar CMH)",
          email: "priya.demo@hershield.demo",
          password: DEMO_PASSWORDS.volunteer,
        },
        {
          label: "Riya (Verified • Koramangala)",
          email: "riya.demo@hershield.demo",
          password: DEMO_PASSWORDS.volunteer,
        },
        {
          label: "Aisha (Pending Admin Review)",
          email: "aisha.demo@hershield.demo",
          password: DEMO_PASSWORDS.volunteer,
        },
      ]}
      showRegisterLink
    />
  );
}
