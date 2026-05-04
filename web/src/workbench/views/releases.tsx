import { I } from "../icons";
import { Topbar } from "../Shell";
import { useApiData } from "../useApiData";
import { api } from "@/lib/api";

export function ReleasesView() {
  const data = useApiData(() => api.getReleaseHistory(), []);
  const releases = data.data?.releases ?? [];
  const preflight = data.data?.preflight;
  const live = releases.filter(r => r.status === "confirmed");

  return (
    <>
      <Topbar crumbs={["__WS__", "Admin", "Releases"]}
        actions={<button className="top-btn" onClick={() => data.refresh()}><I.refresh size={13}/> Refresh</button>}/>
      <div style={{ padding: "26px 28px 60px", maxWidth: 1180 }}>
        <div className="kicker">DEPLOYMENTS</div>
        <h1 className="h1" style={{ fontSize: 28, marginTop: 4, marginBottom: 4 }}>Releases</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {live.length} confirmed release{live.length === 1 ? "" : "s"} · {releases.length} total in history.
        </p>

        {preflight && (
          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>RELEASE READINESS</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
              <span><span className="mono" style={{ color: "var(--green)" }}>{preflight.passedEvidence}</span> evidence passed</span>
              <span><span className="mono" style={{ color: "var(--warn)" }}>{preflight.pendingEvidence}</span> pending</span>
              <span><span className="mono" style={{ color: "var(--danger)" }}>{preflight.failedEvidence}</span> failed</span>
              <span><span className="mono" style={{ color: "var(--warn)" }}>{preflight.openBlockers}</span> open blockers</span>
              <span><span className="mono">{preflight.openQuestions}</span> open questions</span>
              <span style={{ marginLeft: "auto" }}>
                {preflight.ready
                  ? <span className="pill good"><span className="dot"></span>ready to ship</span>
                  : <span className="pill warn"><span className="dot"></span>not ready</span>}
              </span>
            </div>
          </div>
        )}

        <div className="kicker" style={{ marginBottom: 8 }}>RELEASE HISTORY</div>
        {data.loading && <div className="muted">Loading…</div>}
        {data.error && <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{data.error}</div>}
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead><tr><th>Version</th><th>Status</th><th>Summary</th><th>Confirmed by</th><th>Confirmed at</th></tr></thead>
            <tbody>
              {releases.map(r => (
                <tr key={r.id}>
                  <td className="mono" style={{ color: "var(--silver-50)", fontWeight: 500 }}>{r.versionLabel}</td>
                  <td>
                    {r.status === "confirmed" && <span className="pill good"><span className="dot"></span>confirmed</span>}
                    {r.status === "rolled_back" && <span className="pill danger"><span className="dot"></span>rolled back</span>}
                    {r.status === "pending" && <span className="pill warn"><span className="dot"></span>pending</span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{r.summary}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{r.confirmedBy || "—"}</td>
                  <td className="mono muted" style={{ fontSize: 11.5 }}>{r.confirmedAt ? new Date(r.confirmedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {releases.length === 0 && !data.loading && <tr><td colSpan={5} className="muted" style={{ padding: 18, textAlign: "center" }}>No release history.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
