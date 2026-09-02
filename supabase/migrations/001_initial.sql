create extension if not exists pgcrypto;

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog', 'cat')),
  breed text,
  gender text not null default 'unknown' check (gender in ('male', 'female', 'unknown')),
  birth_date date,
  bio text,
  cover_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_images (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.styles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  thumbnail_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  style_id uuid not null references public.styles(id),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.generation_images (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  is_saved boolean not null default false,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pets_user_id_idx on public.pets(user_id);
create index if not exists pet_images_user_id_created_at_idx on public.pet_images(user_id, created_at desc);
create index if not exists generations_user_id_created_at_idx on public.generations(user_id, created_at desc);
create index if not exists generation_images_user_id_created_at_idx on public.generation_images(user_id, created_at desc);

insert into public.styles (id, name, slug, description)
values
  ('1b047451-0101-4001-8001-000000000001', '봄날 산책', 'spring-walk', '꽃길을 걷는 화사한 봄날'),
  ('1b047451-0101-4001-8001-000000000002', '스튜디오 증명사진', 'studio-id', '깔끔하고 사랑스러운 정면 사진'),
  ('1b047451-0101-4001-8001-000000000003', '영화 포스터', 'movie-poster', '한 편의 영화 같은 주인공 컷'),
  ('1b047451-0101-4001-8001-000000000004', '클래식 초상화', 'classic-portrait', '고전 회화 느낌의 품격 있는 초상'),
  ('1b047451-0101-4001-8001-000000000005', '생일 파티', 'birthday-party', '케이크와 함께하는 특별한 하루'),
  ('1b047451-0101-4001-8001-000000000006', '감성 카페', 'cozy-cafe', '따뜻한 햇살이 드는 감성 카페')
on conflict (id) do nothing;

alter table public.pets enable row level security;
alter table public.pet_images enable row level security;
alter table public.styles enable row level security;
alter table public.generations enable row level security;
alter table public.generation_images enable row level security;

drop policy if exists "users_manage_own_pets" on public.pets;
create policy "users_manage_own_pets" on public.pets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users_manage_own_pet_images" on public.pet_images;
create policy "users_manage_own_pet_images" on public.pet_images for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "authenticated_read_styles" on public.styles;
create policy "authenticated_read_styles" on public.styles for select to authenticated using (is_active = true);
drop policy if exists "users_manage_own_generations" on public.generations;
create policy "users_manage_own_generations" on public.generations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users_manage_own_generation_images" on public.generation_images;
create policy "users_manage_own_generation_images" on public.generation_images for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-uploads', 'pet-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('generated-images', 'generated-images', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users_read_own_pet_uploads" on storage.objects;
create policy "users_read_own_pet_uploads" on storage.objects for select to authenticated using (bucket_id = 'pet-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users_upload_own_pet_uploads" on storage.objects;
create policy "users_upload_own_pet_uploads" on storage.objects for insert to authenticated with check (bucket_id = 'pet-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users_update_own_pet_uploads" on storage.objects;
create policy "users_update_own_pet_uploads" on storage.objects for update to authenticated using (bucket_id = 'pet-uploads' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'pet-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users_delete_own_pet_uploads" on storage.objects;
create policy "users_delete_own_pet_uploads" on storage.objects for delete to authenticated using (bucket_id = 'pet-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users_read_own_generated_images" on storage.objects;
create policy "users_read_own_generated_images" on storage.objects for select to authenticated using (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users_upload_own_generated_images" on storage.objects;
create policy "users_upload_own_generated_images" on storage.objects for insert to authenticated with check (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users_update_own_generated_images" on storage.objects;
create policy "users_update_own_generated_images" on storage.objects for update to authenticated using (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users_delete_own_generated_images" on storage.objects;
create policy "users_delete_own_generated_images" on storage.objects for delete to authenticated using (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text);
