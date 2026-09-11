-- ============================================================
-- VIANA I / ANA PAULA — SUPABASE V1
-- Execute este ficheiro no Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- Perfis de autenticação
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  employee_id text unique,
  role text not null default 'staff'
    check (role in ('admin','doctor','nurse','technician','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Funcionários / directório público
create table if not exists public.employees (
  id text primary key,
  name text not null,
  category text,
  role_title text,
  function_title text,
  photo text,
  bio text,
  status text not null default 'ready'
    check (status in ('ready','suspended','inactive')),
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Escalas
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  work_date date not null,
  start_time time,
  end_time time,
  status text not null default 'scheduled'
    check (status in ('scheduled','off','absent','leave')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(employee_id, work_date, start_time, end_time)
);

-- Pacientes (dados sensíveis: nunca expor no site público)
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  process_number text unique,
  birth_date date,
  sex text,
  phone text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relação médico/paciente
create table if not exists public.patient_assignments (
  patient_id uuid not null references public.patients(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(patient_id, employee_id)
);

-- Consultas/atendimentos
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  appointment_date timestamptz not null,
  type text,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- Registos clínicos
create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  record_date timestamptz not null default now(),
  diagnosis text,
  treatment text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Participação do utente
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Sugestão','Reclamação')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  message text not null,
  status text not null default 'new'
    check (status in ('new','in_review','resolved','archived')),
  created_at timestamptz not null default now()
);

-- Estado global do website
create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  site_active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.site_settings(id, site_active)
values (1, true)
on conflict (id) do nothing;

-- Auditoria
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Funções auxiliares
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.current_employee_id()
returns text language sql stable security definer set search_path = public
as $$
  select employee_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.can_access_employee(p_employee_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or public.current_employee_id() = p_employee_id;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.schedules enable row level security;
alter table public.patients enable row level security;
alter table public.patient_assignments enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.feedback enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Perfis
drop policy if exists "profiles self or admin select" on public.profiles;
create policy "profiles self or admin select" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Directório público: somente dados não clínicos
drop policy if exists "public employees select" on public.employees;
create policy "public employees select" on public.employees
for select using (public_visible = true);

drop policy if exists "admin employees write" on public.employees;
create policy "admin employees write" on public.employees
for all using (public.is_admin()) with check (public.is_admin());

-- Escalas: público pode ler; escrita só admin
drop policy if exists "public schedules read" on public.schedules;
create policy "public schedules read" on public.schedules
for select using (
  exists(select 1 from public.employees e where e.id = schedules.employee_id and e.public_visible = true)
);

drop policy if exists "employee own schedule read" on public.schedules;
create policy "employee own schedule read" on public.schedules
for select using (public.can_access_employee(employee_id));

drop policy if exists "admin schedules write" on public.schedules;
create policy "admin schedules write" on public.schedules
for all using (public.is_admin()) with check (public.is_admin());

-- Pacientes
drop policy if exists "doctor own patients" on public.patient_assignments;
create policy "doctor own patients" on public.patient_assignments
for select using (public.can_access_employee(employee_id));

drop policy if exists "doctor own patient records" on public.patients;
create policy "doctor own patient records" on public.patients
for select using (
  public.is_admin() or exists(
    select 1 from public.patient_assignments pa
    where pa.patient_id = patients.id
      and pa.employee_id = public.current_employee_id()
  )
);

drop policy if exists "doctor insert patients" on public.patients;
create policy "doctor insert patients" on public.patients
for insert with check (
  public.is_admin() or created_by = auth.uid()
);

drop policy if exists "doctor update own patients" on public.patients;
create policy "doctor update own patients" on public.patients
for update using (
  public.is_admin() or exists(
    select 1 from public.patient_assignments pa
    where pa.patient_id = patients.id
      and pa.employee_id = public.current_employee_id()
  )
);

drop policy if exists "assignment admin or owner" on public.patient_assignments;
create policy "assignment admin or owner" on public.patient_assignments
for all using (public.is_admin() or employee_id = public.current_employee_id())
with check (public.is_admin() or employee_id = public.current_employee_id());

-- Consultas e registos clínicos
drop policy if exists "appointments own" on public.appointments;
create policy "appointments own" on public.appointments
for all using (public.is_admin() or employee_id = public.current_employee_id())
with check (public.is_admin() or employee_id = public.current_employee_id());

drop policy if exists "records own" on public.medical_records;
create policy "records own" on public.medical_records
for all using (public.is_admin() or employee_id = public.current_employee_id())
with check (public.is_admin() or employee_id = public.current_employee_id());

-- Feedback: público insere; leitura admin
drop policy if exists "public feedback insert" on public.feedback;
create policy "public feedback insert" on public.feedback
for insert with check (true);

drop policy if exists "admin feedback all" on public.feedback;
create policy "admin feedback all" on public.feedback
for all using (public.is_admin()) with check (public.is_admin());

-- Site settings
drop policy if exists "public site setting read" on public.site_settings;
create policy "public site setting read" on public.site_settings
for select using (true);

drop policy if exists "admin site setting write" on public.site_settings;
create policy "admin site setting write" on public.site_settings
for all using (public.is_admin()) with check (public.is_admin());

-- Auditoria
drop policy if exists "admin audit read" on public.audit_logs;
create policy "admin audit read" on public.audit_logs
for select using (public.is_admin());

drop policy if exists "authenticated audit insert" on public.audit_logs;
create policy "authenticated audit insert" on public.audit_logs
for insert with check (auth.uid() = actor_id);

-- Trigger para criar perfil base quando um utilizador se regista.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- IMPORTANTE:
-- Depois de criar a conta do primeiro administrador, execute:
-- update public.profiles set role='admin', active=true where id='UUID_DO_ADMIN';
