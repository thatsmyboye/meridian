"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import styles from "./AppHeader.module.css";

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

export default function AppHeader({
  isLoggedIn,
  userDisplay,
}: {
  isLoggedIn: boolean;
  userDisplay?: string | null;
}) {
  const pathname = usePathname();

  // Don't show nav on login or auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Logo / Brand */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBadge}>M</span>
          Meridian
        </Link>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? `${styles.navLink} ${styles.navLinkActive}`
                    : styles.navLink
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Account status + Settings + Sign out */}
        <div className={styles.actions}>
          {!isLoggedIn && (
            <Link href="/login" className={styles.loginLink}>
              Log In
            </Link>
          )}
          {isLoggedIn && userDisplay && (
            <span className={styles.userStatus} title={userDisplay}>
              {userDisplay}
            </span>
          )}
          <Link href="/settings/connections" className={styles.actionLink}>
            Settings
          </Link>
          {isLoggedIn && (
            <form action={signOut}>
              <button type="submit" className={styles.signOutButton}>
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
