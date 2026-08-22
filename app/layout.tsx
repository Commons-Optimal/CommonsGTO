import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Commons Optimal — Don’t waste your seven',
  description: 'Find the mathematically strongest next move in Commons.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
