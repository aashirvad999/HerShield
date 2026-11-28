import { LoginForm } from "@/components/LoginForm";
import { DEMO_PASSWORDS } from "@/lib/seed-data";

export default function OperatorLoginPage() {
  return (
    <LoginForm
      portalTitle="Operator Console Sign In"
      portalSubtitle="Monitor live feeds, verify AI indicators, and dispatch verified community volunteers."
      expectedRole="operator"
      redirectTo="/operator"
      demoEmail="operator@hershield.demo"
      demoPassword={DEMO_PASSWORDS.operator}
    />
  );
}
