import type { Metadata } from 'next';
import FedericaClientLayout from './FedericaClientLayout';

export const metadata: Metadata = {
  title: 'Federica Nerone · Doflow',
  icons: {
    icon: '/federicanerone/favicon.ico',
  },
};

export default function FedericaLayout({ children }: { children: React.ReactNode }) {
  return <FedericaClientLayout>{children}</FedericaClientLayout>;
}
