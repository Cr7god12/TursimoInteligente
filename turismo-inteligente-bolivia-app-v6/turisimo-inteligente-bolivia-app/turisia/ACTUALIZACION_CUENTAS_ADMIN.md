# Cuentas, Mi panel (usuario) y Panel de administración

## 1. Base de datos: dos archivos separados (SQL Editor)
| Orden | Archivo | Para qué sirve | ¿Obligatorio? |
|---|---|---|---|
| 1 | `supabase/1_cuentas_usuario.sql` | Cuentas, perfiles y «Mi panel»: guardar y ver tus itinerarios | Sí |
| 2 | `supabase/2_panel_admin.sql` | Roles de administrador, gestión de fichas y anuncios, métricas | Solo si quieres el panel de administración |

Ambos se pueden ejecutar de nuevo sin problema. `schema.sql` no cambió.

## 2. Función del asistente
`npx supabase functions deploy asistente --no-verify-jwt` (los secretos no cambian). Así el asistente lee los itinerarios de quien inició sesión.

## 3. Archivos de la app
Copia `index.html`, `styles.css`, `app.js`, `cuenta.js` y `admin.js` y recarga con Ctrl+F5.

## 4. Primer administrador
Crea tu cuenta en la app (Ingresar → Crear cuenta) y ejecuta en SQL Editor:
`update perfiles set rol = 'admin' where email = 'tu@correo.com';`
Cierra sesión y vuelve a ingresar: aparecerá la pestaña «Administración». (Para pruebas puedes desactivar *Confirm email* en Authentication → Sign In / Providers → Email.)

## Los dos paneles
**Mi panel (cualquier cuenta):** Mis itinerarios (ver y eliminar) y Mi perfil (nombre, tipo de cuenta, cerrar sesión).
**Administración (solo rol admin):** Resumen del piloto, Fichas (crear, editar, publicar), Prestadores y anuncios, Interesados y opiniones. Solo ve cifras agregadas, nunca los itinerarios de los usuarios.
