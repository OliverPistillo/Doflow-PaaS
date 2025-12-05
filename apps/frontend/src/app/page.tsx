import { redirect } from 'next/navigation';

export default function RootPage() {
  // Root = redirect diretto alla pagina di login pubblica
  redirect('/login');
}
