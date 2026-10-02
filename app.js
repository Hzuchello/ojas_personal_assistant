const MONTHS = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"
];

const CONFIG = {
  loginUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-login",
  agendaUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-pwa-agenda",
  chatUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/bced152e-7c97-41a0-80e3-5dd0f640ebdd/chat",
  relatorioUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-relatorio"
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
}

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

mostrarApp(!!token());
