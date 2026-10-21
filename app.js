const MONTHS = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"
];

const CONFIG = {
  loginUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-login",
  agendaUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-pwa-agenda",
  chatUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/bced152e-7c97-41a0-80e3-5dd0f640ebdd/chat",
  relatorioUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-relatorio",
  tradingUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-trading"
};

const TOKEN_KEY = "ojasAuth";
const EMAIL_KEY = "ojasEmail";
const $ = (s) => document.querySelector(s);

function token() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function setToken(v) {
  if (v) sessionStorage.setItem(TOKEN_KEY, v);
  else {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
  }
}
function userEmail() {
  return sessionStorage.getItem(EMAIL_KEY) || "";
}

function mostrarApp(logado) {
  $("#login-view").hidden = logado;
  $("#app-view").hidden = !logado;
  if (logado) {
    const n = new Date();
    view.y = n.getFullYear();
    view.m = n.getMonth();
    selected = ymd(n);
    loadAgenda();
    loadNotaHoje();
    loadDesempenho();
  }
}

const FALLBACK = [];
let EVENTS = [];
const view = { y: 2026, m: 8 };
let selected = ymd(new Date());

function ymd(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function fmtHour(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

function eventsOn(day) {
  return EVENTS.filter((e) => String(e.start || e.date || "").slice(0, 10) === day);
}

function monthRange() {
  const last = new Date(view.y, view.m + 1, 0);
  const mm = String(view.m + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return {
    after: `${view.y}-${mm}-01T00:00:00.000-03:00`,
    before: `${view.y}-${mm}-${dd}T23:59:59.999-03:00`
  };
}

function normalize(raw) {
  const arr = Array.isArray(raw) ? raw : raw.events || raw.data || [raw];
  return arr
    .filter((e) => e && (e.start || e.summary || e.title))
    .map((e) => ({
      start: e.start?.dateTime || e.start?.date || e.start,
      end: e.end?.dateTime || e.end?.date || e.end,
      title: e.summary || e.title || "(Sem título)",
      obs: e.description || e.obs || ""
    }));
}

function headers() {
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1"
  };
}

async function loadAgenda() {
  const { after, before } = monthRange();
  try {
    const res = await fetch(CONFIG.agendaUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ after, before, token: token() })
    });
    if (res.status === 401) {
      setToken("");
      mostrarApp(false);
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const list = normalize(data);
    EVENTS = list;
    setStatus(true);
  } catch {
    EVENTS = [];
    setStatus(false);
  }
  renderMonth();
  renderDay();
  loadNotaHoje();
  loadDesempenho();
}

let notaOriginal = "";
let notaVistoEm = null;
let notaEditando = false;

function setNotaModo(editar) {
  notaEditando = editar;
  const ta = $("#hoje-nota");
  if (!ta) return;
  ta.readOnly = !editar;
  ta.classList.toggle("is-edit", editar);
  const ed = $("#btn-editar");
  const sv = $("#btn-salvar");
  const ca = $("#btn-cancelar");
  if (ed) ed.hidden = editar;
  if (sv) sv.hidden = !editar;
  if (ca) ca.hidden = !editar;
}

function notaHint(t) {
  const el = $("#nota-hint");
  if (el) el.textContent = t || "";
}

async function loadNotaHoje() {
  loadNota(selected || ymd(new Date()));
}

async function loadNota(dia) {
  const el = $("#hoje-nota");
  const titulo = $("#nota-titulo");
  if (!el || !token()) return;
  if (notaEditando && el.value !== notaOriginal && !confirm("Descartar edição?")) return;
  setNotaModo(false);
  const hoje = ymd(new Date());
  if (titulo) {
    titulo.textContent = dia === hoje
      ? "Anotações de hoje"
      : "Anotações de " + dia.split("-").reverse().join("/");
  }
  el.value = "carregando…";
  try {
    const res = await fetch(CONFIG.relatorioUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        email: userEmail(),
        token: token(),
        dia
      })
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    notaOriginal = data.texto || "";
    notaVistoEm = data.atualizado_em || null;
    el.value = notaOriginal;
    notaHint(notaOriginal ? "salvo no banco" : "sem anotação neste dia");
  } catch {
    el.value = "";
    notaHint("Não foi possível carregar.");
  }
}

