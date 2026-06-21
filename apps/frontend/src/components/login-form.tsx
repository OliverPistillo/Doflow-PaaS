"use client";

import * as React from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginPanel } from "@/components/auth/login-panel";

export function LoginForm() {
  const [mascotShy, setMascotShy] = React.useState(false);

  return (
    <AuthShell
      mode="login"
      title="Bentornato."
      description="Accedi per riprendere da dove avevi lasciato."
      mascotShy={mascotShy}
    >
      <LoginPanel onMascotShyChange={setMascotShy} />
    </AuthShell>
  );
}
