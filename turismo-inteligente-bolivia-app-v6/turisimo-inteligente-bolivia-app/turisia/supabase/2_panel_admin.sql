-- PARTE 2 · Panel de administración. Ejecutar DESPUÉS de 1_cuentas_usuario.sql. Se puede repetir sin problema.

create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
$$;
grant execute on function public.es_admin() to anon, authenticated;

-- Contenido y publicidad: solo administradores crean, editan, publican y borran
drop policy if exists "admin destinos" on destinos;
create policy "admin destinos" on destinos for all to authenticated using (es_admin()) with check (es_admin());
drop policy if exists "admin prestadores" on prestadores;
create policy "admin prestadores" on prestadores for all to authenticated using (es_admin()) with check (es_admin());
drop policy if exists "admin fichas" on fichas;
create policy "admin fichas" on fichas for all to authenticated using (es_admin()) with check (es_admin());
drop policy if exists "admin anunciantes" on anunciantes;
create policy "admin anunciantes" on anunciantes for all to authenticated using (es_admin()) with check (es_admin());
grant insert, update, delete on destinos, prestadores, fichas, anunciantes to authenticated;

-- Métricas del piloto: contactos, calificaciones y personas interesadas
drop policy if exists "admin lee contactos" on contactos_prestadores;
create policy "admin lee contactos" on contactos_prestadores for select to authenticated using (es_admin());
drop policy if exists "admin lee retroalimentacion" on retroalimentacion;
create policy "admin lee retroalimentacion" on retroalimentacion for select to authenticated using (es_admin());
drop policy if exists "admin lee interesados" on interesados;
create policy "admin lee interesados" on interesados for select to authenticated using (es_admin());
grant select on contactos_prestadores, retroalimentacion, interesados to authenticated;

-- Los itinerarios NO se abren al admin: solo ve cifras agregadas (informe 9.4: datos mínimos y análisis agregado)
create or replace function public.metricas_piloto() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  return jsonb_build_object(
    'fichas_total', (select count(*) from fichas),
    'fichas_publicadas', (select count(*) from fichas where publicada),
    'fichas_pendientes', (select count(*) from fichas where not publicada),
    'itinerarios', (select count(*) from itinerarios),
    'usuarios', (select count(*) from perfiles),
    'calificacion_media', (select round(avg(calificacion)::numeric, 2) from retroalimentacion),
    'calificaciones', (select count(*) from retroalimentacion),
    'contactos', (select count(*) from contactos_prestadores),
    'interesados', (select count(*) from interesados),
    'prestadores', (select count(*) from prestadores),
    'anunciantes_activos', (select count(*) from anunciantes where activo),
    'ingreso_mensual_bs', (select coalesce(sum(tarifa_mensual_bs), 0) from anunciantes where activo),
    'top_contactados', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.nombre, count(*) as n from contactos_prestadores c join prestadores p on p.id = c.prestador_id
        group by p.nombre order by n desc limit 5) x)
  );
end $$;
grant execute on function public.metricas_piloto() to authenticated;

-- PRIMER ADMINISTRADOR: regístrate en la app y luego ejecuta (con tu correo):
-- update perfiles set rol = 'admin' where email = 'tu@correo.com';
