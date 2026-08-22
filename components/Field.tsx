export function Field({label='YOU',progress=42}:{label?:string;progress?:number}) {
  const x=Math.max(8,Math.min(92,progress));
  return <div className="field" aria-label="Position relative to qualification target">
    <div className="field-grid"/><div className="threshold"><span>TARGET / TOP 1,000</span></div>
    <div className="trail" style={{width:`${x}%`}}/><div className="user-node" style={{left:`${x}%`}}><i/><span>{label}</span></div>
    <div className="asset-row" aria-hidden="true">{[0,1,2,3,4].map(n=><i key={n}/>)}</div>
  </div>;
}
