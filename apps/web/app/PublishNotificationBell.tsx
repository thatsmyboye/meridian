"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublishNotification {
  id: string;
  type: "published" | "failed_publish";
  repurpose_job_id: string;
  format_key: string;
  platform_label: string;
  content_title: string | null;
  external_url: string | null;
  retry_url: string | null;
  read_at: string | null;
  created_at: string;
}

interface Props {
  creatorId: string;
  /** Pre-fetched notifications from the server render (SSR hydration). */
  initialNotifications: PublishNotification[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PublishNotificationBell({ creatorId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState<PublishNotification[]>(initialNotifications);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`publish-notifications:${creatorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "publish_notifications",
          filter: `creator_id=eq.${creatorId}`,
        },
        (payload) => {
          const newNotif = payload.new as PublishNotification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId]);

  // ── Close dropdown when clicking outside ──────────────────────────────────
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Mark a single notification as read ────────────────────────────────────
  async function markRead(notifId: string) {
    const supabase = createBrowserClient();
    const now = new Date().toISOString();

    await supabase
      .from("publish_notifications")
      .update({ read_at: now })
      .eq("id", notifId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read_at: now } : n))
    );
  }

  // ── Mark all as read when dropdown opens ──────────────────────────────────
  async function handleOpen() {
    setOpen((v) => !v);

    const unread = notifications.filter((n) => !n.read_at);
    if (!open && unread.length > 0) {
      const supabase = createBrowserClient();
      const now = new Date().toISOString();
      const ids = unread.map((n) => n.id);

      await supabase
        .from("publish_notifications")
        .update({ read_at: now })
        .in("id", ids);

      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n))
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        style={{
          position: "relative",
          background: "none",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 10px",
          color: "#374151",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#dc2626",
              borderRadius: "50%",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="Publish notifications"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 340,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
              Publish notifications
            </span>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} notification={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification: n,
  onRead,
}: {
  notification: PublishNotification;
  onRead: (id: string) => void;
}) {
  const isSuccess = n.type === "published";
  const accentColor = isSuccess ? "#16a34a" : "#dc2626";
  const isUnread = !n.read_at;

  const title = n.content_title ?? "Content";
  const label = isSuccess ? "Published" : "Failed to publish";

  const actionHref = isSuccess ? (n.external_url ?? null) : (n.retry_url ?? null);
  const actionLabel = isSuccess ? "View post →" : "Retry →";

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #f8fafc",
        background: isUnread ? "#fafbff" : "#fff",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      {/* Status dot */}
      <span
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: accentColor,
          marginTop: 5,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: accentColor,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {label}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto", whiteSpace: "nowrap" }}>
            {timeAgo(n.created_at)}
          </span>
        </div>

        <div
          style={{
            fontSize: 13,
            color: "#0f172a",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 2,
          }}
          title={title}
        >
          {title}
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginBottom: actionHref ? 6 : 0 }}>
          {n.platform_label}
        </div>

        {actionHref && (
          <Link
            href={actionHref}
            target={isSuccess ? "_blank" : undefined}
            rel={isSuccess ? "noopener noreferrer" : undefined}
            onClick={() => { if (isUnread) onRead(n.id); }}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: accentColor,
              textDecoration: "none",
            }}
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
