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

const TITLE = 'Common Strategy — 100% Voucher-Owned Commons Treasury';
const DESCRIPTION =
  'Vouch games favour whales. So the commons became one. Every vouch owns a pro-rata slice — 100% pledged to vouchers, founder 0.00%.';

export const metadata: Metadata = {
  metadataBase: new URL('https://commonstrat.xyz'),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Common Strategy',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Common Strategy',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
