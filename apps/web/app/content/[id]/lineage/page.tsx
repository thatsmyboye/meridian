import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formatNumber, formatDate, PLATFORM_BADGE } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlatItem = {
  id: string;
  title: string;
  platform: string;
  published_at: string;
  parent_content_item_id: string | null;
};

type TreeNode = FlatItem & {
  views: number | null;
  engagementRate: number | null;
  children: TreeNode[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively sum views across an entire subtree. */
function sumViews(node: TreeNode): number {
  return (node.views ?? 0) + node.children.reduce((acc, c) => acc + sumViews(c), 0);
}

/** Count all nodes in the subtree (including root). */
function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((acc, c) => acc + countNodes(c), 0);
}

/** Collect all distinct platforms across the subtree. */
function collectPlatforms(node: TreeNode, out = new Set<string>()): Set<string> {
  out.add(node.platform);
  node.children.forEach((c) => collectPlatforms(c, out));
  return out;
}

/** Build the tree structure from a flat map of items. */
function buildTree(
  nodeId: string,
  allNodes: Map<string, FlatItem>,
  viewsMap: Map<string, { views: number | null; engagementRate: number | null }>,
): TreeNode {
  const node = allNodes.get(nodeId)!;
  const metrics = viewsMap.get(nodeId) ?? { views: null, engagementRate: null };

  const children = Array.from(allNodes.values())
    .filter((n: FlatItem) => n.parent_content_item_id === nodeId)
    .sort((a: FlatItem, b: FlatItem) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
    .map((c: FlatItem) => buildTree(c.id, allNodes, viewsMap));

  return { ...node, ...metrics, children };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContentLineagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) notFound();

  // ── Step 1: Walk up the parent chain to find the tree root ──
  // Uses a single recursive CTE (find_content_root) to traverse the full
  // ancestor chain in one DB round-trip instead of N sequential queries.
  const { data: rootData } = await supabase.rpc("find_content_root", {
    p_item_id: id,
    p_creator_id: creator.id,
  });

  const rootId: string = rootData ?? id;

  // ── Step 2: BFS downward from root to collect the full descendant tree ──
  const allNodes = new Map<string, FlatItem>();
  let frontier: string[] = [rootId];
  const visited = new Set<string>();

  while (frontier.length > 0) {
    const toFetch = frontier.filter((fid) => !visited.has(fid));
    if (toFetch.length === 0) break;
    toFetch.forEach((fid) => visited.add(fid));

    // Fetch the frontier nodes themselves (in case they weren't loaded by the children query)
    const { data: nodes } = await supabase
      .from("content_items")
      .select("id, title, platform, published_at, parent_content_item_id")
      .in("id", toFetch)
      .eq("creator_id", creator.id);

    if (!nodes || nodes.length === 0) break;
    nodes.forEach((n) => allNodes.set(n.id, n));

    // Fetch all direct children of the current frontier
    const { data: children } = await supabase
      .from("content_items")
      .select("id, title, platform, published_at, parent_content_item_id")
      .in("parent_content_item_id", toFetch)
      .eq("creator_id", creator.id);

    if (!children || children.length === 0) break;

    children.forEach((n) => allNodes.set(n.id, n));
    frontier = children.filter((c) => !visited.has(c.id)).map((c) => c.id);
  }

  if (!allNodes.has(rootId)) notFound();

  // ── Step 3: Fetch performance snapshots for every node in the tree ──
  const allIds = Array.from(allNodes.keys());

  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("content_item_id, day_mark, views, engagement_rate")
    .in("content_item_id", allIds);

  // For each item, keep the snapshot with the highest day_mark (most mature data).
  const viewsMap = new Map<string, { views: number | null; engagementRate: number | null }>();
  const dayMarkSeen = new Map<string, number>();

  for (const snap of snapshots ?? []) {
    const mark = snap.day_mark ?? 0;
    const prev = dayMarkSeen.get(snap.content_item_id) ?? -1;
    if (mark > prev) {
      dayMarkSeen.set(snap.content_item_id, mark);
      viewsMap.set(snap.content_item_id, {
        views: snap.views,
        engagementRate: snap.engagement_rate,
      });
    }
  }

  // ── Step 4: Build the tree and compute summary stats ──
  const rootNode = buildTree(rootId, allNodes, viewsMap);
  const totalViews = sumViews(rootNode);
  const totalVersions = countNodes(rootNode);
  const platforms = collectPlatforms(rootNode);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* ── Back link ── */}
      <Link
        href={`/content/${id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "#6b7280",
          fontSize: 14,
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        ← Back to content detail
      </Link>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 6px",
            color: "#111827",
          }}
        >
          Content Lineage
        </h1>
        <p
          style={{
            color: "#6b7280",
            fontSize: 14,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Full repurposing tree rooted at{" "}
          <Link
            href={`/content/${rootId}`}
            style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
          >
            {rootNode.title}
          </Link>
        </p>
      </div>

      {/* ── Summary stat cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="Total combined views"
          value={totalViews > 0 ? formatNumber(totalViews) : "—"}
          sub="across all versions"
        />
        <StatCard
          label="Total versions"
          value={String(totalVersions)}
          sub="original + all derivatives"
        />
        <StatCard
          label="Platforms reached"
          value={String(platforms.size)}
          sub={Array.from(platforms).join(", ")}
        />
      </div>

      {/* ── Tree view ── */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f3f4f6",
            background: "#f9fafb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#374151" }}>
            Lineage tree
          </h2>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {totalVersions} {totalVersions === 1 ? "piece" : "pieces"} · click any node for
            details
          </span>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <TreeNodeRow node={rootNode} depth={0} currentId={id} isLast={true} />
        </div>
      </section>
    </main>
  );
}

// ─── Tree node renderer (recursive) ──────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  currentId,
  isLast,
  ancestorIsLast = [],
}: {
  node: TreeNode;
  depth: number;
  currentId: string;
  isLast: boolean;
  ancestorIsLast?: boolean[];
}) {
  const badge = PLATFORM_BADGE[node.platform] ?? { bg: "#f3f4f6", color: "#374151" };
  const isRoot = depth === 0;
  const isCurrent = node.id === currentId;
  const hasChildren = node.children.length > 0;

  // Build the indentation prefix using pipe characters for each ancestor level.
  // We skip pipes for ancestors that were the last child at their level.
  const prefixCols = depth > 0 ? ancestorIsLast.slice(0, depth - 1) : [];

  return (
    <div>
      {/* ── Node row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          marginBottom: 6,
        }}
      >
        {/* Indentation columns */}
        {depth > 0 && (
          <div style={{ display: "flex", flexShrink: 0 }}>
            {/* Ancestor continuation lines */}
            {prefixCols.map((last, i) => (
              <div
                key={i}
                style={{
                  width: 24,
                  borderLeft: last ? "none" : "1px solid #e5e7eb",
                  marginLeft: 8,
                }}
              />
            ))}
            {/* Connector for current node */}
            <div
              style={{
                width: 24,
                marginLeft: 8,
                position: "relative",
                flexShrink: 0,
              }}
            >
              {/* Vertical line (only to mid-point if last child) */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: isLast ? "50%" : 0,
                  borderLeft: "1px solid #e5e7eb",
                }}
              />
              {/* Horizontal connector */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  width: "100%",
                  borderTop: "1px solid #e5e7eb",
                }}
              />
            </div>
          </div>
        )}

        {/* Node card */}
        <Link
          href={`/content/${node.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            border: "1px solid",
            borderColor: isCurrent ? "#bfdbfe" : "#e5e7eb",
            borderRadius: 8,
            background: isCurrent ? "#eff6ff" : isRoot ? "#f9fafb" : "#fff",
            textDecoration: "none",
            color: "inherit",
            gap: 10,
          }}
        >
          {/* Left: tags + title + date */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
                flexWrap: "wrap",
              }}
            >
              {isRoot && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#374151",
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    padding: "1px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Original
                </span>
              )}
              {isCurrent && !isRoot && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#1d4ed8",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    padding: "1px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Viewing
                </span>
              )}
              <span
                style={{
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 4,
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "capitalize",
                }}
              >
                {node.platform}
              </span>
              <span style={{ color: "#9ca3af", fontSize: 11 }}>{formatDate(node.published_at)}</span>
            </div>

            <div
              style={{
                fontWeight: 500,
                fontSize: 14,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {node.title}
            </div>

            {hasChildren && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                {node.children.length} derivative{node.children.length !== 1 ? "s" : ""}
                {" · "}
                {formatNumber(sumViews(node))} total views
              </div>
            )}
          </div>

          {/* Right: metrics */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {node.views != null ? (
              <>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatNumber(node.views)}{" "}
                  <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 12 }}>views</span>
                </div>
                {node.engagementRate != null && (
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {node.engagementRate.toFixed(2)}% eng.
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#d1d5db" }}>No data</div>
            )}
          </div>

          {/* Arrow */}
          <span
            style={{
              color: "#d1d5db",
              fontSize: 16,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ›
          </span>
        </Link>
      </div>

      {/* ── Children ── */}
      {node.children.map((child, i) => {
        const childIsLast = i === node.children.length - 1;
        return (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            currentId={currentId}
            isLast={childIsLast}
            ancestorIsLast={[...ancestorIsLast, isLast]}
          />
        );
      })}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: "#111827" }}>
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
