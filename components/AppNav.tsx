"use client";

// Persistent top nav — fixes the "couldn't find Cards" problem by giving every
// page a consistent header with links to the main flows + logout.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api/browser";
import styles from "./AppNav.module.css";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/receipts", label: "Receipts" },
  { href: "/cards", label: "Cards" },
];

export function AppNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  // Hide the app nav on the marketing/auth surfaces.
  const hidden =
    pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup");
  if (hidden) return null;

  async function logout() {
    await api.logout();
    router.push("/login");
  }

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">◎</span>
          <span>Cashback Optimizer</span>
        </Link>
        <nav className={styles.links}>
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[styles.link, active ? styles.active : ""].filter(Boolean).join(" ")}
              >
                {l.label}
              </Link>
            );
          })}
          <button onClick={logout} className={styles.logout}>
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
