import type { Metadata } from 'next';
import './globals.css';
import './gto-v2.css';

export const metadata: Metadata = {
  title: 'Commons GTO',
  description: 'Live Commons ranks, vouch values, trade outcomes and seven-vouch planning.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
