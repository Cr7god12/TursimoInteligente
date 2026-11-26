-- TurisIA Bolivia · esquema Supabase (PostgreSQL). Ejecutar completo en SQL Editor.
create extension if not exists pgcrypto;

create table destinos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  ubicacion text,
  categoria text check (categoria in ('ciudad','cultural','lago','naturaleza','aventura')),
  creado_en timestamptz default now()
);

create table prestadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('hotel','guia','agencia','restaurante','operador','otro')),
  destino_id uuid references destinos(id) on delete set null,
  telefono text, whatsapp text, email text, direccion text,
  es_anunciante boolean not null default false,
  creado_en timestamptz default now()
);

-- Cada ficha publicada debe tener fuente y fecha de verificación (indicador: 100 %)
create table fichas (
  id uuid primary key default gen_random_uuid(),
  destino_id uuid not null references destinos(id) on delete cascade,
  prestador_id uuid references prestadores(id) on delete set null,
  titulo text not null,
  tipo text not null check (tipo in ('atractivo','actividad','alojamiento','gastronomia','transporte','guia')),
  descripcion text,
  intereses text[] not null default '{}',   -- cultura, aventura, comida, naturaleza
  presupuesto text not null default 'medio' check (presupuesto in ('bajo','medio','alto')),
  costo_referencial_bs numeric(10,2),
  fuente text, fecha_verificacion date, responsable_revision text,
  publicada boolean not null default false,
  creado_en timestamptz default now(),
  constraint publicada_con_fuente check (not publicada or (fuente is not null and fecha_verificacion is not null))
);

-- Publicidad de terceros (plan referencial Bs 150/mes)
create table anunciantes (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references prestadores(id) on delete cascade,
  ficha_id uuid references fichas(id) on delete set null,
  tarifa_mensual_bs numeric(10,2) not null default 150,
  fecha_inicio date, fecha_fin date,
  activo boolean not null default true
);

create table itinerarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  titulo text, destino text, dias int check (dias between 1 and 14),
  presupuesto text, intereses text[],
  creado_en timestamptz default now()
);
create table itinerario_items (
  id uuid primary key default gen_random_uuid(),
  itinerario_id uuid not null references itinerarios(id) on delete cascade,
  dia int not null, orden int not null default 1,
  ficha_id uuid not null references fichas(id) on delete cascade
);

-- Métricas del piloto
create table contactos_prestadores (
  id uuid primary key default gen_random_uuid(),
  prestador_id uuid references prestadores(id) on delete cascade,
  ficha_id uuid references fichas(id) on delete set null,
  canal text check (canal in ('whatsapp','telefono','email')),
  creado_en timestamptz default now()
);
create table retroalimentacion (
  id uuid primary key default gen_random_uuid(),
  itinerario_id uuid references itinerarios(id) on delete set null,
  calificacion int not null check (calificacion between 1 and 5),
  comentario text,
  creado_en timestamptz default now()
);
create table interesados (            -- prueba de humo (2 variantes de mensaje)
  id uuid primary key default gen_random_uuid(),
  email text not null, variante text check (variante in ('A','B')),
  tipo text default 'viajero' check (tipo in ('viajero','prestador')),
  creado_en timestamptz default now()
);

-- Vista pública (respeta RLS del usuario que consulta)
create view fichas_detalle with (security_invoker = true) as
select f.id, f.titulo, f.tipo, f.descripcion, f.intereses, f.presupuesto, f.costo_referencial_bs,
       f.fuente, f.fecha_verificacion, d.id destino_id, d.nombre destino,
       p.id prestador_id, p.nombre prestador, p.telefono, p.whatsapp, p.email,
       coalesce(p.es_anunciante,false) and exists (select 1 from anunciantes a where a.prestador_id=p.id and a.activo) as promocionada
from fichas f join destinos d on d.id=f.destino_id left join prestadores p on p.id=f.prestador_id
where f.publicada;

