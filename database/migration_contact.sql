-- Migration: Add contact submissions and newsletter subscriptions tables

BEGIN;

-- Contact form submissions --------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_submissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    email             TEXT NOT NULL,
    message           TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'new' 
                        CHECK (status IN ('new', 'read', 'responded', 'archived')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status 
  ON contact_submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email 
  ON contact_submissions (lower(email));

-- Newsletter subscriptions --------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL UNIQUE,
    name              TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_active 
  ON newsletter_subscriptions (is_active, subscribed_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_email 
  ON newsletter_subscriptions (lower(email));

COMMIT;
