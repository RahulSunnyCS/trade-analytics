"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Mailbox } from "@/types";
import { MOCK_ACCOUNTS } from "@/lib/mocks/accounts";

const KEY = "ta_dash_accounts";
const BROKERS = ["finvasia", "angelone", "fyers", "kite"];

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function loadInitial(): Mailbox[] {
  if (typeof window === "undefined") return clone(MOCK_ACCOUNTS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Mailbox[];
  } catch {
    /* ignore */
  }
  return clone(MOCK_ACCOUNTS);
}

function letterToColumn(letter: string): number {
  let col = 0;
  const up = letter.toUpperCase();
  for (let i = 0; i < up.length; i++) col = col * 26 + (up.charCodeAt(i) - 64);
  return col;
}

export function validate(model: Mailbox[]): string[] {
  const issues: string[] = [];
  model.forEach((mb, mi) => {
    if (!mb.email) issues.push("Mailbox " + (mi + 1) + ": Gmail address is required");
    const ranges: Array<{ start: number; end: number; col: string }> = [];
    (mb.accounts || []).forEach((a, ai) => {
      const where = (mb.email || "mailbox " + (mi + 1)) + " › account " + (ai + 1);
      if (!a.broker) issues.push(where + ": broker is required");
      if (!a.accountId) issues.push(where + ": account ID is required");
      const col = (a.sheetStartColumn || "").toUpperCase();
      if (!/^[A-Z]$/.test(col)) issues.push(where + ": sheet column must be a single A–Z letter");
      else {
        const start = letterToColumn(col);
        ranges.push({ start, end: start + 4, col });
      }
    });
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (ranges[i].start <= ranges[j].end && ranges[j].start <= ranges[i].end) {
          issues.push(
            (mb.email || "mailbox " + (mi + 1)) +
              ": column blocks " +
              ranges[i].col +
              "… and " +
              ranges[j].col +
              "… overlap (each account needs 5 free columns)"
          );
        }
      }
    }
  });
  return issues;
}

function maskStr(v: string | undefined): string {
  if (!v) return v || "";
  return "•".repeat(Math.min(8, v.length));
}

function maskedView(model: Mailbox[]): Mailbox[] {
  const v = clone(model);
  v.forEach((mb) => {
    mb.emailPassword = maskStr(mb.emailPassword);
    (mb.accounts || []).forEach((a) => {
      a.apiKey = maskStr(a.apiKey);
      a.apiSecret = maskStr(a.apiSecret);
      a.pdfPassword = maskStr(a.pdfPassword);
    });
  });
  return v;
}

type ToastState = { msg: string; bad?: boolean } | null;

