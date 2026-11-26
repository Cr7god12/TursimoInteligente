// Acceso obligatorio: la app solo se muestra después de iniciar sesión (usuario o administrador).
let perfil = null, iniciado = false, modo = "ingresar";
const fechaBo = (x) => (x ? new Date(x).toLocaleDateString("es-BO") : "");
const lmsg = (t) => ($("#lMsg").textContent = t);

async function usuario() {
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  const u = session?.user;
  return u && !u.is_anonymous ? u : null;   // las sesiones anónimas antiguas no cuentan
}

// Paisaje de la pantalla de acceso (mismo dibujo del inicio, con otro id de degradado)
$("#lPaisaje").innerHTML = document.querySelector(".hero .paisaje").innerHTML.replaceAll("lago", "lago2");

function setModo(m) {
  modo = m;
  $("#lTabIn").classList.toggle("on", m === "ingresar"); $("#lTabReg").classList.toggle("on", m === "registro");
  $("#lNombreW").hidden = m !== "registro"; $("#lEnviar").textContent = m === "registro" ? "Crear cuenta" : "Ingresar"; lmsg("");
}
$("#lTabIn").onclick = () => setModo("ingresar");
$("#lTabReg").onclick = () => setModo("registro");

async function enviar() {
  if (!sb) return lmsg("Falta conectar Supabase: edita config.js con tu URL y tu anon key.");
  const email = $("#lMail").value.trim(), password = $("#lPass").value;
  if (!email || !password) return lmsg("Escribe tu correo y tu contraseña.");
  if (modo === "ingresar") {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) lmsg("No se pudo ingresar: " + error.message);
  } else {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nombre: $("#lNombre").value.trim() } } });
    if (error) return lmsg("No se pudo crear la cuenta: " + error.message);
    if (!data.session) { setModo("ingresar"); lmsg("Cuenta creada. Revisa tu correo para confirmarla y luego ingresa."); }
  }
}
$("#lEnviar").onclick = enviar;
["#lMail", "#lPass", "#lNombre"].forEach((s) => $(s).addEventListener("keydown", (e) => e.key === "Enter" && enviar()));

async function cargarPerfil() {
  const u = await usuario(), antes = perfil;
  perfil = null;
  if (u) {
    const { data } = await sb.from("perfiles").select("nombre,rol").eq("id", u.id).maybeSingle();
    perfil = { id: u.id, email: u.email, nombre: data?.nombre || u.email, rol: data?.rol || "viajero" };
  }
  $("#login").hidden = !!perfil; $("#app").hidden = !perfil;
  if (!perfil) {   // sesión cerrada: no deja datos de la cuenta anterior en pantalla
    iniciado = false; document.body.classList.remove("rol-admin"); document.body.dataset.tab = "explorar";
    ["#chat", "#misLista", "#adminBody", "#itin"].forEach((s) => ($(s).innerHTML = ""));
    if (!sb) lmsg("Falta conectar Supabase: edita config.js con tu URL y tu anon key.");
    return;
  }
  $("#uMail").value = perfil.email || ""; $("#uNombre").value = perfil.nombre;
  $("#uRol").textContent = perfil.rol === "admin" ? "Administrador" : "Viajero";
  $("#btnCuenta").textContent = `Salir · ${perfil.nombre}`;
  // Cada rol ve solo lo que le corresponde: el administrador gestiona, el viajero planifica
  const admin = perfil.rol === "admin";
  const visibles = admin ? ["admin", "explorar"] : ["explorar", "planificar", "asistente", "aliados", "mis"];
  document.querySelectorAll("#tabs button").forEach((b) => (b.hidden = !visibles.includes(b.dataset.t)));
  $('#tabs [data-t="explorar"]').textContent = admin ? "Vista pública" : "Explorar";
  document.body.classList.toggle("rol-admin", admin); $("#rolTag").hidden = !admin;
  if (!iniciado) { iniciado = true; init(); }
  cargarMis();
  if (!antes) $(`#tabs [data-t="${perfil.rol === "admin" ? "admin" : "explorar"}"]`).click();   // el admin entra a su panel
  if (perfil.rol === "admin") window.cargarAdmin?.();
}

$("#btnCuenta").onclick = async () => { await sb.auth.signOut(); await cargarPerfil(); };
sb?.auth.onAuthStateChange(() => setTimeout(cargarPerfil, 0));   // setTimeout evita bloqueos dentro del callback

// Navegación interna de «Mi panel»
$("#userNav").addEventListener("click", (e) => {
  const v = e.target.dataset.u; if (!v) return;
  document.querySelectorAll("#userNav button").forEach((b) => b.classList.toggle("on", b === e.target));
  $("#uItin").hidden = v !== "itin"; $("#uPerfil").hidden = v !== "perfil";
});
$("#uGuardar").onclick = async () => {
  if (!perfil) return;
  const nombre = $("#uNombre").value.trim(); if (!nombre) return ($("#uMsg").textContent = "Escribe un nombre.");
  const { error } = await sb.from("perfiles").update({ nombre }).eq("id", perfil.id);
  $("#uMsg").textContent = error ? "No se pudo guardar: " + error.message : "Nombre actualizado.";
  if (!error) cargarPerfil();
};
$("#uSalir").onclick = () => $("#btnCuenta").click();

async function cargarMis() {
  const { data, error } = await sb.from("itinerarios")
    .select("id,titulo,destino,dias,presupuesto,creado_en,itinerario_items(dia,orden,fichas(titulo,destinos(nombre)))")
    .order("creado_en", { ascending: false });
  if (error) return ($("#misLista").innerHTML = `<p class="aviso">${esc(error.message)}</p>`);
  $("#uCuenta").textContent = `· ${data.length} itinerario${data.length === 1 ? "" : "s"} guardado${data.length === 1 ? "" : "s"}`;
  $("#misLista").innerHTML = data.length ? data.map((it) => {
    const dias = {};
    [...it.itinerario_items].sort((a, b) => a.dia - b.dia || a.orden - b.orden)
      .forEach((x) => (dias[x.dia] ||= []).push(x.fichas ? `${esc(x.fichas.titulo)} <span class="meta">· ${esc(x.fichas.destinos?.nombre)}</span>` : "<i>actividad ya no disponible</i>"));
    return `<article class="card"><h3>${esc(it.titulo)}</h3>
      <div class="meta">${esc(it.destino || "La Paz y alrededores")} · ${it.dias} días · ${esc(it.presupuesto || "")} · ${fechaBo(it.creado_en)}</div>
      ${Object.entries(dias).map(([d, a]) => `<p><b>Día ${d}:</b> ${a.join("; ")}</p>`).join("")}
      <button data-del="${it.id}">Eliminar</button></article>`;
  }).join("") : '<p class="vacio">Aún no tienes itinerarios. Genera uno en «Planificar»: se guarda solo y el asistente lo conoce.</p>';
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del]"); if (!b || !confirm("¿Eliminar este itinerario?")) return;
  await sb.from("itinerarios").delete().eq("id", b.dataset.del);
  cargarMis();
});
cargarPerfil();
