"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/repurpose", label: "Repurpose" },
  { href: "/connect", label: "Connect" },
  { href: "/platforms", label: "Platforms" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function AppHeader() {
  const pathname = usePathname();

  // Don't show nav on login or auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        {/* Logo / Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "#111827",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "-0.02em",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            M
          </span>
          Meridian
        </Link>

        {/* Navigation */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? "#2563eb" : "#6b7280",
                  background: active ? "#eff6ff" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <Link
          href="/settings/connections"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "#6b7280",
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
        >
          Settings
        </Link>
      </div>
    </header>
  );
}
