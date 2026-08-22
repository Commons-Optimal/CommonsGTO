import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Commons GTO — Vouch market strategy',
  description: 'Find the strongest strategic use of your remaining Commons vouches from the live market state.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
