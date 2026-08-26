"use client";

import * as React from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginExperience } from "@/components/auth/login-experience";
import { LoginPanel } from "@/components/auth/login-panel";
import { RegisterPanel } from "@/components/auth/register-panel";

type AuthMode = "login" | "register";

type UnifiedAuthPageProps = {
  initialMode?: AuthMode;
};

export function UnifiedAuthPage({ initialMode = "login" }: UnifiedAuthPageProps) {
  const [mascotShy, setMascotShy] = React.useState(false);

  if (initialMode === "login") {
    return (
      <LoginExperience mascotShy={mascotShy}>
        <LoginPanel onMascotShyChange={setMascotShy} />
      </LoginExperience>
    );
  }

  return (
    <AuthShell
      mode="register"
      title="Crea il tuo account."
      description="Bastano pochi secondi per iniziare a far fluire i progetti."
      mascotShy={mascotShy}
      cardClassName="auth-card-wide"
    >
      <RegisterPanel onMascotShyChange={setMascotShy} />
    </AuthShell>
  );
}
