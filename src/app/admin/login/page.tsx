import { LoginForm } from "@/components/LoginForm";
import { DEMO_PASSWORDS } from "@/lib/seed-data";

export default function AdminLoginPage() {
  return (
    <LoginForm
      portalTitle="Administrator Portal Sign In"
      portalSubtitle="Review volunteer verification applications, manage eligibility, and inspect audit trails."
      expectedRole="admin"
      redirectTo="/admin"
      demoEmail="admin@hershield.demo"
      demoPassword={DEMO_PASSWORDS.admin}
    />
  );
}
