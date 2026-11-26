// Panel de administración (solo rol «admin»; las políticas RLS lo vuelven a comprobar en la base).
const COSTO_MENSUAL_BS = 3800, TARIFA_BS = 150;   // Tablas 14 y 11 del informe (referenciales)
let aVista = "resumen", admFichas = [], admDestinos = [];
const INTERESES = ["cultura", "aventura", "comida", "naturaleza"];
const opt = (arr, sel, val = (x) => x, txt = (x) => x) => arr.map((x) => `<option value="${esc(val(x))}" ${val(x) === sel ? "selected" : ""}>${esc(txt(x))}</option>`).join("");

window.cargarAdmin = () => pintarAdmin(aVista);
$("#adminNav").addEventListener("click", (e) => {
  const v = e.target.dataset.a; if (!v) return;
  aVista = v;
  document.querySelectorAll("#adminNav button").forEach((b) => b.classList.toggle("on", b === e.target));
  pintarAdmin(v);
});
async function pintarAdmin(v) {
  const c = $("#adminBody");
  c.innerHTML = '<p class="vacio">Cargando…</p>';
  try { await ({ resumen: aResumen, fichas: aFichas, aliados: aAliados, mensajes: aMensajes })[v](c); }
  catch (e) { c.innerHTML = `<p class="aviso">${esc(e.message)}</p>`; }
}
const ok = (r) => { if (r.error) throw r.error; return r.data; };

async function aResumen(c) {
  const m = ok(await sb.rpc("metricas_piloto"));
  const meta = Math.ceil(COSTO_MENSUAL_BS / TARIFA_BS);
  const k = (t, v, n = "") => `<div class="kpi"><span>${t}</span><b>${v}</b><small>${n}</small></div>`;
  c.innerHTML = `<div class="kpis">
    ${k("Fichas publicadas", `${m.fichas_publicadas} de ${m.fichas_total}`, `${m.fichas_pendientes} pendientes de revisión · todas con fuente y fecha`)}
    ${k("Calificación media", m.calificacion_media ? `${m.calificacion_media} / 5` : "—", `Meta del informe: 4/5 · ${m.calificaciones} opiniones`)}
    ${k("Itinerarios guardados", m.itinerarios, `${m.usuarios} cuentas registradas`)}
    ${k("Contactos a prestadores", m.contactos, "Clics en WhatsApp")}
    ${k("Interesados", m.interesados, "Prueba de humo")}
    ${k("Anunciantes activos", `${m.anunciantes_activos} de ${m.prestadores}`, `Ingreso mensual: Bs ${fmt(m.ingreso_mensual_bs)}`)}
  </div>
  <div class="resumen">Punto de equilibrio del informe: <b>${meta} anunciantes</b> a Bs ${TARIFA_BS} para cubrir Bs ${fmt(COSTO_MENSUAL_BS)} al mes
    (cifras referenciales). ${m.anunciantes_activos >= meta ? "Ya se cubre ese costo." : `Faltan <b>${meta - m.anunciantes_activos}</b> anunciantes.`}</div>
  <h3>Prestadores más contactados</h3>${m.top_contactados.length ? `<ol>${m.top_contactados.map((x) => `<li>${esc(x.nombre)} · ${x.n}</li>`).join("")}</ol>` : '<p class="vacio">Aún no hay contactos.</p>'}
  <p class="nota">Por privacidad, el administrador ve solo cifras agregadas: no puede abrir los itinerarios de los usuarios.</p>`;
}

