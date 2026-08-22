import type { Metadata } from 'next';
import './globals.css';
import './gto-v2.css';
import './gto-v3.css';
import './match.css';
import './match-home.css';
import './match-premium.css';
import './common-strategy.css';

export const metadata: Metadata = {
  title: 'Common Strategy — The Commons Treasury Company',
  description: '100% of any Commons allocation received is pledged pro rata to the accounts that vouched Common Strategy.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
