-- FINANCE IA: datas distintas da movimentação e do lançamento bancário.
-- Migração aditiva: mantém a coluna date atual para compatibilidade com versões antigas.
-- Não preenche automaticamente as novas colunas, pois isso poderia inventar uma data.

alter table public.transactions
  add column if not exists transaction_date date,
  add column if not exists posting_date date;

create index if not exists transactions_user_transaction_date_idx
  on public.transactions (user_id, transaction_date desc)
  where transaction_date is not null;

create index if not exists transactions_user_posting_date_idx
  on public.transactions (user_id, posting_date desc)
  where posting_date is not null;

comment on column public.transactions.date is
  'Data principal usada atualmente nos relatórios, mantida para compatibilidade.';

comment on column public.transactions.transaction_date is
  'Data em que a compra ou movimentação ocorreu, quando informada pela instituição.';

comment on column public.transactions.posting_date is
  'Data em que a movimentação foi efetivamente lançada na conta, quando informada pela instituição.';
