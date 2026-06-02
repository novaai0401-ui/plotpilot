import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { KNOWN_EVENT_TYPES, labelForEvent, EVENT_LABELS } from "@/lib/audit-log/events";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser([...BROKER_ROLES, "super_admin"]);

  const typeFilter = typeof searchParams?.type === "string" ? searchParams.type : "";
  const actorFilter = typeof searchParams?.actor === "string" ? searchParams.actor : "";
  const fromFilter = typeof searchParams?.from === "string" ? searchParams.from : "";
  const toFilter = typeof searchParams?.to === "string" ? searchParams.to : "";
  const cursor = typeof searchParams?.cursor === "string" ? searchParams.cursor : "";

  const where: any = { orgId: user.orgId };
  if (typeFilter) where.type = typeFilter;
  if (actorFilter) where.actorId = actorFilter;
  const dateRange: any = {};
  if (fromFilter) dateRange.gte = new Date(fromFilter);
  if (toFilter) dateRange.lte = new Date(toFilter + "T23:59:59.999Z");
  if (Object.keys(dateRange).length) where.createdAt = dateRange;

  const [events, total, actors] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1, // fetch one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.analyticsEvent.count({ where }),
    prisma.user.findMany({
      where: { orgId: user.orgId, role: { in: ["broker_admin", "broker_agent", "super_admin"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const hasNextPage = events.length > PAGE_SIZE;
  const pageEvents = hasNextPage ? events.slice(0, PAGE_SIZE) : events;
  const nextCursor = hasNextPage ? events[PAGE_SIZE - 1].id : null;

  const actorMap = new Map(actors.map((a) => [a.id, a]));

  // Reconstruct the query string for "Download CSV" link (excludes cursor)
  const csvParams = new URLSearchParams();
  if (typeFilter) csvParams.set("type", typeFilter);
  if (actorFilter) csvParams.set("actor", actorFilter);
  if (fromFilter) csvParams.set("from", fromFilter);
  if (toFilter) csvParams.set("to", toFilter);
  const csvHref = `/api/audit-log/export?${csvParams.toString()}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-gray-500 text-sm mt-1">
            Every meaningful action in your organization. Append-only — no edits, no deletes.
          </p>
        </div>
        <a
          href={csvHref}
          className="text-xs px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
          title="Download filtered events as CSV (same filters as the table below)"
        >
          ⬇ Download filtered CSV
        </a>
      </div>

      {/* Filter form — all server-side via URL params */}
      <form method="get" className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div>
          <label className="block text-xs font-medium mb-1">Type</label>
          <select name="type" defaultValue={typeFilter} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">All types</option>
            {groupEventTypes().map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.types.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_LABELS[t]?.label || t}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Actor</label>
          <select name="actor" defaultValue={actorFilter} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">All actors</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.email ? ` (${a.email})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input type="date" name="from" defaultValue={fromFilter} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input type="date" name="to" defaultValue={toFilter} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="bg-brand text-white px-3 py-1.5 rounded text-sm">
            Apply
          </button>
          <Link href="/dashboard/audit-log" className="text-xs text-gray-500 hover:underline self-center">
            Clear
          </Link>
        </div>
      </form>

      <div className="text-xs text-gray-500">
        {total.toLocaleString()} {total === 1 ? "event" : "events"} match
        {typeFilter || actorFilter || fromFilter || toFilter ? " (filtered)" : ""}.
        {hasNextPage && ` Showing first ${PAGE_SIZE}.`}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left w-44">When</th>
              <th className="p-3 text-left">Event</th>
              <th className="p-3 text-left">Actor</th>
              <th className="p-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {pageEvents.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  No events match these filters.
                </td>
              </tr>
            )}
            {pageEvents.map((e) => {
              const lbl = labelForEvent(e.type);
              const actor = e.actorId ? actorMap.get(e.actorId) : null;
              const metaStr = e.metadata ? JSON.stringify(e.metadata) : "";
              const metaPreview = metaStr.length > 80 ? metaStr.slice(0, 80) + "…" : metaStr;
              return (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className="mr-1">{lbl.emoji}</span>
                    <span className="font-medium">{lbl.label}</span>
                    <span className="text-xs text-gray-400 ml-2 font-mono">{e.type}</span>
                  </td>
                  <td className="p-3 text-gray-700">
                    {actor ? actor.name : <span className="text-gray-400 italic">system</span>}
                  </td>
                  <td className="p-3 text-xs font-mono text-gray-500 break-all" title={metaStr}>
                    {metaPreview || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasNextPage && nextCursor && (
        <div className="flex justify-center">
          <Link
            href={`?${new URLSearchParams({
              ...(typeFilter ? { type: typeFilter } : {}),
              ...(actorFilter ? { actor: actorFilter } : {}),
              ...(fromFilter ? { from: fromFilter } : {}),
              ...(toFilter ? { to: toFilter } : {}),
              cursor: nextCursor,
            }).toString()}`}
            className="text-sm px-4 py-2 border rounded bg-white hover:bg-gray-50"
          >
            Next page →
          </Link>
        </div>
      )}
    </div>
  );
}

function groupEventTypes(): { group: string; types: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const t of KNOWN_EVENT_TYPES) {
    const g = EVENT_LABELS[t]?.group ?? "Other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(t);
  }
  return Array.from(groups, ([group, types]) => ({ group, types }));
}
