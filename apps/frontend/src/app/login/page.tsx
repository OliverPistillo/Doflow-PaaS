import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center px-4 bg-muted/40">
      <Suspense fallback={<div>Caricamento...</div>}>
         <LoginForm />
      </Suspense>
    </div>
  );
}