export default function Loading() {
  return <main className="route-loading">
    <div className="loading-nav"><a className="brand" href="/">COMMONS <b>GTO</b></a><span>FETCHING LIVE DATA</span></div>
    <section className="loading-stage">
      <div className="loading-main">
        <small>COMMONS GTO</small>
        <h1>PULLING<br/><em>COMMONS.</em></h1>
        <div className="loading-rail"><i/></div>
        <div className="loading-steps"><span>LEADERBOARD</span><span>LEDGER</span><span>CONNECTIONS</span><span>RANK MATH</span></div>
      </div>
      <div className="loading-side"><i/><i/><i/></div>
    </section>
  </main>;
}
