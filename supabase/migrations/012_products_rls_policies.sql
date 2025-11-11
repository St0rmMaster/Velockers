-- Ensure robust RLS policies for products
-- 1) Public (anon) can SELECT only active rows
-- 2) Admins can SELECT all, INSERT/UPDATE/DELETE only their own rows (admin_id = auth.uid())

-- Helper: is_admin() checks presence in admins table
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.admins a
    where a.id = auth.uid()
  );
$$;

-- Enable RLS
alter table public.products enable row level security;

-- Reset existing conflicting policies (if any)
drop policy if exists allow_public_read_active_products on public.products;
drop policy if exists allow_admin_read_all_products on public.products;
drop policy if exists allow_admin_insert_products on public.products;
drop policy if exists allow_admin_update_own_products on public.products;
drop policy if exists allow_admin_delete_own_products on public.products;

-- Public can read only active products (for configurator)
create policy allow_public_read_active_products
on public.products
for select
to anon, authenticated
using (
  is_active = true
);

-- Admins can read all products
create policy allow_admin_read_all_products
on public.products
for select
to authenticated
using (
  public.is_admin()
);

-- Admins can insert products they own (admin_id must equal auth.uid())
create policy allow_admin_insert_products
on public.products
for insert
to authenticated
with check (
  public.is_admin() and admin_id = auth.uid()
);

-- Admins can update only their own products
create policy allow_admin_update_own_products
on public.products
for update
to authenticated
using (
  public.is_admin() and admin_id = auth.uid()
)
with check (
  public.is_admin() and admin_id = auth.uid()
);

-- Admins can delete only their own products
create policy allow_admin_delete_own_products
on public.products
for delete
to authenticated
using (
  public.is_admin() and admin_id = auth.uid()
);

-- Optional: ensure no one can accidentally bypass via replication role
-- (Supabase service role bypasses RLS by design)


