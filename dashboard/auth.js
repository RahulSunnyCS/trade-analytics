// Mock "Sign in with Google" gate. Persists a fake user in localStorage.
// Seam for later: signIn()/getUser()/signOut() swap to Google Identity Services (standalone)
// or Auth.js / NextAuth (Next.js round) with the SAME calls — the UI gate is unchanged.
(function (global) {
  "use strict";
  const KEY = "ta_dash_user";
  const DEMO_USER = { name: "Rahul Sunny", email: "rahulsunny13@gmail.com" };

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      return null;
    }
  }
  function signIn(user) {
    const u = user || DEMO_USER;
    localStorage.setItem(KEY, JSON.stringify(u));
    return u;
  }
  function signOut() {
    localStorage.removeItem(KEY);
  }
  function initials(name) {
    return (name || "?")
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  global.Auth = { getUser, signIn, signOut, initials, DEMO_USER };
})(window);
