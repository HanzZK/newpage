import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in · HostAI Concierge",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
