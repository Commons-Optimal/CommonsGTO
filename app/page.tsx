import { Search } from '@/components/Search'; import { Field } from '@/components/Field'; import { Footer } from '@/components/Footer';
export default function Home(){return <main className="home">
 <nav><a className="brand" href="/">CO<span>+</span></a><div className="live"><i/> LIVE GAME STATE</div><a href="#method">HOW IT WORKS</a></nav>
 <section className="hero"><div className="hero-copy"><p className="eyebrow">COMMONS VOUCH STRATEGY / 001</p><h1>DON’T WASTE<br/>YOUR <span>SEVEN.</span></h1><p className="dek">Find the mathematically strongest<br/>next move in Commons.</p><Search/></div><div className="hero-field"><Field/><p className="field-note">A LIVE FIELD OF<br/>56,029 PLAYERS</p></div></section>
 <section className="proof" id="method"><p>YOUR SEVEN AREN’T EQUAL.</p><h2>One precise connection<br/>can change everything.</h2><div><span>01 / FIND YOUR GAP</span><span>02 / SEE WHO NEEDS YOU</span><span>03 / MAKE THE OPTIMAL MOVE</span></div></section><Footer/>
 </main>}
