export function Field({focused=false}:{focused?:boolean}){
 const nodes=[['13','18','2'],['73','13','1'],['88','39','3'],['22','75','4'],['78','81','5'],['46','27','6'],['57','73','7'],['8','48','8']];
 return <div className={`field ${focused?'focused':''}`} aria-hidden="true">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M13 18L50 51L73 13M50 51L88 39M50 51L78 81M50 51L57 73M50 51L22 75M8 48L50 51M46 27L50 51" />
  <path className="threshold" d="M3 63 Q50 55 97 63" /></svg>
  {nodes.map(([x,y,n])=><i key={n} style={{left:x+'%',top:y+'%',animationDelay:`${+n*.23}s`}}><em>{n==='2'?'+70.5k':''}</em></i>)}
  <div className="core"><span>YOU</span></div><div className="cutoff-label">TOP 1,000 <span>467.7K</span></div>
 </div>
}
