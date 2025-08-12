-- RLS: enable
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.embeddings enable row level security;
alter table public.messages enable row level security;
alter table public.tool_runs enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Documents
create policy "read approved" on public.documents for select using (status = 'approved');
create policy "authors read own" on public.documents for select using (author = auth.uid());
create policy "members create pending" on public.documents for insert with check (author = auth.uid());
create policy "admins manage" on public.documents for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'));

-- Embeddings (read only approved docs)
create policy "read embeddings of approved docs" on public.embeddings for select using (
  exists (select 1 from public.documents d where d.id = document_id and d.status='approved')
);

-- Messages
create policy "user read own messages" on public.messages for select using (user_id = auth.uid());
create policy "user insert own messages" on public.messages for insert with check (user_id = auth.uid());

-- Tool runs
create policy "user read own toolruns" on public.tool_runs for select using (user_id = auth.uid());
create policy "user insert own toolruns" on public.tool_runs for insert with check (user_id = auth.uid());

-- Audit logs (admin only)
create policy "admin read audits" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
);
