-- ============================================
-- Migration: 00010_notifications
-- Purpose: Notification records for in-app + external delivery
-- ============================================

CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  title       text NOT NULL,
  body        text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb, -- deep link, booking_id, etc.
  is_read     boolean NOT NULL DEFAULT false,
  sent_at     timestamptz, -- NULL until dispatched externally
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Unread notifications for a user (in-app bell)
CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC)
  WHERE is_read = false;

-- Pending external notifications to dispatch
CREATE INDEX idx_notif_pending ON notifications(channel, created_at)
  WHERE sent_at IS NULL AND channel != 'in_app';

-- Cleanup: old read notifications (for future maintenance)
CREATE INDEX idx_notif_old ON notifications(created_at)
  WHERE is_read = true;
