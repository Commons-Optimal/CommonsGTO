import type { Metadata } from 'next';
import { Azeret_Mono, Newsreader, Unbounded } from 'next/font/google';
import './globals.css';
import './common-strategy.css';
import './common-strategy-identity.css';

const editorial = Newsreader({
  subsets: ['latin'],
  variable: '--font-editorial',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
});

const brand = Unbounded({
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const mono = Azeret_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Common Strategy — The Commons Treasury Company',
  description: '100% of any Commons allocation received is pledged pro rata to the accounts that vouched @commonstrat.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${editorial.variable} ${brand.variable} ${mono.variable}`}>{children}</body></html>;
}
