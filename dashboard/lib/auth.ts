// Mock "Sign in with Google" persistence. Browser-only (guards window).
// Seam for swapping to Auth.js / NextAuth later — keep the same API.
import type { User } from "@/types";

const KEY = "ta_dash_user";

export const DEMO_USER: User = { name: "Rahul Sunny", email: "rahulsunny13@gmail.com" };

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function signIn(user?: User): User {
  const u = user || DEMO_USER;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(u));
  }
  return u;
}

export function signOut(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

export function initials(name?: string | null): string {
  return (name || "?")
    .split(/\s+/)
    .map((s) => s[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
