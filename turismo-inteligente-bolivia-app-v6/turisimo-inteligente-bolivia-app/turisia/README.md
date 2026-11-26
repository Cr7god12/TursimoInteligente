# Turismo Inteligente Bolivia — Gemini + respaldo gratuito de Supabase

Esta versión mantiene la aplicación web, Supabase/PostgreSQL y Gemini. Incluye dos niveles de respaldo para que el asistente siga siendo útil sin habilitar facturación:

1. Gemini principal: `gemini-3.8-flash`.
2. Segundo modelo Gemini: `gemini-3.5-flash-lite`.
3. Respaldo local desde Supabase: si ambos modelos no responden o se agota la cuota, la función busca fichas relevantes en `public.fichas_detalle` y redacta una respuesta extractiva sin consumir cuota de Gemini.

**Importante:** el respaldo de base de datos no es otro modelo generativo. Es una búsqueda por coincidencias sobre las fichas publicadas y solo presenta datos existentes. Esto permite que el asistente siga ofreciendo información turística aunque se agote la cuota de IA. Las cuotas gratuitas siguen sujetas a los límites que Google aplique a cada proyecto y modelo.

## 1. Requisitos

- Proyecto Supabase existente.
- `GEMINI_API_KEY` guardada como secreto en Supabase.
- Supabase CLI disponible mediante `npx supabase`.
- La vista `public.fichas_detalle` existente y con permiso de lectura para la clave pública.

No pongas la clave de Gemini en `app.js`, `config.js`, HTML ni en el ZIP. La clave compartida anteriormente debe revocarse y sustituirse por una nueva.

## 2. Vincular el proyecto (solo si todavía no está vinculado)

Desde la carpeta `turisia`:

```powershell
npx supabase login
npx supabase link --project-ref lbaiqxnuzchexgeckisq
```

## 3. Configurar los secretos

Si ya guardaste `GEMINI_API_KEY`, no necesitas volver a introducirla. Configura los dos modelos:

```powershell
npx supabase secrets set GEMINI_MODEL=gemini-3.8-flash
npx supabase secrets set GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
```

Si todavía no guardaste una clave nueva de Gemini:

```powershell
npx supabase secrets set GEMINI_API_KEY=TU_CLAVE_NUEVA
```

No escribas literalmente `TU_CLAVE_NUEVA`: reemplázalo en tu terminal por tu clave privada.

## 4. Desplegar la función corregida

Desde la carpeta `turisia` ejecuta:

```powershell
npx supabase functions deploy asistente
```

No hace falta volver a desplegar la página web en un hosting si solo estás ejecutando el proyecto localmente. La Edge Function sí debe desplegarse después de modificar `index.ts`.

## 5. Ejecutar la aplicación web

En otra terminal, dentro de la carpeta `turisia`:

```powershell
python -m http.server 8000
```

Abre:

```text
http://localhost:8000
```

## 6. Cómo funciona el nuevo asistente

Flujo:

```text
Navegador (app.js)
    |
    v
Supabase Edge Function: asistente
    |
    v
Consulta public.fichas_detalle (PostgreSQL)
    |
    +--> Gemini 3.8 Flash
    |       |
    |       +--> si falla, Gemini 3.5 Flash-Lite
    |
    +--> si ambos fallan: búsqueda y respuesta directa desde Supabase
    |
    v
Respuesta al chat
```

El asistente nunca inventa costos o destinos en el modo de respaldo. Indica expresamente cuándo responde directamente desde la base de datos y recuerda que los costos referenciales deben confirmarse con el prestador.

## 7. Verificar los datos de la vista

En Supabase → SQL Editor:

```sql
select titulo, destino, tipo, descripcion, intereses, presupuesto,
       costo_referencial_bs, fuente, fecha_verificacion
from public.fichas_detalle
limit 20;
```

Si la consulta no devuelve fichas, revisa que existan registros publicados (`fichas.publicada = true`) y que las políticas RLS permitan leerlos. No ejecutes de nuevo todo `schema.sql` sobre una base de datos que ya contiene tablas y datos sin revisar antes su contenido.

## 8. Probar el respaldo

Puedes probar preguntas como:

- `¿Qué lugares puedo visitar en La Paz?`
- `Recomiéndame actividades de naturaleza`
- `¿Qué opciones de bajo presupuesto hay?`

Si ambos modelos Gemini están disponibles, responde Gemini. Si las cuotas se agotan, el chat presenta opciones que encuentra directamente en la base de datos.

## 9. Límites importantes

- El segundo modelo no garantiza cuota disponible: Google puede limitar ambos modelos o cambiar sus límites.
- Ningún código puede ampliar ni restablecer la cuota gratuita de Google.
- El modo de respaldo de Supabase no consume solicitudes de Gemini, pero sí consulta la base de datos.
- Esta versión no requiere facturación ni incorpora proveedores de IA de pago.


## 10. Protección contra esperas indefinidas

La Edge Function ahora limita la consulta a Supabase a 10 segundos y cada llamada a Gemini a 12 segundos. Si Gemini tarda demasiado, se pasa al siguiente modelo; si ambos fallan, se utiliza la respuesta directa desde Supabase. El navegador muestra un aviso si la invocación completa tarda más de 40 segundos.

## 11. Diagnóstico si el chat continúa sin responder

1. Abre Supabase Dashboard → Edge Functions → `asistente` → Logs.
2. Envía una sola pregunta desde la aplicación.
3. Comprueba si aparece una invocación nueva y revisa los eventos `error`/`warn`.
4. Si no aparece ninguna invocación, revisa `config.js` (URL y clave pública de Supabase) y la consola del navegador (F12 → Console).
5. Si aparece una invocación pero termina con error, revisa el mensaje en Logs. No compartas claves API ni tokens al enviar capturas.

El servidor `python -m http.server 8000` solo sirve los archivos del frontend; no ejecuta ni muestra los logs de Supabase Edge Functions.
