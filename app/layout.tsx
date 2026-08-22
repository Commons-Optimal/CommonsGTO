import type { Metadata } from "next";
import Link from "next/link";
import { CREATOR } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commons Optimal — Don't waste your five",
  description: "Mathematically efficient moves from the current Commons game state.",
};

const creatorIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Hey @commonsmade, I vouch for @${CREATOR}`)}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header className="shell header"><Link href="/" className="wordmark"><i /> COMMONS OPTIMAL</Link><span className="live"><b /> STRATEGY LAYER</span></header>
    <main>{children}</main>
    <footer className="shell footer"><span>Independent tool. Not affiliated with Commons.</span><span>Built by <a href={`https://x.com/${CREATOR}`} target="_blank">@{CREATOR}</a> · <a href={creatorIntent} target="_blank">Vouch the creator ↗</a></span></footer>
  </body></html>;
}