async function aFichas(c) {
  [admFichas, admDestinos] = [ok(await sb.from("fichas").select("*,destinos(nombre)").order("creado_en", { ascending: false })), ok(await sb.from("destinos").select("id,nombre").order("nombre"))];
  c.innerHTML = `<details id="fForm" class="caja"><summary id="fTit">Nueva ficha</summary><div class="form2">
    <input type="hidden" id="f_id">
    <label>Título<input id="f_titulo"></label>
    <label>Destino<select id="f_destino">${opt(admDestinos, "", (d) => d.id, (d) => d.nombre)}</select></label>
    <label>Tipo<select id="f_tipo">${opt(["atractivo", "actividad", "alojamiento", "gastronomia", "transporte", "guia"], "")}</select></label>
    <label>Nivel de presupuesto<select id="f_pres">${opt(["bajo", "medio", "alto"], "medio")}</select></label>
    <label>Costo referencial (Bs, opcional)<input id="f_costo" type="number" min="0" step="1"></label>
    <label class="ancho">Descripción<textarea id="f_desc" rows="2"></textarea></label>
    <fieldset class="ancho"><legend>Intereses</legend>${INTERESES.map((i) => `<label class="pill"><input type="checkbox" class="f_int" value="${i}"><span>${i}</span></label>`).join("")}</fieldset>
    <label>Fuente (obligatoria para publicar)<input id="f_fuente"></label>
    <label>Fecha de verificación<input id="f_fecha" type="date"></label>
    <label>Responsable de revisión<input id="f_resp"></label>
    <label class="pill"><input type="checkbox" id="f_pub"><span>Publicada</span></label>
    <div class="row ancho"><button id="f_guardar" class="cta">Guardar ficha</button><button id="f_nuevo" class="cta ghost">Limpiar</button><span id="f_msg" class="nota"></span></div></div></details>
  <table class="tabla"><thead><tr><th>Ficha</th><th>Estado</th><th></th></tr></thead><tbody>${admFichas.map((f) => `<tr>
    <td><b>${esc(f.titulo)}</b><br><span class="meta">${esc(f.destinos?.nombre)} · ${esc(f.tipo)} · ${esc(f.presupuesto)}</span></td>
    <td>${f.publicada ? '<span class="tag ok">Publicada</span>' : '<span class="tag">Pendiente</span>'}${f.fuente && f.fecha_verificacion ? "" : '<br><span class="meta">falta fuente o fecha</span>'}</td>
    <td class="acc"><button data-pub="${f.id}">${f.publicada ? "Despublicar" : "Publicar"}</button><button data-edit="${f.id}">Editar</button><button data-borrar="${f.id}">Borrar</button></td></tr>`).join("")}</tbody></table>`;
}
const fv = (id) => document.getElementById(id);
function limpiarFicha() { fv("f_id").value = ""; fv("fTit").textContent = "Nueva ficha"; document.querySelectorAll("#fForm input:not([type=checkbox]):not([type=hidden]),#fForm textarea").forEach((i) => (i.value = "")); document.querySelectorAll("#fForm input[type=checkbox]").forEach((i) => (i.checked = false)); }

document.addEventListener("click", async (e) => {
  const t = e.target;
  try {
    if (t.id === "f_nuevo") limpiarFicha();
    if (t.id === "f_guardar") {
      const reg = { destino_id: fv("f_destino").value, titulo: fv("f_titulo").value.trim(), tipo: fv("f_tipo").value, descripcion: fv("f_desc").value.trim() || null,
        intereses: [...document.querySelectorAll(".f_int:checked")].map((i) => i.value), presupuesto: fv("f_pres").value,
        costo_referencial_bs: fv("f_costo").value === "" ? null : +fv("f_costo").value, fuente: fv("f_fuente").value.trim() || null,
        fecha_verificacion: fv("f_fecha").value || null, responsable_revision: fv("f_resp").value.trim() || null, publicada: fv("f_pub").checked };
      if (!reg.titulo) return (fv("f_msg").textContent = "Escribe un título.");
      const id = fv("f_id").value;
      ok(id ? await sb.from("fichas").update(reg).eq("id", id) : await sb.from("fichas").insert(reg));
      return pintarAdmin("fichas");
    }
    const id = (k) => t.dataset[k];
    if (id("pub")) { const f = admFichas.find((x) => x.id === id("pub")); ok(await sb.from("fichas").update({ publicada: !f.publicada }).eq("id", f.id)); pintarAdmin("fichas"); }
    if (id("edit")) {
      const f = admFichas.find((x) => x.id === id("edit")); fv("fForm").open = true; fv("fTit").textContent = "Editar ficha";
      Object.entries({ f_id: f.id, f_titulo: f.titulo, f_destino: f.destino_id, f_tipo: f.tipo, f_pres: f.presupuesto, f_costo: f.costo_referencial_bs ?? "", f_desc: f.descripcion ?? "", f_fuente: f.fuente ?? "", f_fecha: f.fecha_verificacion ?? "", f_resp: f.responsable_revision ?? "" }).forEach(([k, v]) => (fv(k).value = v));
      document.querySelectorAll(".f_int").forEach((i) => (i.checked = f.intereses.includes(i.value))); fv("f_pub").checked = f.publicada; fv("fForm").scrollIntoView();
    }
    if (id("borrar") && confirm("¿Borrar esta ficha? También se quitará de los itinerarios que la usan.")) { ok(await sb.from("fichas").delete().eq("id", id("borrar"))); pintarAdmin("fichas"); }
    if (id("anuncio")) await anuncio(id("anuncio"), t.dataset.on === "1");
    if (t.id === "p_guardar") {
      const nombre = fv("p_nombre").value.trim(); if (!nombre) return (fv("p_msg").textContent = "Escribe el nombre del prestador.");
      ok(await sb.from("prestadores").insert({ nombre, tipo: fv("p_tipo").value, destino_id: fv("p_destino").value || null, whatsapp: fv("p_wa").value.trim() || null, telefono: fv("p_tel").value.trim() || null, email: fv("p_mail").value.trim() || null }));
      pintarAdmin("aliados");
    }
  } catch (err) { const m = fv("f_msg") || fv("p_msg"); if (m) m.textContent = err.message; else alert(err.message); }
});

