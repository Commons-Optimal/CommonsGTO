import type { Metadata } from 'next';
import { Bodoni_Moda, IBM_Plex_Mono, Manrope } from 'next/font/google';
import './globals.css';
import './common-strategy.css';

const display = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://commonstrat.xyz'),
  title: 'Common Strategy — 100% Voucher-Owned Commons Treasury',
  description: 'Vouch games favour whales. Common Strategy pools the commons into one account — 100% of any final allocation is pledged pro rata to the people who vouched @commonstrat.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
