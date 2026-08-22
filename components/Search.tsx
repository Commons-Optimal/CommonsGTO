'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
export function Search({compact=false}:{compact?:boolean}){
 const [name,setName]=useState(''); const router=useRouter();
 function go(e:FormEvent){e.preventDefault(); const clean=name.trim().replace(/^@/,''); if(clean) router.push('/'+encodeURIComponent(clean));}
 return <form className={`search ${compact?'compact':''}`} onSubmit={go}>
  <span aria-hidden="true">@</span><input aria-label="X username" value={name} onChange={e=>setName(e.target.value)} placeholder="username" autoCapitalize="none" />
  <button type="submit">Analyse position <b>↗</b></button>
 </form>
}
