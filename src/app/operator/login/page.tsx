import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isLoginDisabled } from "@/lib/auth";
import { DEMO_PASSWORDS } from "@/lib/seed-data";

export default function OperatorLoginPage() {
  if (isLoginDisabled()) {
    redirect("/operator");
  }
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
