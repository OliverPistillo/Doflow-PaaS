"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import FlowMascot from "./flow-mascot";

type AuthMode = "login" | "register";

type AuthShellProps = {
  mode: AuthMode;
  title: string;
  description: string;
  children: React.ReactNode;
  mascotShy?: boolean;
  cardClassName?: string;
  brandTitle?: React.ReactNode;
  brandDescription?: string;
  registerHref?: string;
  loginHref?: string;
  onModeChange?: (mode: AuthMode) => void;
};

const TRUST_PROPS = [
  { strong: "Fluido", rest: "adattabile" },
  { strong: "Intelligente", rest: "strategico" },
  { strong: "Veloce", rest: "efficiente" },
  { strong: "Continuo", rest: "in evoluzione" },
];

export function AuthShell({
  mode,
  title,
  description,
  children,
  mascotShy = false,
  cardClassName,
  brandTitle = (
    <>
      Dai il via al tuo <em>flusso</em>.
    </>
  ),
  brandDescription =
    "CRM, funnel e automazioni intelligenti: il tuo lavoro finalmente scorre in un unico spazio.",
  registerHref = "/register",
  loginHref = "/login",
  onModeChange,
}: AuthShellProps) {
  return (
    <main className="df-auth-page">
      <div className="df-auth-bg" aria-hidden="true">
        <div className="df-auth-grid" />
        <div className="df-auth-blob df-auth-blob-1" />
        <div className="df-auth-blob df-auth-blob-2" />
        <div className="df-auth-blob df-auth-blob-3" />
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} className={`df-auth-spark df-auth-spark-${index + 1}`} />
        ))}
      </div>

      <div className="df-auth-layout">
        <section className="df-auth-brand" aria-label="Doflow">
          <Link href="/" className="df-auth-logo" aria-label="Vai alla home Doflow">
            <Image
              src="/doflow_logo.svg"
              alt=""
              aria-hidden="true"
              width={178}
              height={89}
              priority
              className="df-auth-logo-img"
            />
          </Link>

          <div className="df-auth-stage">
            <div className="df-auth-mascot-wrap">
              <div className="df-auth-mascot-shadow" />
              <FlowMascot size="min(340px, 70vw)" shy={mascotShy} aria-label="Flow, la mascotte di Doflow" />
            </div>

            <div className="df-auth-tagline">
              <h1>{brandTitle}</h1>
              <p>{brandDescription}</p>
            </div>

            <div className="df-auth-props" aria-label="Valori Doflow">
              {TRUST_PROPS.map((item) => (
                <span key={item.strong} className="df-auth-prop">
                  <span className="df-auth-prop-dot" />
                  <b>{item.strong}</b>&nbsp;{item.rest}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="df-auth-form-side">
          <div className={cn("df-auth-card df-glass-panel", cardClassName)}>
            <div className="df-auth-tabs" data-mode={mode}>
              <span className="df-auth-tab-pill" aria-hidden="true" />
              {onModeChange ? (
                <>
                  <button
                    type="button"
                    className={cn("df-auth-tab", mode === "login" && "active")}
                    aria-pressed={mode === "login"}
                    onClick={() => onModeChange("login")}
                  >
                    Accedi
                  </button>
                  <button
                    type="button"
                    className={cn("df-auth-tab", mode === "register" && "active")}
                    aria-pressed={mode === "register"}
                    onClick={() => onModeChange("register")}
                  >
                    Registrati
                  </button>
                </>
              ) : (
                <>
                  <Link href={loginHref} className={cn("df-auth-tab", mode === "login" && "active")} aria-current={mode === "login" ? "page" : undefined}>
                    Accedi
                  </Link>
                  <Link href={registerHref} className={cn("df-auth-tab", mode === "register" && "active")} aria-current={mode === "register" ? "page" : undefined}>
                    Registrati
                  </Link>
                </>
              )}
            </div>

            <div className="df-auth-head">
              <h2>{title}</h2>
              <p>{description}</p>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
