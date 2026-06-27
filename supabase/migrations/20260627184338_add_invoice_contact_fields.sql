alter table public.invoices
  add column if not exists contact_name text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists contact_phone text not null default '',
  add column if not exists last_reminded_at timestamp with time zone;

comment on column public.invoices.contact_name is 'Contact person for invoice follow-up.';
comment on column public.invoices.contact_email is 'Email address for invoice follow-up.';
comment on column public.invoices.contact_phone is 'Phone number for invoice follow-up.';
comment on column public.invoices.last_reminded_at is 'Timestamp of the last invoice reminder action.';
