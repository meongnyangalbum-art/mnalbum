create table if not exists public.album_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

alter table public.album_folders add column if not exists cover_storage_path text;
alter table public.album_folders add column if not exists cover_bucket text;
alter table public.album_folders add column if not exists sort_order integer not null default 0;

alter table public.pet_images add column if not exists folder_id uuid references public.album_folders(id) on delete set null;
alter table public.pet_images add column if not exists taken_at timestamptz;
alter table public.pet_images add column if not exists note text;
alter table public.generation_images add column if not exists folder_id uuid references public.album_folders(id) on delete set null;
alter table public.generation_images add column if not exists taken_at timestamptz;
alter table public.generation_images add column if not exists note text;

update public.pet_images set taken_at = created_at where taken_at is null;
update public.generation_images set taken_at = created_at where taken_at is null;

create index if not exists album_folders_user_pet_idx on public.album_folders(user_id, pet_id);
create index if not exists pet_images_pet_folder_taken_idx on public.pet_images(pet_id, folder_id, taken_at desc);
create index if not exists generation_images_folder_taken_idx on public.generation_images(folder_id, taken_at desc);

alter table public.album_folders enable row level security;

drop policy if exists "users_manage_own_album_folders" on public.album_folders;
create policy "users_manage_own_album_folders"
on public.album_folders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
