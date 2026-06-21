"use client";

import * as React from "react";
import Link from "next/link";
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
            <svg className="df-auth-logo-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="dfAuthLogoGradient" x1="4" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                  <stop stopColor="hsl(var(--chart-4))" />
                  <stop offset="1" stopColor="hsl(var(--primary))" />
                </linearGradient>
              </defs>
              <path
                d="M9 5c0-1 1-1.6 2-1.2 12 4 18 9 18 16.7C29 30 21 37 10 37c-1 0-2-.9-2-2V5z"
                fill="url(#dfAuthLogoGradient)"
              />
              <path d="M14 12c8 1 11 4 11 8.5S22 28 15 29c4-3 5-5.4 5-8.5S18 14.5 14 12z" fill="hsl(240 12% 5%)" />
            </svg>
            <span>
              <span className="df-auth-logo-do">Do</span>
              <span className="df-auth-logo-flow">flow</span>
            </span>
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
              <Link href="/login" className={cn("df-auth-tab", mode === "login" && "active")} aria-current={mode === "login" ? "page" : undefined}>
                Accedi
              </Link>
              <Link href={registerHref} className={cn("df-auth-tab", mode === "register" && "active")} aria-current={mode === "register" ? "page" : undefined}>
                Registrati
              </Link>
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
