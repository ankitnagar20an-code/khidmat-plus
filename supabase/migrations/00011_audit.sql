-- ============================================
-- Migration: 00011_audit
-- Purpose: Audit log for all significant system actions
-- ============================================

CREATE TABLE public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES users(id), -- NULL for system/cron actions
  action        text NOT NULL,              -- e.g. 'booking.created', 'provider.suspended'
  entity_type   text NOT NULL,              -- e.g. 'booking', 'provider', 'payment'
  entity_id     uuid NOT NULL,
  old_data      jsonb,
  new_data      jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_al_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_al_actor ON audit_logs(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;
CREATE INDEX idx_al_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_al_created ON audit_logs(created_at DESC);