export function SettingsView() {
  const [state, setState] = useState<Mailbox[]>([]);
  const [showSecrets, setShowSecrets] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setState(loadInitial());
  }, []);

  const showToast = useCallback((msg: string, bad?: boolean) => {
    setToast({ msg, bad });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const jsonText = useMemo(() => {
    const view = showSecrets ? state : maskedView(state);
    return JSON.stringify(view, null, 2);
  }, [state, showSecrets]);

  const secType = showSecrets ? "text" : "password";

  function updateMailbox(mi: number, field: keyof Mailbox, value: string) {
    setState((s) => {
      const next = clone(s);
      (next[mi] as any)[field] = value;
      return next;
    });
  }

  function updateAccount(mi: number, ai: number, field: keyof Account, value: string) {
    setState((s) => {
      const next = clone(s);
      const acc = next[mi].accounts[ai];
      (acc as any)[field] = field === "sheetStartColumn" ? value.toUpperCase() : value;
      return next;
    });
  }

  function addMailbox() {
    setState((s) => [...s, { email: "", emailPassword: "", accounts: [] }]);
  }
  function deleteMailbox(mi: number) {
    setState((s) => s.filter((_, i) => i !== mi));
  }
  function addAccount(mi: number) {
    setState((s) => {
      const next = clone(s);
      next[mi].accounts.push({
        broker: "finvasia",
        accountId: "",
        apiKey: "",
        apiSecret: "",
        pdfPassword: "",
        sheetStartColumn: "",
      });
      return next;
    });
  }
  function deleteAccount(mi: number, ai: number) {
    setState((s) => {
      const next = clone(s);
      next[mi].accounts.splice(ai, 1);
      return next;
    });
  }

  function reset() {
    setState(clone(MOCK_ACCOUNTS));
    showToast("Reset to seed (not saved yet)");
  }

  function save() {
    const found = validate(state);
    setIssues(found);
    if (found.length) {
      showToast(found.length + " issue(s) to fix", true);
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      showToast("Saved ✓");
    } catch (err) {
      showToast("Save failed: " + (err as Error).message, true);
    }
  }

  function doExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "broker_accounts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport() {
    fileInputRef.current?.click();
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result));
        if (!Array.isArray(parsed)) throw new Error("expected an array of mailboxes");
        setState(parsed as Mailbox[]);
        showToast("Imported " + parsed.length + " mailbox(es)");
      } catch (err) {
        showToast("Import failed: " + (err as Error).message, true);
      }
    };
    fr.readAsText(file);
    // reset so the same file can be re-imported
    e.target.value = "";
  }

  return (
    <section id="view-settings">
      <div className="settings">
        <div className="settings-head">
          <div>
            <h2>Accounts</h2>
            <p className="muted">
              Set up the broker accounts the pipeline runs on — mirrors{" "}
              <code>BROKER_ACCOUNTS_JSON</code>.{" "}
              <span className="badge warn">Local only — nothing is sent anywhere.</span>
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={showSecrets}
              onChange={(e) => setShowSecrets(e.target.checked)}
            />{" "}
            Show secrets
          </label>
        </div>

        {issues.length ? (
          <div className="issues">
            <b>{issues.length} issue(s) to fix:</b>
            <ul>
              {issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.map((mb, mi) => (
          <div className="card mailbox" key={`mb-${mi}`}>
            <div className="mailbox-head">
              <div className="field">
                <label>Gmail</label>
                <input
                  value={mb.email || ""}
                  onChange={(e) => updateMailbox(mi, "email", e.target.value)}
                  placeholder="user@gmail.com"
                />
              </div>
              <div className="field">
                <label>App password</label>
                <input
                  type={secType}
                  value={mb.emailPassword || ""}
                  onChange={(e) => updateMailbox(mi, "emailPassword", e.target.value)}
                  placeholder="gmail app password"
                />
              </div>
              <button
                className="btn danger ghost icon"
                onClick={() => deleteMailbox(mi)}
                title="Remove mailbox"
              >
                ✕
              </button>
            </div>
            <div className="acct-table">
              <div className="acct-row head">
                <span>Broker</span>
                <span>Account ID</span>
                <span>API key</span>
                <span>API secret</span>
                <span>PDF password</span>
                <span>Col</span>
                <span />
              </div>
              {(mb.accounts || []).map((a, ai) => (
                <div className="acct-row" key={`mb-${mi}-acc-${ai}`}>
                  <select
                    value={a.broker || "finvasia"}
                    onChange={(e) => updateAccount(mi, ai, "broker", e.target.value)}
                  >
                    {BROKERS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <input
                    value={a.accountId || ""}
                    placeholder="FA1234"
                    onChange={(e) => updateAccount(mi, ai, "accountId", e.target.value)}
                  />
                  <input
                    type={secType}
                    value={a.apiKey || ""}
                    placeholder="api key"
                    onChange={(e) => updateAccount(mi, ai, "apiKey", e.target.value)}
                  />
                  <input
                    type={secType}
                    value={a.apiSecret || ""}
                    placeholder="api secret"
                    onChange={(e) => updateAccount(mi, ai, "apiSecret", e.target.value)}
                  />
                  <input
                    type={secType}
                    value={a.pdfPassword || ""}
                    placeholder="pdf pwd"
                    onChange={(e) => updateAccount(mi, ai, "pdfPassword", e.target.value)}
                  />
                  <input
                    className="col-input"
                    value={a.sheetStartColumn || ""}
                    placeholder="D"
                    maxLength={2}
                    onChange={(e) =>
                      updateAccount(mi, ai, "sheetStartColumn", e.target.value)
                    }
                  />
                  <button
                    className="btn danger ghost icon"
                    onClick={() => deleteAccount(mi, ai)}
                    title="Remove account"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button className="btn small" onClick={() => addAccount(mi)}>
              + Add account
            </button>
          </div>
        ))}

        <div className="settings-actions">
          <button className="btn" onClick={addMailbox}>
            + Add mailbox
          </button>
          <span className="grow" />
          <button className="btn ghost" onClick={reset}>
            Reset to seed
          </button>
          <button className="btn ghost" onClick={doExport}>
            Export JSON
          </button>
          <button className="btn ghost" onClick={doImport}>
            Import JSON
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onImportFile}
          />
        </div>

        <details className="json-preview">
          <summary>BROKER_ACCOUNTS_JSON preview</summary>
          <pre>{jsonText}</pre>
        </details>
      </div>

      <div className={"toast" + (toast ? " show" : "") + (toast?.bad ? " bad" : "")}>
        {toast?.msg || ""}
      </div>
    </section>
  );
}
