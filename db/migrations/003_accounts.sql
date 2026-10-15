-- Identidade própria do Moont. O ID do cliente Stripe é um vínculo de cobrança,
-- não a chave primária da conta. Emails NÃO são únicos: o legado pode conter
-- clientes Stripe distintos com o mesmo endereço.
BEGIN;

CREATE SCHEMA IF NOT EXISTS moont;
REVOKE ALL ON SCHEMA moont FROM PUBLIC;

CREATE TABLE IF NOT EXISTS moont.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email text CHECK (primary_email IS NULL OR length(primary_email) BETWEEN 3 AND 320),
  identity_epoch text NOT NULL DEFAULT '' CHECK (length(identity_epoch) <= 255),
  session_revoked_before bigint NOT NULL DEFAULT 0 CHECK (session_revoked_before >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A ligação só é criada depois de recuperar o customer exato pela API Stripe.
-- Um customer e uma conta têm no máximo um vínculo cada; email não participa.
CREATE TABLE IF NOT EXISTS moont.account_stripe_customers (
  stripe_customer_id text PRIMARY KEY
    CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$' AND length(stripe_customer_id) <= 255),
  account_id uuid NOT NULL UNIQUE REFERENCES moont.accounts(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- subject é o ID estável do provedor: Google sub ou customer Stripe para senha.
-- A unicidade é do provedor e subject, nunca do email. Uma conta pode ter
-- múltiplos provedores e emails de login distintos.
CREATE TABLE IF NOT EXISTS moont.account_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES moont.accounts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('password', 'google')),
  provider_subject text NOT NULL
    CHECK (length(provider_subject) BETWEEN 1 AND 255),
  email_normalized text
    CHECK (email_normalized IS NULL OR length(email_normalized) BETWEEN 3 AND 320),
  migration_source text NOT NULL DEFAULT 'stripe_metadata'
    CHECK (migration_source IN ('stripe_metadata', 'verified_login', 'registration')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS account_identities_account_idx
  ON moont.account_identities (account_id);
CREATE INDEX IF NOT EXISTS account_identities_password_email_idx
  ON moont.account_identities (email_normalized)
  WHERE provider = 'password';

-- Cópia exata do scrypt legado, sem rehash e sem senha em claro. O algoritmo
-- precisa continuar igual ao usado por api/lib/password-auth.js até o usuário
-- redefinir a senha após a virada.
CREATE TABLE IF NOT EXISTS moont.account_password_credentials (
  account_id uuid PRIMARY KEY REFERENCES moont.accounts(id) ON DELETE CASCADE,
  password_salt text NOT NULL CHECK (length(password_salt) BETWEEN 1 AND 500),
  password_hash text NOT NULL CHECK (length(password_hash) BETWEEN 1 AND 500),
  algorithm text NOT NULL DEFAULT 'scrypt-n16384-r8-p1-key64'
    CHECK (algorithm = 'scrypt-n16384-r8-p1-key64'),
  migrated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Só o backend com credencial privada acessa o schema. Nenhuma tabela é
-- exposta à API pública do Supabase/PostgREST.
REVOKE ALL ON ALL TABLES IN SCHEMA moont FROM PUBLIC;
ALTER TABLE moont.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.account_stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.account_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.account_password_credentials ENABLE ROW LEVEL SECURITY;
COMMIT;
