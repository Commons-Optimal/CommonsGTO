import type { Metadata } from 'next';
import './globals.css';
import './gto-v2.css';
import './gto-v3.css';

export const metadata: Metadata = {
  title: 'Commons GTO',
  description: 'Live Commons ranks, vouch values, network paths and trade outcomes.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
