const C = window.TURISIA;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const configurado = C.SUPABASE_URL.includes("supabase.co") && !C.SUPABASE_URL.includes("TU-PROYECTO");
const sb = configurado ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
let fichas = [], destinos = [], itinActual = null;
const NIVEL = { bajo: 1, medio: 2, alto: 3 };
// Presupuesto numérico (Bs) → nivel de las fichas. Umbrales de trabajo por día, ajustables: no provienen del informe.
const UMBRAL_BS_DIA = { bajo: 150, medio: 400 };
const nivelDe = (bsDia) => (bsDia < UMBRAL_BS_DIA.bajo ? "bajo" : bsDia < UMBRAL_BS_DIA.medio ? "medio" : "alto");
const fmt = (n) => Number(n).toLocaleString("es-BO", { maximumFractionDigits: 0 });

function aviso(t) { const a = $("#aviso"); a.textContent = t; a.hidden = !t; }

// Pestañas
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.dataset.t; if (!t) return;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b === e.target));
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== t));
  document.body.dataset.tab = t; window.scrollTo({ top: 0, behavior: "smooth" });
});

async function init() {
  if (!sb) return aviso("Falta conectar Supabase: edita config.js con tu URL y tu anon key.");
  const [d, f] = await Promise.all([
    sb.from("destinos").select("*").order("nombre"),
    sb.from("fichas_detalle").select("*"),
  ]);
  if (d.error || f.error) return aviso("No se pudo leer la base de datos: " + (d.error || f.error).message);
  destinos = d.data; fichas = f.data;
  for (const sel of ["#fDestino", "#pDestino"]) $(sel).length = 1;   // evita opciones repetidas al cambiar de cuenta
  for (const sel of ["#fDestino", "#pDestino"])
    destinos.forEach((x) => $(sel).insertAdjacentHTML("beforeend", `<option value="${esc(x.nombre)}">${esc(x.nombre)}</option>`));
  pintar();
  $("#stats").textContent = `${fichas.length} fichas verificadas en ${destinos.length} destinos`;
}

function pista() {
  const total = +$("#pPres").value, dias = +$("#pDias").value;
  $("#pHint").textContent = total > 0 ? `≈ Bs ${fmt(total / dias)} por día · nivel ${nivelDe(total / dias)}` : "Escribe un monto en bolivianos";
}
$("#pPres").addEventListener("input", pista);
$("#pDias").addEventListener("change", pista);
pista();

function bsMarcas(nivel) {
  return `<span class="bs" title="Nivel de presupuesto: ${esc(nivel)}">${[1, 2, 3].map((i) => `<span class="${i <= NIVEL[nivel] ? "on" : ""}">Bs</span>`).join("")}</span>`;
}

function tarjeta(f) {
  const costo = f.costo_referencial_bs ? `Bs ${fmt(f.costo_referencial_bs)} (referencial)` : "Costo por confirmar";
  const wa = f.whatsapp ? `<button data-c="${f.prestador_id}|${f.id}|whatsapp" data-n="${esc(f.whatsapp)}">Contactar por WhatsApp</button>` : "";
  return `<article class="card tipo-${esc(f.tipo)} ${f.promocionada ? "promo" : ""}">
    ${f.promocionada ? '<span class="tag">Promocionado</span>' : ""}
    <div class="c-top"><span class="chip">${esc(f.tipo)}</span>${bsMarcas(f.presupuesto)}</div>
    <h3>${esc(f.titulo)}</h3><div class="meta">${esc(f.destino)}</div>
    <p>${esc(f.descripcion)}</p><div class="costo">${costo}</div>
    ${f.prestador ? `<div class="meta">Prestador: ${esc(f.prestador)}</div>` : ""}${wa}
    <div class="sello">✓ Fuente verificada: ${esc(f.fuente)} · ${esc(f.fecha_verificacion)}</div></article>`;
}

