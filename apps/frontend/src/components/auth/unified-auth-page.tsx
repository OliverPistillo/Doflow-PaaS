"use client";

import * as React from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginPanel } from "@/components/auth/login-panel";
import { RegisterPanel } from "@/components/auth/register-panel";

type AuthMode = "login" | "register";

type UnifiedAuthPageProps = {
  initialMode?: AuthMode;
};

const COPY = {
  login: {
    title: "Bentornato.",
    description: "Accedi per riprendere da dove avevi lasciato.",
  },
  register: {
    title: "Crea il tuo account.",
    description: "Bastano pochi secondi per iniziare a far fluire i progetti.",
  },
} satisfies Record<AuthMode, { title: string; description: string }>;

export function UnifiedAuthPage({ initialMode = "login" }: UnifiedAuthPageProps) {
  const [mode, setMode] = React.useState<AuthMode>(initialMode);
  const [mascotShy, setMascotShy] = React.useState(false);

  const switchMode = React.useCallback((nextMode: AuthMode) => {
    setMascotShy(false);
    setMode(nextMode);
  }, []);

  return (
    <AuthShell
      mode={mode}
      title={COPY[mode].title}
      description={COPY[mode].description}
      mascotShy={mascotShy}
      onModeChange={switchMode}
    >
      {mode === "login" ? (
        <LoginPanel
          onMascotShyChange={setMascotShy}
          onSwitchToRegister={() => switchMode("register")}
        />
      ) : (
        <RegisterPanel
          onMascotShyChange={setMascotShy}
          onSwitchToLogin={() => switchMode("login")}
        />
      )}
    </AuthShell>
  );
}
