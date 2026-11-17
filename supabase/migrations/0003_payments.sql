-- 0003_payments
create type payment_status as enum
  ('pending','proof_submitted','under_verification','verified','failed','rejected','refunded','partially_refunded');

create table payment_methods (
  code text primary key,                 -- upi, upi_qr, bank_transfer, razorpay, venue, ...
  label text not null,
  provider text not null default 'manual',
  sort_order int not null default 0
);

create table payment_settings (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references event_editions(id) on delete cascade,
  method_code text not null references payment_methods(code),
  enabled boolean not null default false,
  config jsonb not null default '{}',     -- UPI id, bank details, instructions. NEVER secrets.
  qr_asset_path text,
  deadline timestamptz,
  verification_mode text not null default 'manual' check (verification_mode in ('manual','automatic')),
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  currency char(3) not null default 'INR',
  discounts jsonb not null default '[]',
  version int not null default 1,
  updated_at timestamptz not null default now(),
  unique (edition_id, method_code)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete restrict,
  method_code text not null references payment_methods(code),
  status payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null,
  fee_snapshot jsonb not null,             -- historical fee/discount at creation time
  settings_version int,
  transaction_ref text,
  gateway_order_id text,
  gateway_payment_id text,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payments_gateway_uniq on payments (method_code, gateway_payment_id) where gateway_payment_id is not null;
create index payments_reg_idx on payments (registration_id);
create index payments_status_idx on payments (status);
create trigger t_upd before update on payments for each row execute function set_updated_at();

create table payment_events (            -- immutable ledger
  id bigint generated always as identity primary key,
  payment_id uuid not null references payments(id) on delete restrict,
  event_type text not null,
  from_status payment_status,
  to_status payment_status,
  amount numeric(12,2),
  actor_id uuid,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index payment_events_idx on payment_events (payment_id);

create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete restrict,
  storage_path text not null,
  mime text not null,
  size_bytes int not null check (size_bytes > 0),
  uploaded_at timestamptz not null default now()
);

create table payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  signature_valid boolean not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'recorded',
  gateway_refund_id text,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);

insert into payment_methods (code,label,provider,sort_order) values
 ('upi','UPI','manual',1),('upi_qr','UPI QR code','manual',2),('bank_transfer','Bank transfer','manual',3),
 ('razorpay','Razorpay (card / UPI / netbanking)','razorpay',4),('venue','Pay at venue','manual',5);
