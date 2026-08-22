import Link from "next/link";

export default function NotFound() {
  return <div className="shell empty"><p className="eyebrow">NO RESULT</p><h1>User not found.</h1><p>They may not have joined Commons yet, or the username may be misspelled.</p><Link href="/">← TRY ANOTHER USER</Link></div>;
}
