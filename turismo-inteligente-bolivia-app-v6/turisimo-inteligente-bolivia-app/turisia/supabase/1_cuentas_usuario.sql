-- PARTE 1 · Cuentas de usuario y panel del viajero ("Mi panel").
-- Ejecutar primero, después de schema.sql. Se puede repetir sin problema.

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, nombre text,
  rol text not null default 'viajero' check (rol in ('viajero','admin')),
  creado_en timestamptz default now()
);
alter table perfiles enable row level security;

-- Crea el perfil al registrarse (las sesiones anónimas no tienen perfil)
create or replace function public.crear_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous,false) then return new; end if;
  insert into perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_perfil();

-- Perfiles de usuarios ya registrados (no anónimos)
insert into perfiles (id, email, nombre)
select id, email, split_part(email,'@',1) from auth.users where coalesce(is_anonymous,false) = false
on conflict do nothing;

-- Cada persona ve y edita solo su perfil, y solo el nombre (el rol nunca se cambia desde la app)
drop policy if exists "ver mi perfil" on perfiles;
create policy "ver mi perfil" on perfiles for select to authenticated using (id = auth.uid());
drop policy if exists "editar mi perfil" on perfiles;
create policy "editar mi perfil" on perfiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on perfiles from authenticated;
grant select on perfiles to authenticated;
grant update (nombre) on perfiles to authenticated;

-- Itinerarios propios (las políticas ya están en schema.sql; aquí se asegura el acceso)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on itinerarios, itinerario_items to authenticated;