async function anuncio(prestadorId, activar) {
  const ex = ok(await sb.from("anunciantes").select("id").eq("prestador_id", prestadorId).maybeSingle());
  if (ex) ok(await sb.from("anunciantes").update({ activo: activar }).eq("id", ex.id));
  else if (activar) ok(await sb.from("anunciantes").insert({ prestador_id: prestadorId, tarifa_mensual_bs: TARIFA_BS, fecha_inicio: new Date().toISOString().slice(0, 10), activo: true }));
  ok(await sb.from("prestadores").update({ es_anunciante: activar }).eq("id", prestadorId));
  pintarAdmin("aliados");
}

async function aAliados(c) {
  const [ps, ds] = [ok(await sb.from("prestadores").select("*,destinos(nombre),anunciantes(activo,tarifa_mensual_bs)").order("nombre")), ok(await sb.from("destinos").select("id,nombre").order("nombre"))];
  c.innerHTML = `<details class="caja"><summary>Registrar prestador</summary><div class="form2">
    <label>Nombre<input id="p_nombre"></label><label>Tipo<select id="p_tipo">${opt(["hotel", "guia", "agencia", "restaurante", "operador", "otro"], "")}</select></label>
    <label>Destino<select id="p_destino"><option value="">—</option>${opt(ds, "", (d) => d.id, (d) => d.nombre)}</select></label>
    <label>WhatsApp (con código de país)<input id="p_wa" placeholder="59171234567"></label><label>Teléfono<input id="p_tel"></label><label>Correo<input id="p_mail" type="email"></label>
    <div class="row ancho"><button id="p_guardar" class="cta">Guardar prestador</button><span id="p_msg" class="nota"></span></div></div></details>
  <table class="tabla"><thead><tr><th>Prestador</th><th>Anuncio</th><th></th></tr></thead><tbody>${ps.map((p) => { const a = p.anunciantes?.[0]?.activo ?? p.anunciantes?.activo ?? false; return `<tr>
    <td><b>${esc(p.nombre)}</b><br><span class="meta">${esc(p.tipo)} · ${esc(p.destinos?.nombre || "sin destino")} · ${esc(p.whatsapp || "sin WhatsApp")}</span></td>
    <td>${a ? `<span class="tag ok">Activo · Bs ${TARIFA_BS}/mes</span>` : '<span class="tag">Sin anuncio</span>'}</td>
    <td class="acc"><button data-anuncio="${p.id}" data-on="${a ? 0 : 1}">${a ? "Pausar anuncio" : "Activar anuncio"}</button></td></tr>`; }).join("") || '<tr><td colspan="3" class="vacio">Aún no hay prestadores.</td></tr>'}</tbody></table>
  <p class="nota">Los anuncios activos se muestran en «Explorar» marcados como «Promocionado». Tarifa de trabajo: Bs ${TARIFA_BS} al mes (no aprobada).</p>`;
}

async function aMensajes(c) {
  const [i, r] = [ok(await sb.from("interesados").select("*").order("creado_en", { ascending: false }).limit(30)), ok(await sb.from("retroalimentacion").select("*").order("creado_en", { ascending: false }).limit(30))];
  c.innerHTML = `<h3>Interesados (${i.length})</h3><table class="tabla"><tbody>${i.map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(x.tipo)} · variante ${esc(x.variante || "—")}</td><td>${fechaBo(x.creado_en)}</td></tr>`).join("") || '<tr><td class="vacio">Sin registros.</td></tr>'}</tbody></table>
  <h3>Opiniones (${r.length})</h3><table class="tabla"><tbody>${r.map((x) => `<tr><td><b>${x.calificacion}/5</b></td><td>${esc(x.comentario || "—")}</td><td>${fechaBo(x.creado_en)}</td></tr>`).join("") || '<tr><td class="vacio">Sin registros.</td></tr>'}</tbody></table>`;
}