-- Seguridad (RLS)
alter table destinos enable row level security;
alter table prestadores enable row level security;
alter table fichas enable row level security;
alter table anunciantes enable row level security;
alter table itinerarios enable row level security;
alter table itinerario_items enable row level security;
alter table contactos_prestadores enable row level security;
alter table retroalimentacion enable row level security;
alter table interesados enable row level security;

create policy "lectura publica destinos" on destinos for select using (true);
create policy "lectura publica prestadores" on prestadores for select using (true);
create policy "lectura fichas publicadas" on fichas for select using (publicada);
create policy "lectura anunciantes activos" on anunciantes for select using (activo);
create policy "itinerarios propios" on itinerarios for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "items propios" on itinerario_items for all to authenticated
  using (exists (select 1 from itinerarios i where i.id=itinerario_id and i.user_id=auth.uid()))
  with check (exists (select 1 from itinerarios i where i.id=itinerario_id and i.user_id=auth.uid()));
create policy "registrar contacto" on contactos_prestadores for insert with check (true);
create policy "enviar retroalimentacion" on retroalimentacion for insert with check (true);
create policy "registrarse interesado" on interesados for insert with check (true);
-- La administración (crear/editar fichas, anunciantes) se hace desde el Table Editor de Supabase.

-- Datos de ejemplo: REEMPLAZAR por fichas verificadas (sin costos inventados)
insert into destinos (nombre, descripcion, ubicacion, categoria) values
 ('Ciudad de La Paz','Sede de gobierno, centro histórico, museos y teleférico.','La Paz','ciudad'),
 ('Tiwanaku','Sitio arqueológico de la cultura tiwanakota.','Provincia Ingavi','cultural'),
 ('Copacabana','Santuario y puerta de entrada al lago Titicaca.','Provincia Manco Kapac','lago'),
 ('Isla del Sol','Isla sagrada en el lago Titicaca con caminatas y vistas.','Lago Titicaca','lago'),
 ('Valle de la Luna','Formaciones erosionadas cerca de la ciudad.','Zona sur de La Paz','naturaleza'),
 ('Coroico (Yungas)','Pueblo de clima cálido en los Yungas.','Nor Yungas','aventura');

insert into fichas (destino_id, titulo, tipo, descripcion, intereses, presupuesto, fuente, fecha_verificacion, responsable_revision, publicada)
select d.id, v.titulo, v.tipo, v.descripcion, v.intereses, v.presupuesto,
       'Semilla de ejemplo: reemplazar tras verificación', current_date, 'Equipo TurisIA', true
from (values
 ('Ciudad de La Paz','Centro histórico y museos','atractivo','Recorrido por plazas, museos y calles coloniales.',array['cultura'],'bajo'),
 ('Ciudad de La Paz','Paseo en teleférico','actividad','Vistas de la ciudad y del Illimani.',array['naturaleza','aventura'],'bajo'),
 ('Ciudad de La Paz','Mercado y comida típica','gastronomia','Platos tradicionales paceños en mercados locales.',array['comida','cultura'],'bajo'),
 ('Tiwanaku','Visita al sitio arqueológico','atractivo','Templos y monolitos de la cultura tiwanakota.',array['cultura'],'medio'),
 ('Copacabana','Santuario y costanera','atractivo','Paseo por el santuario y la orilla del lago.',array['cultura','naturaleza'],'medio'),
 ('Copacabana','Trucha del lago','gastronomia','Gastronomía local a orillas del Titicaca.',array['comida'],'medio'),
 ('Isla del Sol','Caminata por la isla','actividad','Senderos con vistas al lago.',array['aventura','naturaleza'],'medio'),
 ('Valle de la Luna','Caminata por el valle','atractivo','Paseo corto entre formaciones de roca.',array['naturaleza'],'bajo'),
 ('Coroico (Yungas)','Senderismo en los Yungas','actividad','Rutas de naturaleza y clima cálido.',array['aventura','naturaleza'],'alto'),
 ('Coroico (Yungas)','Café de los Yungas','gastronomia','Degustación de café regional.',array['comida'],'medio')
) as v(destino,titulo,tipo,descripcion,intereses,presupuesto)
join destinos d on d.nombre=v.destino;
