import type { EventSource } from "../../../../server/visualRadarEventDedup";

export function EventSources({ sources }: { sources: EventSource[] }) {
  return <ul className="vr-event-sources">{sources.map((s, i) => {
    let safe = false;
    try { const url = new URL(s.sourceUrl); safe = ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { /* Invalid links are not clickable. */ }
    return <li key={`${s.itemId}-${i}`}>{safe ? <a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.title} ↗</a> : <span>{s.title}</span>}<small>{s.source}{s.issueId ? ` · ${s.issueId}` : ""}</small></li>;
  })}</ul>;
}
