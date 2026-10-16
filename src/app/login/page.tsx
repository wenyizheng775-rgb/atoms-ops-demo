import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--muted)]">加载…</div>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
