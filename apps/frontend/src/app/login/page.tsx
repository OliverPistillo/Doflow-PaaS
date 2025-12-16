'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type LoginOkResponse = { token: string };
type LoginErrorResponse = { error: string };
type LoginResponse = LoginOkResponse | LoginErrorResponse;

// API base: in prod metti NEXT_PUBLIC_API_URL="https://api.doflow.it"
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [tenantHost, setTenantHost] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setTenantHost(window.location.host);
  }, []);

  const tenantLabel = useMemo(() => tenantHost || '...', [tenantHost]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const json = JSON.parse(text) as Partial<LoginErrorResponse>;
          if (json?.error) msg = json.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data = JSON.parse(text) as LoginResponse;
      if ('error' in data) throw new Error(data.error);
      if (!('token' in data) || !data.token) throw new Error('Token mancante nella risposta');

      window.localStorage.setItem('doflow_token', data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-gray-600 flex items-center justify-center p-4 md:p-8">
      {/* CARD CONTAINER */}
      <div className="w-full max-w-[1000px] bg-white rounded-[30px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* --- LEFT SIDE (Blue Gradient & Branding) --- */}
        {/* Mobile: Top section / Desktop: Left section */}
        <div className="relative w-full md:w-1/2 bg-gradient-to-br from-[#4facfe] to-[#00f2fe] text-white flex flex-col items-center justify-center p-10 z-10">
          
          {/* Content */}
          <div className="relative z-20 flex flex-col items-center text-center space-y-4">
            <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-80">Welcome to</p>
            
            <div className="relative w-24 h-24 md:w-32 md:h-32 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 mb-2">
               <Image
                src="/logo-transparent-svg.svg"
                alt="Doflow Logo"
                width={80}
                height={80}
                className="object-contain p-2"
                priority
              />
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide">DOFLOW</h1>
            <p className="text-sm opacity-90 max-w-[250px] font-light">
              Piattaforma di gestione multi-tenant intelligente e scalabile.
            </p>
          </div>

          {/* DECORATIVE CURVES (WAVES) */}
          
          {/* Desktop Curve (Vertical wave on the right edge) */}
          <div className="hidden md:block absolute top-0 right-0 bottom-0 w-24 h-full pointer-events-none translate-x-[1px]">
             <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M100 0v100C60 100 0 70 0 50S60 0 100 0z" fill="white" />
             </svg>
          </div>

          {/* Mobile Curve (Horizontal wave on the bottom edge) */}
          <div className="block md:hidden absolute bottom-0 left-0 right-0 h-16 w-full pointer-events-none translate-y-[1px]">
             <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0 100h100V0C100 60 70 100 50 100S0 60 0 0v100z" fill="white" />
             </svg>
          </div>

          {/* Background circles for texture */}
          <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* --- RIGHT SIDE (Form) --- */}
        <div className="w-full md:w-1/2 bg-white p-8 md:p-12 flex flex-col justify-center relative z-0">
          
          <div className="mb-8 mt-4 md:mt-0 text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-800">Accedi</h2>
            <p className="text-sm text-gray-400 mt-1">Inserisci le tue credenziali per continuare</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-sm mx-auto md:mx-0">
            
            {/* EMAIL INPUT STYLE: Underline only */}
            <div className="group">
              <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">
                E-MAIL ADDRESS
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@azienda.it"
                className="w-full py-2 border-b border-gray-300 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-sky-500 transition-colors bg-transparent"
              />
            </div>

            {/* PASSWORD INPUT STYLE: Underline only */}
            <div className="group">
              <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">
                PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2 border-b border-gray-300 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-sky-500 transition-colors bg-transparent"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs animate-pulse">
                {error}
              </div>
            )}

            {/* Tenant Info & Forgot Password */}
            <div className="flex items-center justify-between text-xs mt-2">
               <span className="text-gray-400 font-mono" title={`Host corrente: ${tenantHost}`}>
                 Tenant: {tenantLabel}
               </span>
               <button 
                 type="button"
                 onClick={() => router.push('/forgot-password')}
                 className="text-sky-500 hover:text-sky-700 font-semibold"
               >
                 Recupera password
               </button>
            </div>

            {/* Buttons Area */}
            <div className="pt-6 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-sky-500 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-sky-500/30 hover:bg-sky-600 hover:shadow-sky-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
              >
                {loading ? 'Accesso...' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/auth/accept-invite')}
                className="flex-1 bg-white text-sky-500 font-bold py-3 px-6 rounded-full border border-sky-500 hover:bg-sky-50 transition-colors text-sm uppercase tracking-wide"
              >
                Accept Invite
              </button>
            </div>

            <div className="mt-6 text-center">
               <p className="text-[10px] text-gray-400">
                 Facendo login accetti i <a href="#" className="text-sky-500 underline">Termini & Condizioni</a> di Doflow.
               </p>
            </div>

          </form>
        </div>
      </div>
    </main>
  );
}