async function salvarNota() {
  const el = $("#hoje-nota");
  if (!el) return;
  notaHint("salvando…");
  try {
    const res = await fetch(CONFIG.relatorioUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        email: userEmail(),
        token: token(),
        dia: selected || ymd(new Date()),
        texto: el.value,
        atualizado_em: notaVistoEm
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 || data.conflito) {
      alert("O banco tem uma versão mais nova. Recarregando.");
      await loadNota(selected);
      return;
    }
    if (!res.ok) throw new Error(data.erro || "Falha ao salvar");
    notaOriginal = el.value;
    notaVistoEm = data.atualizado_em || notaVistoEm;
    setNotaModo(false);
    notaHint("salvo");
  } catch (e) {
    notaHint(e.message || "Não foi possível salvar.");
  }
}

let tradeRows = [];

function mesKey() {
  return `${view.y}-${String(view.m + 1).padStart(2, "0")}`;
}
function normalizarTrade(data) {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.rows)
        ? data.rows
        : data && (data.area || data.dia)
          ? [data]
          : [];
  return raw.map((x) => x.json || x).filter((x) => x && x.area && x.dia);
}
function tradeValor(dia, area) {
  const r = tradeRows.find((x) => String(x.dia).slice(0, 10) === dia && x.area === area);
  return r ? Number(r.valor) || 0 : 0;
}
async function loadDesempenho() {
  const canvas = $("#chart");
  if (!canvas || !token()) return;
  try {
    const res = await fetch(CONFIG.tradingUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ acao: "ler", email: userEmail(), mes: mesKey(), token: token() })
    });
    if (!res.ok) throw new Error(String(res.status));
    tradeRows = normalizarTrade(await res.json());
  } catch {
    tradeRows = [];
  }
  renderChart();
}
function renderChart() {
  const canvas = $("#chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(canvas.parentElement.clientWidth - 40, 640);
  const h = 320;
  canvas.style.width = "100%";
  canvas.style.height = h + "px";
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const days = new Date(view.y, view.m + 1, 0).getDate();
  const btg = [];
  const ylos = [];
  let accB = 0;
  let accY = 0;
  for (let d = 1; d <= days; d++) {
    const key = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    accB += tradeValor(key, "BTG");
    accY += tradeValor(key, "Ylos");
    btg.push(accB);
    ylos.push(accY);
  }
  const all = btg.concat(ylos);
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const span = max - min || 1;
  const pad = { l: 56, r: 16, t: 28, b: 36 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const yOf = (v) => pad.t + ih - ((v - min) / span) * ih;
  const xOf = (i) => pad.l + (i / Math.max(days - 1, 1)) * iw;
  const zeroY = yOf(0);

  ctx.fillStyle = "rgba(125,154,106,0.10)";
  ctx.fillRect(pad.l, pad.t, iw, Math.max(0, zeroY - pad.t));
  ctx.fillStyle = "rgba(196,120,60,0.12)";
  ctx.fillRect(pad.l, zeroY, iw, Math.max(0, pad.t + ih - zeroY));

  ctx.strokeStyle = "#2c281f";
  ctx.lineWidth = 1;
  ctx.font = "11px Outfit, sans-serif";
  ctx.fillStyle = "#9a8f76";
  ctx.textAlign = "right";
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = min + (span * i) / steps;
    const y = yOf(v);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillText(v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }), pad.l - 8, y + 4);
  }
  ctx.textAlign = "center";
  const marks = [1, Math.ceil(days / 2), days];
  marks.forEach((d) => {
    const x = xOf(d - 1);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ih);
    ctx.stroke();
    ctx.fillText(`${d}/${view.m + 1}`, x, h - 10);
  });

  ctx.strokeStyle = "#c4783c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.l, zeroY);
  ctx.lineTo(w - pad.r, zeroY);
  ctx.stroke();

  function line(arr, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    arr.forEach((v, i) => {
      const x = xOf(i);
      const y = yOf(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  line(btg, "#9a8f76");
  line(ylos, "#c9a227");
  preencherDetalhe();
  preencherForm();
}

function preencherDetalhe() {
  const body = $("#trade-body");
  const tb = $("#total-btg");
  const ty = $("#total-ylos");
  if (!body) return;
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const cor = (n) => (n < 0 ? "v-neg" : n > 0 ? "v-pos" : "");
  let sumB = 0;
  let sumY = 0;
  const cells = [];
  for (let d = 1; d <= days; d++) {
    const key = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const b = tradeValor(key, "BTG");
    const y = tradeValor(key, "Ylos");
    sumB += b;
    sumY += y;
    const mark = key === selected ? " is-day" : "";
    cells.push(
      `<td class="day-btn${mark}" data-dia="${key}">${d}/${view.m + 1}</td>` +
      `<td class="${mark}"><span class="${cor(b)}">${fmt(b)}</span></td>` +
      `<td class="${mark}"><span class="${cor(y)}">${fmt(y)}</span></td>`
    );
  }
  const third = Math.ceil(cells.length / 3);
  const empty = "<td></td><td></td><td></td>";
  const rowsHtml = [];
  for (let i = 0; i < third; i++) {
    const a = cells[i] || empty;
    const b = cells[i + third] || empty;
    const c = cells[i + third * 2] || empty;
    rowsHtml.push(`<tr>${a}${b}${c}</tr>`);
  }
  body.innerHTML = rowsHtml.join("");
  if (tb) tb.innerHTML = `<span class="${cor(sumB)}">${fmt(sumB)}</span>`;
  if (ty) ty.innerHTML = `<span class="${cor(sumY)}">${fmt(sumY)}</span>`;
  body.querySelectorAll(".day-btn").forEach((el) => {
    el.addEventListener("click", () => {
      selected = el.dataset.dia;
      renderMonth();
      renderDay();
      loadNota(selected);
      preencherDetalhe();
      preencherForm();
    });
  });
}

function preencherForm() {
  const label = $("#trade-day");
  if (!label) return;
  const [yy, m, d] = (selected || ymd(new Date())).split("-");
  label.textContent = `${Number(d)}/${m}/${yy}`;
  const b = tradeValor(selected, "BTG");
  const y = tradeValor(selected, "Ylos");
  $("#in-btg").value = b ? String(b).replace(".", ",") : "";
  $("#in-ylos").value = y ? String(y).replace(".", ",") : "";
}

function parseNum(s) {
  const n = Number(String(s || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function salvarArea(area, valor) {
  const res = await fetch(CONFIG.tradingUrl, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      acao: "salvar",
      email: userEmail(),
      dia: selected,
      area,
      valor,
      obs: "",
      token: token()
    })
  });
  if (!res.ok) throw new Error(String(res.status));
}

$("#trade-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#trade-msg");
  if (msg) msg.textContent = "salvando…";
  try {
    await salvarArea("BTG", parseNum($("#in-btg").value));
    await salvarArea("Ylos", parseNum($("#in-ylos").value));
    await loadDesempenho();
    if (msg) msg.textContent = "salvo";
  } catch {
    if (msg) msg.textContent = "falhou";
  }
});

function setStatus(on) {
  const el = $("#status");
  if (!el) return;
  el.classList.toggle("is-on", !!on);
  el.classList.toggle("is-off", !on);
  el.title = on ? "Agenda ligada" : "Agenda offline";
}

function renderMonth() {
  $("#monthLabel").textContent = `${MONTHS[view.m]} ${view.y}`;
  const first = new Date(view.y, view.m, 1);
  const start = first.getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const prevDays = new Date(view.y, view.m, 0).getDate();
  const grid = $("#grid");
  grid.innerHTML = "";

  for (let i = 0; i < 42; i++) {
    const btn = document.createElement("button");
    btn.className = "day";
    let date;
    if (i < start) {
      date = new Date(view.y, view.m - 1, prevDays - start + i + 1);
      btn.classList.add("mute");
    } else if (i >= start + days) {
      date = new Date(view.y, view.m + 1, i - start - days + 1);
      btn.classList.add("mute");
    } else {
      date = new Date(view.y, view.m, i - start + 1);
    }
    const key = ymd(date);
    btn.appendChild(document.createTextNode(String(date.getDate())));
    if (key === ymd(new Date())) btn.classList.add("today");
    if (key === selected) btn.classList.add("selected");
    const evs = eventsOn(key);
    if (evs.length) {
      const dots = document.createElement("span");
      dots.className = "dots";
      evs.slice(0, 3).forEach(() => {
        const d = document.createElement("span");
        d.className = "dot";
        dots.appendChild(d);
      });
      btn.appendChild(dots);
    }
    btn.addEventListener("click", () => {
      selected = key;
      renderMonth();
      renderDay();
      loadNota(key);
      preencherDetalhe();
      preencherForm();
    });
    grid.appendChild(btn);
  }
}

function renderDay() {
  const [y, m, d] = selected.split("-");
  $("#dayLabel").textContent = `${Number(d)} de ${MONTHS[Number(m) - 1]} de ${y}`;
  const evs = eventsOn(selected);
  $("#list").innerHTML = evs.length
    ? evs.map((e) => `
        <article class="event">
          <time>${fmtHour(e.start)}<br>${fmtHour(e.end)}</time>
          <div><b>${e.title}</b>${e.obs ? `<small class="obs">${e.obs}</small>` : ""}</div>
        </article>`).join("")
    : `<p class="empty">Nenhum compromisso neste dia.</p>`;
}

function limparMarkdown(s) {
  return String(s || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`+/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function addBubble(text, who) {
  const el = document.createElement("div");
  el.className = `msg msg--${who === "me" ? "user" : "bot"}`;
  el.textContent = who === "me" ? text : limparMarkdown(text);
  $("#thread").appendChild(el);
  $("#thread").scrollTop = $("#thread").scrollHeight;
}

async function send() {
  const q = $("#q").value.trim();
  if (!q) return;
  addBubble(q, "me");
  $("#q").value = "";
  addBubble("consultando…", "bot");
  try {
    let sessionId = sessionStorage.getItem("ojasChatSession");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("ojasChatSession", sessionId);
    }
    const res = await fetch(CONFIG.chatUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        action: "sendMessage",
        sessionId,
        chatInput: q,
        token: token()
      })
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const text =
      data.output ||
      data.text ||
      (Array.isArray(data) ? data[0]?.output : null) ||
      JSON.stringify(data);
    $("#thread").lastChild.textContent = limparMarkdown(text);
    await loadAgenda();
  } catch {
    $("#thread").lastChild.textContent =
      "Chat offline. Confira o webhook ojas-pwa-chat.";
  }
}

$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const erro = $("#login-erro");
  erro.hidden = true;
  const email = $("#login-email").value.trim();
  const senha = $("#login-senha").value;
  const btn = $("#login-btn");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    const res = await fetch(CONFIG.loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.erro || "E-mail ou senha inválidos.");
    setToken(data.token);
    sessionStorage.setItem(EMAIL_KEY, email.toLowerCase());
    mostrarApp(true);
  } catch (err) {
    erro.textContent = err.message || "Não foi possível entrar.";
    erro.hidden = false;
  }
  btn.disabled = false;
  btn.textContent = "Entrar";
});

$("#btn-sair")?.addEventListener("click", () => {
  setToken("");
  sessionStorage.removeItem("ojasChatSession");
  mostrarApp(false);
});

$("#btn-editar")?.addEventListener("click", () => {
  setNotaModo(true);
  $("#hoje-nota")?.focus();
  notaHint("editando");
});
$("#btn-cancelar")?.addEventListener("click", () => {
  const el = $("#hoje-nota");
  if (el) el.value = notaOriginal;
  setNotaModo(false);
  notaHint("cancelado");
});
$("#btn-salvar")?.addEventListener("click", () => salvarNota());

$("#prev")?.addEventListener("click", async () => {
  view.m -= 1;
  if (view.m < 0) { view.m = 11; view.y -= 1; }
  await loadAgenda();
});
$("#next")?.addEventListener("click", async () => {
  view.m += 1;
  if (view.m > 11) { view.m = 0; view.y += 1; }
  await loadAgenda();
});

const widget = $("#botWidget");
const panel = $("#botPanel");
$("#botOpen")?.addEventListener("click", () => {
  panel.hidden = false;
  widget.classList.add("is-open");
  panel.classList.add("is-open");
  $("#q").focus();
});
$("#botClose")?.addEventListener("click", () => {
  panel.hidden = true;
  widget.classList.remove("is-open");
  panel.classList.remove("is-open");
});
$("#ask")?.addEventListener("submit", (e) => {
  e.preventDefault();
  send();
});

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = $("#btn-mic");
let rec = null;
if (mic && SR) {
  rec = new SR();
  rec.lang = "pt-BR";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (ev) => {
    let said = "";
    for (const r of ev.results) said += r[0].transcript;
    $("#q").value = said.trim();
  };
  rec.onend = () => mic.classList.remove("is-on");
  rec.onerror = () => mic.classList.remove("is-on");
  mic.addEventListener("click", () => {
    if (mic.classList.contains("is-on")) {
      rec.stop();
      return;
    }
    mic.classList.add("is-on");
    try { rec.start(); } catch { mic.classList.remove("is-on"); }
  });
} else if (mic) {
  mic.addEventListener("click", () => {
    addBubble("Este navegador não transcreve voz. Use Chrome.", "bot");
  });
}

if ($("#thread") && !$("#thread").childElementCount) {
  addBubble("Pergunte pelos compromissos de hoje, amanhã ou uma data.", "bot");
}

$("#perf-toggle")?.addEventListener("click", () => {
  const body = $("#perf-body");
  const icon = $("#perf-icon");
  if (!body) return;
  body.hidden = !body.hidden;
  if (icon) icon.textContent = body.hidden ? "+" : "–";
  if (!body.hidden) renderChart();
});
$("#acc-toggle")?.addEventListener("click", () => {
  const body = $("#acc-body");
  const icon = $("#acc-icon");
  if (!body) return;
  body.hidden = !body.hidden;
  if (icon) icon.textContent = body.hidden ? "+" : "–";
});

mostrarApp(!!token());
