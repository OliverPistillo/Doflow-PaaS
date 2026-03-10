import { redirect } from 'next/navigation';

export default function FinanceBasePage() {
  // La route base /superadmin/finance nativamente non ha contenuti. 
  // Redirigiamo l'utente direttamente alla sezione fatture (o dashboard se richiesto in futuro)
  redirect('/superadmin/finance/invoices');
}
