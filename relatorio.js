const CONFIG = {
  relatorioUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/ojas-relatorio"
};
const TOKEN_KEY = "ojasAuth";
const EMAIL_KEY = "ojasEmail";
const $ = (s) => document.querySelector(s);

function token() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
function email() { return (sessionStorage.getItem(EMAIL_KEY) || "").toLowerCase(); }

if (!token() || !email()) location.href = "./index.html";

let dia = new Date();
let vistoEm = null;
let original = "";
let editando = false;

function ymd(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function label(d) {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Sao_Paulo"
  });
}
function headers() {
  return { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" };
}
function hint(t) { $("#save-hint").textContent = t; }

function setModo(editar) {
  editando = editar;
  const ta = $("#texto");
  ta.readOnly = !editar;
  ta.classList.toggle("is-edit", editar);
  $("#btn-editar").hidden = editar;
  $("#btn-salvar").hidden = !editar;
  $("#btn-cancelar").hidden = !editar;
}

async function api(payload) {
  const res = await fetch(CONFIG.relatorioUrl, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: email(), token: token(), ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 || data.conflito) return { ...data, conflito: true };
  if (!res.ok) throw new Error(data.erro || "Falha no relatório");
  return data;
}

async function carregar() {
  setModo(false);
  $("#dayLabel").textContent = label(dia);
  hint("carregando…");
  const data = await api({ dia: ymd(dia) });
  original = data.texto || "";
  $("#texto").value = original;
  vistoEm = data.atualizado_em || null;
  hint(original ? "salvo no banco" : "sem anotação neste dia");
}

async function salvar() {
  hint("salvando…");
  const texto = $("#texto").value;
  const data = await api({ dia: ymd(dia), texto, atualizado_em: vistoEm });
  if (data.conflito) {
    alert("O banco tem uma versão mais nova. Recarregando.");
    await carregar();
    return;
  }
  original = texto;
  vistoEm = data.atualizado_em;
  setModo(false);
  hint("salvo");
}

$("#btn-editar").addEventListener("click", () => {
  setModo(true);
  $("#texto").focus();
  hint("editando");
});
$("#btn-cancelar").addEventListener("click", () => {
  $("#texto").value = original;
  setModo(false);
  hint("cancelado");
});
$("#btn-salvar").addEventListener("click", () => salvar().catch((e) => hint(e.message)));
$("#prev-day").addEventListener("click", () => {
  if (editando && $("#texto").value !== original && !confirm("Descartar edição?")) return;
  dia.setDate(dia.getDate() - 1);
  carregar().catch((e) => hint(e.message));
});
$("#next-day").addEventListener("click", () => {
  if (editando && $("#texto").value !== original && !confirm("Descartar edição?")) return;
  dia.setDate(dia.getDate() + 1);
  carregar().catch((e) => hint(e.message));
});
$("#btn-sair").addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  location.href = "./index.html";
});

carregar().catch((e) => hint(e.message));
