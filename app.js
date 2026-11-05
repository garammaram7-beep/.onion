"use strict";
const $ = (s) => document.querySelector(s);
const KEY_BM = "onionviewer.bookmarks";
const KEY_GW = "onionviewer.gateways";
const KEY_GW_ACTIVE = "onionviewer.gateway.active";
const DEFAULT_GW = ["https://{name}.onion.ly", "https://{name}.onion.pet"];

/* ---------- Speicher ---------- */
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Speicher gesperrt */ }
}

/* ---------- Adresse prüfen ---------- */
function parseOnion(raw) {
  const s = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, "");
  const m = s.match(/^((?:[a-z0-9-]+\.)*)([a-z2-7]{16}|[a-z2-7]{56})\.onion(?::\d+)?([/?#].*)?$/);
  if (!m) return null;
  const [, sub, id, path = ""] = m;
  return {
    host: `${sub}${id}.onion`,
    name: `${sub}${id}`,
    path,
    legacy: id.length === 16,
    direct: `http://${sub}${id}.onion${path}`
  };
}

function setMsg(text, kind = "") {
  const el = $("#msg");
  el.textContent = text;
  el.className = "msg " + kind;
}

function current() {
  const p = parseOnion($("#addr").value);
  if (!p) {
    setMsg("Das ist keine gültige .onion-Adresse. Erwartet werden 56 Zeichen (v3) vor „.onion“.", "err");
    return null;
  }
  if (p.legacy) {
    setMsg("Diese Adresse hat das alte v2-Format. Es wurde 2021 abgeschaltet, die Seite ist sehr wahrscheinlich offline.", "err");
  } else {
    setMsg("Adresse ist gültig.", "ok");
  }
  return p;
}

/* ---------- Gateways ---------- */
function gateways() {
  const list = load(KEY_GW, DEFAULT_GW).filter((g) => typeof g === "string" && g.includes("{name}"));
  return list.length ? list : DEFAULT_GW;
}
function renderGateways() {
  const list = gateways();
  const active = load(KEY_GW_ACTIVE, list[0]);
  const sel = $("#gw-select");
  sel.textContent = "";
  list.forEach((g) => {
    const o = document.createElement("option");
    o.value = g; o.textContent = g.replace("{name}", "…");
    if (g === active) o.selected = true;
    sel.appendChild(o);
  });
  $("#gw-text").value = list.join("\n");
}
function gatewayUrl(p) {
  const tpl = $("#gw-select").value || gateways()[0];
  let base;
  try { base = new URL(tpl.replace("{name}", p.name)); }
  catch { setMsg("Die Gateway-Vorlage ist ungültig.", "err"); return null; }
  if (base.protocol !== "https:") { setMsg("Gateways müssen https verwenden.", "err"); return null; }
  return base.origin + p.path.replace(/^(?!\/)/, p.path ? "/" : "");
}

/* ---------- Aktionen ---------- */
$("#addr").addEventListener("input", () => { if ($("#addr").value.trim()) current(); else setMsg(""); });
$("#addr").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-tor").click(); });

$("#btn-tor").addEventListener("click", () => {
  const p = current(); if (!p) return;
  window.open(p.direct, "_blank", "noopener,noreferrer");
});

$("#btn-gw").addEventListener("click", () => {
  const p = current(); if (!p) return;
  const u = gatewayUrl(p); if (!u) return;
  window.open(u, "_blank", "noopener,noreferrer");
});

$("#btn-embed").addEventListener("click", () => {
  const p = current(); if (!p) return;
  const u = gatewayUrl(p); if (!u) return;
  $("#frame").src = u;
  $("#viewer-title").textContent = u;
  $("#viewer").hidden = false;
  $("#viewer").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#btn-close").addEventListener("click", () => {
  $("#frame").src = "about:blank";
  $("#viewer").hidden = true;
});

/* ---------- Tor-Prüfung ---------- */
$("#btn-check").addEventListener("click", async () => {
  const el = $("#tor-status");
  el.textContent = "Prüfe …";
  try {
    const r = await fetch("https://check.torproject.org/api/ip", { cache: "no-store" });
    const d = await r.json();
    el.textContent = d.IsTor
      ? "Dieser Browser nutzt Tor. Direkte .onion-Links funktionieren."
      : "Dieser Browser nutzt kein Tor. Direkte .onion-Links laden nicht.";
  } catch {
    el.textContent = "Die Prüfung ist fehlgeschlagen (Netzwerk oder Browser blockiert die Anfrage).";
  }
});

/* ---------- Lesezeichen ---------- */
function bookmarks() { const b = load(KEY_BM, []); return Array.isArray(b) ? b : []; }

function renderBookmarks() {
  const list = bookmarks();
  const ul = $("#bm-list");
  ul.textContent = "";
  $("#bm-empty").hidden = list.length > 0;
  list.forEach((b, i) => {
    const li = document.createElement("li");
    const info = document.createElement("div"); info.className = "bm-info";
    const n = document.createElement("span"); n.className = "bm-name"; n.textContent = b.name;
    const a = document.createElement("span"); a.className = "bm-addr"; a.textContent = b.addr;
    info.append(n, a);
    const use = document.createElement("button"); use.textContent = "Laden";
    use.addEventListener("click", () => { $("#addr").value = b.addr; current(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    const del = document.createElement("button"); del.textContent = "Löschen";
    del.addEventListener("click", () => { const l = bookmarks(); l.splice(i, 1); save(KEY_BM, l); renderBookmarks(); });
    li.append(info, use, del);
    ul.appendChild(li);
  });
}

$("#btn-save").addEventListener("click", () => {
  const p = current(); if (!p) return;
  const addr = p.host + p.path;
  const name = prompt("Name für das Lesezeichen:", p.host.slice(0, 16) + "…");
  if (name === null) return;
  const l = bookmarks().filter((b) => b.addr !== addr);
  l.push({ name: name.trim() || addr, addr });
  save(KEY_BM, l);
  renderBookmarks();
  setMsg("Lesezeichen gespeichert.", "ok");
});

$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(bookmarks(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "onion-lesezeichen.json";
  a.click(); URL.revokeObjectURL(a.href);
});
$("#btn-import").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const ok = (Array.isArray(data) ? data : []).filter(
      (b) => b && typeof b.name === "string" && typeof b.addr === "string" && parseOnion(b.addr)
    ).map((b) => ({ name: b.name.slice(0, 80), addr: b.addr.toLowerCase() }));
    const merged = bookmarks();
    ok.forEach((b) => { if (!merged.some((m) => m.addr === b.addr)) merged.push(b); });
    save(KEY_BM, merged); renderBookmarks();
    setMsg(`${ok.length} Lesezeichen importiert.`, "ok");
  } catch { setMsg("Die Datei konnte nicht gelesen werden.", "err"); }
  e.target.value = "";
});

/* ---------- Gateway-Einstellungen ---------- */
$("#gw-select").addEventListener("change", (e) => save(KEY_GW_ACTIVE, e.target.value));
$("#gw-save").addEventListener("click", () => {
  const lines = $("#gw-text").value.split("\n").map((s) => s.trim()).filter((s) => s.startsWith("https://") && s.includes("{name}"));
  if (!lines.length) { setMsg("Keine gültige Vorlage. Jede Zeile braucht https:// und {name}.", "err"); return; }
  save(KEY_GW, lines); save(KEY_GW_ACTIVE, lines[0]); renderGateways();
  setMsg("Gateway-Liste gespeichert.", "ok");
});
$("#gw-reset").addEventListener("click", () => {
  save(KEY_GW, DEFAULT_GW); save(KEY_GW_ACTIVE, DEFAULT_GW[0]); renderGateways();
});

/* ---------- Start ---------- */
renderGateways();
renderBookmarks();
const hash = decodeURIComponent(location.hash.slice(1));
if (hash && parseOnion(hash)) { $("#addr").value = hash; current(); }
