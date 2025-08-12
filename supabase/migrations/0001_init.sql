-- Enable extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Profiles (roles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamp with time zone default now()
);

-- Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  author uuid references public.profiles(id),
  storage_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Embeddings (RAG)
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536)
);

-- Messages (chat history)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  citations jsonb,
  created_at timestamptz default now()
);

-- Tool runs (for analytics)
create table if not exists public.tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tool text not null,
  payload jsonb,
  result jsonb,
  created_at timestamptz default now()
);

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  subject text,
  meta jsonb,
  created_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_docs_status on public.documents(status);
create index if not exists idx_embeddings_doc on public.embeddings(document_id);
create index if not exists idx_embeddings_vec on public.embeddings using ivfflat (embedding vector_cosine_ops);
