"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm() {
  const [username, setUsername] = useState("");
  const router = useRouter();
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = username.trim().replace(/^@/, "");
    if (clean) router.push(`/${encodeURIComponent(clean)}`);
  }
  return <form className="search" onSubmit={submit}>
    <label htmlFor="username">X USERNAME</label>
    <div><span>@</span><input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Cyphrgm" autoComplete="off" /><button>ANALYSE <i>→</i></button></div>
  </form>;
}
