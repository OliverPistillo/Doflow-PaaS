'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';

type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
type JwtPayload = { email?: string; role?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;

    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;

    return {
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
    };
  } catch {
    return null;
  }
}

function mapRoleToLayoutRole(role?: string): LayoutRole {
  const r = (role ?? '').toLowerCase();
  if (r === 'owner' || r === 'superadmin' || r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  return 'USER';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('utente');
  const [role, setRole] = React.useState<LayoutRole>('USER');

  React.useEffect(() => {
    const token = window.localStorage.getItem('doflow_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const payload = parseJwtPayload(token);
    if (payload?.email) setEmail(payload.email);
    setRole(mapRoleToLayoutRole(payload?.role));
  }, [router]);

  return (
    <DashboardLayout role={role} userEmail={email}>
      {children}
    </DashboardLayout>
  );
}
