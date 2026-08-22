'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function Search({compact=false,label='START MATCHING'}:{compact?:boolean;label?:string}){
 const [name,setName]=useState('');
 const [loading,setLoading]=useState(false);
 const router=useRouter();
 function go(e:FormEvent){
  e.preventDefault();
  const clean=name.trim().replace(/^@/,'');
  if(!clean||loading) return;
  setLoading(true);
  router.push('/'+encodeURIComponent(clean));
 }
 return <form className={`search ${compact?'compact':''}`} onSubmit={go} aria-busy={loading}>
  <span aria-hidden="true">@</span>
  <input aria-label="X username" value={name} onChange={e=>setName(e.target.value)} placeholder="username" autoCapitalize="none" disabled={loading}/>
  <button type="submit" disabled={loading}>{loading?'LOADING…':label} <b>{loading?'':'↗'}</b></button>
 </form>
}
