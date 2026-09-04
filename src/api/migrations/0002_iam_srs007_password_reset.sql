-- IAM-SRS-007: change/reset password support
-- password_changed_at: cutoff for invalidating sessions issued before a password change
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  token_hash varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX ix_password_reset_tokens_user ON public.password_reset_tokens (user_id);
CREATE UNIQUE INDEX ux_password_reset_tokens_hash ON public.password_reset_tokens (token_hash);
