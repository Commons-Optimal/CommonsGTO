import type { Metadata } from 'next';
import './globals.css';
import './gto-v2.css';
import './gto-v3.css';
import './match.css';
import './match-home.css';
import './match-premium.css';

export const metadata: Metadata = {
  title: 'Commons Match — Vouch / Pass',
  description: 'Swipe Commons players. A mutual vouch opens the deal.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
