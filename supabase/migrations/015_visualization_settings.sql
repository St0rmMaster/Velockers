-- Create visualization_settings table for storing sandbox configuration
-- Used by admins to configure group visibility, material colors, and default environment

create table if not exists public.visualization_settings (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  settings_type text not null check (settings_type in ('groups', 'materials', 'environment')),
  settings_data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for faster lookups
create index if not exists idx_visualization_settings_type_active 
  on public.visualization_settings(settings_type, is_active);

create index if not exists idx_visualization_settings_admin_id 
  on public.visualization_settings(admin_id);

-- Enable RLS
alter table public.visualization_settings enable row level security;

-- Public (anon/authenticated) can read only active settings
create policy allow_public_read_active_visualization_settings
on public.visualization_settings
for select
to anon, authenticated
using (
  is_active = true
);

-- Admins can read all their own settings
create policy allow_admin_read_own_visualization_settings
on public.visualization_settings
for select
to authenticated
using (
  public.is_admin() and admin_id = auth.uid()
);

-- Admins can insert their own settings
create policy allow_admin_insert_visualization_settings
on public.visualization_settings
for insert
to authenticated
with check (
  public.is_admin() and admin_id = auth.uid()
);

-- Admins can update their own settings
create policy allow_admin_update_own_visualization_settings
on public.visualization_settings
for update
to authenticated
using (
  public.is_admin() and admin_id = auth.uid()
)
with check (
  public.is_admin() and admin_id = auth.uid()
);

-- Admins can delete their own settings
create policy allow_admin_delete_own_visualization_settings
on public.visualization_settings
for delete
to authenticated
using (
  public.is_admin() and admin_id = auth.uid()
);

-- Trigger to update updated_at timestamp
create or replace function public.update_visualization_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_visualization_settings_updated_at
  before update on public.visualization_settings
  for each row
  execute function public.update_visualization_settings_updated_at();