function pintar() {
  const d = $("#fDestino").value, t = $("#fTipo").value;
  const lista = fichas.filter((f) => (!d || f.destino === d) && (!t || f.tipo === t));
  const promo = lista.filter((f) => f.promocionada);
  $("#promoT").hidden = !promo.length;
  $("#promo").innerHTML = promo.map(tarjeta).join("");
  $("#fichas").innerHTML = lista.filter((f) => !f.promocionada).map(tarjeta).join("") || "<p>No hay fichas con estos filtros.</p>";
}
$("#fDestino").onchange = $("#fTipo").onchange = pintar;

// Registrar contacto con prestador (métrica del piloto) y abrir WhatsApp
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-c]"); if (!b || !sb) return;
  const [prestador_id, ficha_id, canal] = b.dataset.c.split("|");
  await sb.from("contactos_prestadores").insert({ prestador_id, ficha_id, canal });
  window.open("https://wa.me/" + b.dataset.n.replace(/\D/g, ""), "_blank", "noopener");
});

// Itinerario por reglas: destino, presupuesto numérico (Bs), días e intereses
$("#gen").onclick = async () => {
  if (!sb) return;
  const destino = $("#pDestino").value, dias = +$("#pDias").value, total = +$("#pPres").value;
  if (!(total > 0)) { $("#itin").innerHTML = '<p class="vacio">Escribe tu presupuesto total en bolivianos (Bs) para generar el itinerario.</p>'; return; }
  const nivel = nivelDe(total / dias);
  const ints = [...document.querySelectorAll("fieldset input:checked")].map((i) => i.value);
  const puntuadas = fichas
    .filter((f) => NIVEL[f.presupuesto] <= NIVEL[nivel] && (!destino || f.destino === destino))
    .map((f) => ({ f, s: f.intereses.filter((i) => ints.includes(i)).length })).filter((x) => x.s > 0);
  // Agrupa por destino para que cada día se concentre en un mismo lugar
  const grupos = {};
  puntuadas.forEach((x) => (grupos[x.f.destino] ||= []).push(x));
  const orden = Object.values(grupos)
    .map((g) => ({ g: g.sort((a, b) => b.s - a.s), t: g.reduce((n, x) => n + x.s, 0) }))
    .sort((a, b) => b.t - a.t).flatMap((o) => o.g.map((x) => x.f));
  const porDia = 2, elegidas = [];
  let conocido = 0;
  for (const f of orden) {
    if (elegidas.length >= dias * porDia) break;
    const c = Number(f.costo_referencial_bs) || 0;
    if (conocido + c > total) continue;       // respeta el presupuesto con los costos que sí se conocen
    conocido += c; elegidas.push(f);
  }
  const items = elegidas.map((f, i) => ({ dia: Math.floor(i / porDia) + 1, orden: (i % porDia) + 1, f }));
  if (!items.length) { $("#itin").innerHTML = '<p class="vacio">No hay fichas que coincidan. Prueba otro destino, más presupuesto o más intereses.</p>'; return; }
  const sinCosto = items.filter((x) => !x.f.costo_referencial_bs).length;
  itinActual = { destino, dias, pres: `Bs ${fmt(total)} (${nivel})`, ints, items };
  const dd = [...new Set(items.map((x) => x.dia))];
  $("#itin").innerHTML =
    `<div class="resumen">Presupuesto <b>Bs ${fmt(total)}</b> · ≈ Bs ${fmt(total / dias)} por día · nivel <b>${nivel}</b><br>
     <small>Costos conocidos: Bs ${fmt(conocido)}. ${sinCosto ? `${sinCosto} actividad${sinCosto > 1 ? "es" : ""} con costo por confirmar con el prestador.` : ""}</small></div>`
    + dd.map((d) => `<div class="dia"><h3>Día ${d}</h3>${items.filter((x) => x.dia === d).map((x) => `<div class="act tipo-${esc(x.f.tipo)}"><b>${esc(x.f.titulo)}</b><div class="meta">${esc(x.f.destino)} · nivel ${esc(x.f.presupuesto)}</div><div class="meta">✓ Fuente verificada · ${x.f.costo_referencial_bs ? "Bs " + fmt(x.f.costo_referencial_bs) : "costo por confirmar"}</div></div>`).join("")}</div>`).join("")
    + (items.length < dias * porDia ? '<p class="nota">Hay pocas fichas para esos criterios; el itinerario quedó corto.</p>' : "")
    + '<p id="gMsg" class="nota">Guardando en tu panel…</p>';
  guardar();   // se guarda solo: así el asistente ya conoce tu itinerario
};

