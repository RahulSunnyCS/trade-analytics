"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthGate, useAuth } from "./AuthGate";
import { useTheme } from "./ThemeProvider";
import { initials, DEMO_USER } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/trading", label: "Trading" },
  { href: "/investment", label: "Investment" },
  { href: "/settings", label: "Settings" },
];

function activeFor(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function TopBar() {
  const pathname = usePathname() || "/";
  const { dark, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const u = user || DEMO_USER;
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="topbar">
      <div className="brand">
        <Link href="/">
          <span className="logo">₹</span>
          <span className="brand-text">Trade Analytics</span>
        </Link>
      </div>
      <div className="nav">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={activeFor(pathname, n.href) ? "active" : ""}
          >
            {n.label}
          </Link>
        ))}
      </div>
      <span className="grow" />
      <button
        className="icon-btn"
        onClick={toggle}
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        {dark ? "☀" : "☾"}
      </button>
      <div id="user-area" ref={wrapRef}>
        <div
          className="user-chip"
          onClick={() => setMenuOpen((o) => !o)}
          role="button"
          tabIndex={0}
        >
          <div className="avatar">{initials(u.name)}</div>
        </div>
        <div id="user-menu" className={menuOpen ? "open" : ""}>
          <div className="u-name">{u.name}</div>
          <div className="u-email">{u.email}</div>
          <button
            className="btn ghost"
            style={{ width: "100%" }}
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <div className="content">{children}</div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}
