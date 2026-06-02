"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getUser, signOut as authSignOut, DEMO_USER } from "@/lib/auth";
import { LoginGate } from "./LoginGate";
import type { User } from "@/types";

type Ctx = {
  user: User | null;
  refresh: () => void;
  signOut: () => void;
};
const AuthCtx = createContext<Ctx>({ user: null, refresh: () => {}, signOut: () => {} });

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    refresh();
    setMounted(true);
  }, [refresh]);

  const signOut = useCallback(() => {
    authSignOut();
    setUser(null);
  }, []);

  // Avoid hydration mismatch: render nothing until we've read localStorage on the client.
  if (!mounted) return null;

  if (!user) {
    return (
      <AuthCtx.Provider value={{ user: null, refresh, signOut }}>
        <LoginGate onSignedIn={refresh} />
      </AuthCtx.Provider>
    );
  }

  return <AuthCtx.Provider value={{ user, refresh, signOut }}>{children}</AuthCtx.Provider>;
}

export function useUser(): User {
  const { user } = useContext(AuthCtx);
  return user || DEMO_USER;
}

export function useAuth(): Ctx {
  return useContext(AuthCtx);
}