async function guardar() {
  const it = itinActual, msg = $("#gMsg");
  try {
    if (!(await usuario())) { msg.textContent = "Tu sesión expiró. Vuelve a ingresar."; return; }
    const { data, error } = await sb.from("itinerarios").insert({ titulo: `Itinerario ${it.dias} días`, destino: it.destino, dias: it.dias, presupuesto: it.pres, intereses: it.ints }).select().single();
    if (error) throw error;
    const r2 = await sb.from("itinerario_items").insert(it.items.map((x) => ({ itinerario_id: data.id, dia: x.dia, orden: x.orden, ficha_id: x.f.id })));
    if (r2.error) throw r2.error;
    msg.textContent = "Guardado en «Mi panel». El asistente ya conoce este itinerario.";
    cargarMis();
  } catch (e) { msg.textContent = "No se pudo guardar (¿ejecutaste migracion_cuentas_admin.sql?): " + e.message; }
}

// Asistente Turismo Inteligente: la Edge Function consulta Supabase y luego llama a Gemini.
function burbuja(t, c) {
  const d = document.createElement("div");
  d.className = "m " + c;
  d.textContent = t;
  $("#chat").append(d);
  $("#chat").scrollTop = $("#chat").scrollHeight;
  return d;
}
async function enviarPregunta() {
  const q = $("#q").value.trim();
  if (!q) return;
  if (!sb) {
    burbuja("La aplicación no está conectada a Supabase. Revisa config.js.", "a");
    return;
  }
  burbuja(q, "u");
  $("#q").value = "";
  const boton = $("#send");
  boton.disabled = true;
  const espera = burbuja("Consultando la base de datos y Gemini…", "a");
  try {
    const llamada = sb.functions.invoke("asistente", {
      body: { pregunta: q },
    });
    const limite = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("La solicitud tardó más de 40 segundos. Revisa los registros de Supabase Functions y vuelve a intentar.")), 40000);
    });
    const { data, error } = await Promise.race([llamada, limite]);
    if (error) {
      console.error("Error invocando Edge Function asistente:", error);
      let detalle = error.message || "No se pudo invocar la función.";
      if (error.context && typeof error.context.json === "function") {
        try {
          const cuerpo = await error.context.json();
          if (cuerpo?.respuesta) detalle = cuerpo.respuesta;
        } catch (_) {}
      }
      espera.textContent = "Error del asistente: " + detalle +
        " Revisa que la función asistente esté desplegada y que GEMINI_API_KEY esté configurada.";
    } else {
      espera.textContent = data?.respuesta || "El asistente respondió vacío. Intenta nuevamente.";
    }
  } catch (e) {
    console.error(e);
    espera.textContent = "No se pudo conectar con el asistente: " + (e.message || "error de red");
  } finally {
    boton.disabled = false;
    $("#q").focus();
  }
}
$("#send").addEventListener("click", enviarPregunta);
$("#q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    enviarPregunta();
  }
});

// Prueba de humo y calificación
$("#reg").onclick = async () => {
  const email = $("#mail").value.trim(); if (!email || !sb) return;
  const { error } = await sb.from("interesados").insert({ email, tipo: "prestador", variante: Math.random() < 0.5 ? "A" : "B" });
  $("#regMsg").textContent = error ? "No se pudo registrar: " + error.message : "Gracias, te contactaremos.";
};
$("#rate").onclick = async () => {
  if (!sb) return;
  const { error } = await sb.from("retroalimentacion").insert({ calificacion: +$("#cal").value, comentario: $("#com").value || null });
  $("#rateMsg").textContent = error ? "No se pudo enviar: " + error.message : "Gracias por tu opinión.";
};
// Atajos: botón del hero y preguntas sugeridas
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) document.querySelector(`#tabs button[data-t="${g.dataset.go}"]`).click();
  const q = e.target.closest(".sug");
  if (q) { $("#q").value = q.dataset.q; enviarPregunta(); }
});
