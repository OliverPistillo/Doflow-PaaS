"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CircleCheck,
  FileText,
  Funnel,
  Trophy,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";

import FlowMascot from "./flow-mascot";

type LoginExperienceProps = {
  mascotShy?: boolean;
  children: React.ReactNode;
};

const PIPELINE_STEPS = [
  { label: "Lead", icon: UserRound, className: "df-login-step-lead" },
  { label: "Contatto", icon: UsersRound, className: "df-login-step-contact" },
  { label: "Proposta", icon: FileText, className: "df-login-step-proposal" },
  { label: "Cliente", icon: Trophy, className: "df-login-step-client" },
];

const BENEFITS = [
  {
    title: "Gestisci i clienti",
    lines: ["Tutte le informazioni", "che ti servono, in un", "unico posto."],
    icon: UsersRound,
  },
  {
    title: "Segui il pipeline",
    lines: ["Visualizza ogni", "opportunità e non", "lasciare nulla al caso."],
    icon: Funnel,
  },
  {
    title: "Organizza le attività",
    lines: ["Pianifica, assegna e", "tieni tutto il team", "allineato."],
    icon: CircleCheck,
  },
  {
    title: "Automatizza i processi",
    lines: ["Risparmia tempo con", "automazioni intelligenti", "senza complessità."],
    icon: Zap,
  },
];

function LoginCrmShowcase({ mascotShy = false }: { mascotShy?: boolean }) {
  return (
    <section className="df-login-showcase" aria-hidden="true">
      <svg
        className="df-login-pipeline"
        viewBox="0 0 1040 610"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="df-login-pipeline-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#dce9ff" />
            <stop offset="0.52" stopColor="#9ec3ff" />
            <stop offset="1" stopColor="#b9adff" />
          </linearGradient>
          <filter id="df-login-pipeline-glow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          className="df-login-pipeline-base"
          d="M 0 520 C 150 510, 205 548, 310 490 S 470 410, 565 365 S 720 350, 800 340 S 930 276, 1040 242"
        />
        <path
          className="df-login-pipeline-accent"
          d="M 0 520 C 150 510, 205 548, 310 490 S 470 410, 565 365 S 720 350, 800 340 S 930 276, 1040 242"
          filter="url(#df-login-pipeline-glow)"
        />
        {[
          [135, 514],
          [350, 468],
          [770, 338],
          [960, 263],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="18" fill="#ffffff" opacity="0.96" />
            <circle cx={cx} cy={cy} r="12" fill="url(#df-login-pipeline-gradient)" />
          </g>
        ))}
      </svg>

      <div className="df-login-mascot">
        <span className="df-login-mascot-shadow" />
        <FlowMascot
          size="100%"
          shy={mascotShy}
          aria-label="Flow, la mascotte di Doflow"
        />
      </div>

      <div className="df-login-step-list">
        {PIPELINE_STEPS.map(({ label, icon: Icon, className }, index) => (
          <article key={label} className={`df-login-step-card ${className}`}>
            <span className="df-login-step-icon">
              <Icon size={24} strokeWidth={1.9} />
            </span>
            <strong>{label}</strong>
            <span className="df-login-step-line df-login-step-line-long" />
            <span className="df-login-step-line" />
            {index === 0 && <span className="df-login-step-line df-login-step-line-short" />}
          </article>
        ))}
      </div>

      <div className="df-login-benefits">
        {BENEFITS.map(({ title, lines, icon: Icon }) => (
          <article key={title} className="df-login-benefit">
            <span className="df-login-benefit-icon">
              <Icon size={24} strokeWidth={1.8} />
            </span>
            <strong>{title}</strong>
            <p>
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LoginExperience({ mascotShy = false, children }: LoginExperienceProps) {
  return (
    <main className="df-login-page">
      <div className="df-login-ambient" aria-hidden="true" />

      <Link href="/" className="df-login-logo" aria-label="Vai alla home Doflow">
        <Image
          src="/doflow_logo.svg"
          alt="Doflow"
          width={178}
          height={89}
          priority
          className="df-auth-logo-img"
        />
      </Link>

      <section className="df-login-card" aria-labelledby="df-login-title">
        <header className="df-login-head">
          <h1 id="df-login-title">Bentornato</h1>
          <p>Accedi al tuo spazio di lavoro</p>
        </header>
        {children}
      </section>

      <LoginCrmShowcase mascotShy={mascotShy} />
    </main>
  );
}
