// Settings → Accounts page. CRUD over a BROKER_ACCOUNTS_JSON-shaped config, persisted in
// localStorage (mock). Validation reuses the Sheet column math from updateSheet.js:12-28.
// Next.js round: this page writes to a real secret store instead of localStorage.
(function (global) {
  "use strict";

  const KEY = "ta_dash_accounts";
  const BROKERS = ["finvasia", "angelone", "fyers", "kite"];
  let state = null;
  let showSecrets = false;
  let container = null;

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return clone(global.MOCK_ACCOUNTS || []);
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  // mirrors updateSheet.js letterToColumn (A->1)
  function letterToColumn(letter) {
    let col = 0;
    for (let i = 0; i < letter.length; i++) col = col * 26 + (letter.charCodeAt(i) - 64);
    return col;
  }

  function validate(model) {
    const issues = [];
    model.forEach((mb, mi) => {
      if (!mb.email) issues.push("Mailbox " + (mi + 1) + ": Gmail address is required");
      const ranges = [];
      (mb.accounts || []).forEach((a, ai) => {
        const where = (mb.email || "mailbox " + (mi + 1)) + " › account " + (ai + 1);
        if (!a.broker) issues.push(where + ": broker is required");
        if (!a.accountId) issues.push(where + ": account ID is required");
        const col = (a.sheetStartColumn || "").toUpperCase();
        if (!/^[A-Z]$/.test(col)) issues.push(where + ": sheet column must be a single A–Z letter");
        else {
          const start = letterToColumn(col);
          ranges.push({ start: start, end: start + 4, col: col });
        }
      });
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          if (ranges[i].start <= ranges[j].end && ranges[j].start <= ranges[i].end) {
            issues.push((mb.email || "mailbox " + (mi + 1)) + ": column blocks " + ranges[i].col + "… and " + ranges[j].col + "… overlap (each account needs 5 free columns)");
          }
        }
      }
    });
    return issues;
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function secType() {
    return showSecrets ? "text" : "password";
  }

  function accountRow(a, mi, ai) {
    const opts = BROKERS.map((b) => '<option value="' + b + '"' + (a.broker === b ? " selected" : "") + ">" + b + "</option>").join("");
    return (
      '<div class="acct-row" data-mi="' + mi + '" data-ai="' + ai + '">' +
      '<select data-mi="' + mi + '" data-ai="' + ai + '" data-field="broker">' + opts + "</select>" +
      '<input data-mi="' + mi + '" data-ai="' + ai + '" data-field="accountId" value="' + esc(a.accountId) + '" placeholder="FA1234"/>' +
      '<input type="' + secType() + '" data-mi="' + mi + '" data-ai="' + ai + '" data-field="apiKey" value="' + esc(a.apiKey) + '" placeholder="api key"/>' +
      '<input type="' + secType() + '" data-mi="' + mi + '" data-ai="' + ai + '" data-field="apiSecret" value="' + esc(a.apiSecret) + '" placeholder="api secret"/>' +
      '<input type="' + secType() + '" data-mi="' + mi + '" data-ai="' + ai + '" data-field="pdfPassword" value="' + esc(a.pdfPassword) + '" placeholder="pdf pwd"/>' +
      '<input class="col-input" data-mi="' + mi + '" data-ai="' + ai + '" data-field="sheetStartColumn" value="' + esc(a.sheetStartColumn) + '" maxlength="2" placeholder="D"/>' +
      '<button class="btn danger ghost icon" data-action="del-account" data-mi="' + mi + '" data-ai="' + ai + '" title="Remove account">✕</button>' +
      "</div>"
    );
  }

  function mailboxTpl(mb, mi) {
    const accounts = (mb.accounts || []).map((a, ai) => accountRow(a, mi, ai)).join("");
    return (
      '<div class="card mailbox" data-mi="' + mi + '">' +
      '<div class="mailbox-head">' +
      '<div class="field"><label>Gmail</label><input data-mi="' + mi + '" data-field="email" value="' + esc(mb.email) + '" placeholder="user@gmail.com"/></div>' +
      '<div class="field"><label>App password</label><input type="' + secType() + '" data-mi="' + mi + '" data-field="emailPassword" value="' + esc(mb.emailPassword) + '" placeholder="gmail app password"/></div>' +
      '<button class="btn danger ghost icon" data-action="del-mailbox" data-mi="' + mi + '" title="Remove mailbox">✕</button>' +
      "</div>" +
      '<div class="acct-table">' +
      '<div class="acct-row head"><span>Broker</span><span>Account ID</span><span>API key</span><span>API secret</span><span>PDF password</span><span>Col</span><span></span></div>' +
      accounts +
      "</div>" +
      '<button class="btn small" data-action="add-account" data-mi="' + mi + '">+ Add account</button>' +
      "</div>"
    );
  }

  function template() {
    return (
      '<div class="settings">' +
      '<div class="settings-head">' +
      "<div><h2>Accounts</h2>" +
      '<p class="muted">Set up the broker accounts the pipeline runs on — mirrors <code>BROKER_ACCOUNTS_JSON</code>. ' +
      '<span class="badge warn">Local only — nothing is sent anywhere.</span></p></div>' +
      '<label class="switch"><input type="checkbox" id="set-secrets"' + (showSecrets ? " checked" : "") + "/> Show secrets</label>" +
      "</div>" +
      '<div id="set-issues"></div>' +
      state.map((mb, mi) => mailboxTpl(mb, mi)).join("") +
      '<div class="settings-actions">' +
      '<button class="btn" data-action="add-mailbox">+ Add mailbox</button>' +
      '<span class="grow"></span>' +
      '<button class="btn ghost" data-action="reset">Reset to seed</button>' +
      '<button class="btn ghost" data-action="export">Export JSON</button>' +
      '<button class="btn ghost" data-action="import">Import JSON</button>' +
      '<button class="btn primary" data-action="save">Save</button>' +
      "</div>" +
      '<details class="json-preview"><summary>BROKER_ACCOUNTS_JSON preview</summary><pre id="set-json"></pre></details>' +
      "</div>"
    );
  }

  function setField(t, f, val) {
    const mi = +t.getAttribute("data-mi");
    const aiAttr = t.getAttribute("data-ai");
    if (aiAttr == null) state[mi][f] = val;
    else state[mi].accounts[+aiAttr][f] = f === "sheetStartColumn" ? val.toUpperCase() : val;
  }

  function onInput(e) {
    const t = e.target;
    const f = t.getAttribute && t.getAttribute("data-field");
    if (!f) return;
    setField(t, f, t.value);
    updateJson();
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === "set-secrets") {
      showSecrets = t.checked;
      rerender();
      return;
    }
    const f = t.getAttribute && t.getAttribute("data-field");
    if (f) {
      setField(t, f, t.value);
      updateJson();
    }
  }
  function onClick(e) {
    const btn = e.target.closest && e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const mi = btn.getAttribute("data-mi");
    const ai = btn.getAttribute("data-ai");
    if (action === "add-mailbox") state.push({ email: "", emailPassword: "", accounts: [] }), rerender();
    else if (action === "del-mailbox") state.splice(+mi, 1), rerender();
    else if (action === "add-account")
      state[+mi].accounts.push({ broker: "finvasia", accountId: "", apiKey: "", apiSecret: "", pdfPassword: "", sheetStartColumn: "" }), rerender();
    else if (action === "del-account") state[+mi].accounts.splice(+ai, 1), rerender();
    else if (action === "reset") (state = clone(global.MOCK_ACCOUNTS || [])), rerender(), toast("Reset to seed (not saved yet)");
    else if (action === "export") doExport();
    else if (action === "import") doImport();
    else if (action === "save") doSave();
  }

  function mask(v) {
    if (!v) return v;
    return "•".repeat(Math.min(8, String(v).length));
  }
  function updateJson() {
    const el = document.getElementById("set-json");
    if (!el) return;
    const view = clone(state);
    if (!showSecrets)
      view.forEach((mb) => {
        mb.emailPassword = mask(mb.emailPassword);
        (mb.accounts || []).forEach((a) => {
          a.apiKey = mask(a.apiKey);
          a.apiSecret = mask(a.apiSecret);
          a.pdfPassword = mask(a.pdfPassword);
        });
      });
    el.textContent = JSON.stringify(view, null, 2);
  }
  function renderIssues(issues) {
    const el = document.getElementById("set-issues");
    if (!el) return;
    el.innerHTML = issues.length
      ? '<div class="issues"><b>' + issues.length + " issue(s) to fix:</b><ul>" + issues.map((i) => "<li>" + esc(i) + "</li>").join("") + "</ul></div>"
      : "";
  }

  function doSave() {
    const issues = validate(state);
    renderIssues(issues);
    if (issues.length) {
      toast(issues.length + " issue(s) to fix", true);
      return;
    }
    persist();
    toast("Saved ✓");
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
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const parsed = JSON.parse(fr.result);
          if (!Array.isArray(parsed)) throw new Error("expected an array of mailboxes");
          state = parsed;
          rerender();
          toast("Imported " + parsed.length + " mailbox(es)");
        } catch (err) {
          toast("Import failed: " + err.message, true);
        }
      };
      fr.readAsText(file);
    };
    inp.click();
  }

  function toast(msg, bad) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(t._t);
    t._t = setTimeout(() => {
      t.className = "toast";
    }, 2400);
  }

  function rerender() {
    if (container) {
      container.innerHTML = template();
      updateJson();
    }
  }
  function render(host) {
    container = host;
    if (!state) state = load();
    host.innerHTML = template();
    if (!host.__wired) {
      host.addEventListener("input", onInput);
      host.addEventListener("change", onChange);
      host.addEventListener("click", onClick);
      host.__wired = true;
    }
    updateJson();
  }

  global.Settings = { render, validate, load };
})(window);
