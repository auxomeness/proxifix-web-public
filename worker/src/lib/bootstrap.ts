import { getSqlClient } from './db'
import type { WorkerEnv } from '../types/env'

const ensuredSchemas = new Set<string>()

const statements = [
  `DO $$ BEGIN
     CREATE TYPE user_role AS ENUM ('client', 'worker', 'admin');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE user_status AS ENUM ('active', 'pending_verification', 'suspended', 'deactivated');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE auth_provider AS ENUM ('google', 'password');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE profile_image_source AS ENUM ('google', 'custom');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE verification_status AS ENUM ('not_started', 'pending', 'under_review', 'approved', 'rejected');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE availability_status AS ENUM ('available', 'busy', 'offline');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE concern_urgency AS ENUM ('urgent', 'normal', 'low');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE concern_status AS ENUM ('open', 'awaiting_responses', 'worker_selected', 'in_progress', 'completed', 'cancelled');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE location_privacy_state AS ENUM ('approximate', 'request_pending', 'exact_shared');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE worker_lead_state AS ENUM ('new', 'interested', 'offer_sent', 'declined');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn', 'saved');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE conversation_status AS ENUM ('active', 'closed');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE message_type AS ENUM ('text', 'system');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE message_delivery_status AS ENUM ('sent', 'delivered', 'seen');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE notification_status AS ENUM ('unread', 'read', 'archived');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE verification_submission_status AS ENUM ('draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended', 'resubmission_requested');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE verification_document_type AS ENUM ('profile_photo', 'government_id', 'certification', 'portfolio');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE verification_review_state AS ENUM ('ready', 'needs_check', 'approved');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE incident_severity AS ENUM ('high', 'medium', 'low');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `DO $$ BEGIN
     CREATE TYPE incident_status AS ENUM ('open', 'investigating', 'resolved');
   EXCEPTION
     WHEN duplicate_object THEN null;
   END $$;`,
  `CREATE TABLE IF NOT EXISTS users (
     id text PRIMARY KEY,
     email text NOT NULL,
     display_name text NOT NULL,
     role user_role NOT NULL,
     status user_status NOT NULL DEFAULT 'active',
     google_avatar_url text,
     profile_image_url text,
     profile_image_source profile_image_source NOT NULL DEFAULT 'google',
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);`,
  `CREATE TABLE IF NOT EXISTS profiles (
     user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     phone text,
     city text,
     bio text,
     profile_completed boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_label text;`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_radius_km integer NOT NULL DEFAULT 5;`,
  `CREATE TABLE IF NOT EXISTS worker_profiles (
     user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     specialty text,
     about_me text,
     work_experience text,
     service_radius_km integer NOT NULL DEFAULT 5,
     verification_status verification_status NOT NULL DEFAULT 'not_started',
     verification_submitted_at timestamptz,
     profile_photo_required boolean NOT NULL DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS coverage_area_label text;`,
  `ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS availability_status availability_status NOT NULL DEFAULT 'available';`,
  `ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS verification_badge_active boolean NOT NULL DEFAULT false;`,
  `CREATE TABLE IF NOT EXISTS auth_accounts (
     id text PRIMARY KEY,
     user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     provider auth_provider NOT NULL,
     provider_account_id text NOT NULL,
     provider_email text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     last_login_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_account_idx
     ON auth_accounts(provider, provider_account_id);`,
  `CREATE TABLE IF NOT EXISTS password_credentials (
     user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     password_hash text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id text PRIMARY KEY,
     user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash text NOT NULL,
     provider auth_provider NOT NULL,
     expires_at timestamptz NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     last_seen_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);`,
  `CREATE TABLE IF NOT EXISTS service_categories (
     id text PRIMARY KEY,
     slug text NOT NULL,
     name text NOT NULL,
     description text,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS service_categories_slug_idx ON service_categories(slug);`,
  `CREATE TABLE IF NOT EXISTS worker_service_categories (
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     category_id text NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY(worker_id, category_id)
   );`,
  `CREATE INDEX IF NOT EXISTS worker_service_categories_worker_idx ON worker_service_categories(worker_id);`,
  `CREATE TABLE IF NOT EXISTS service_requests (
     id text PRIMARY KEY,
     client_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     category_id text REFERENCES service_categories(id) ON DELETE SET NULL,
     selected_worker_id text REFERENCES users(id) ON DELETE SET NULL,
     title text NOT NULL,
     description text NOT NULL,
     urgency concern_urgency NOT NULL DEFAULT 'normal',
     status concern_status NOT NULL DEFAULT 'open',
     visibility_radius_km integer NOT NULL DEFAULT 5,
     approximate_location_label text NOT NULL,
     exact_location_label text,
     exact_latitude double precision,
     exact_longitude double precision,
     location_privacy_state location_privacy_state NOT NULL DEFAULT 'approximate',
     location_requested_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
     location_shared_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
     location_shared_until timestamptz,
     preferred_schedule_at timestamptz,
     preferred_schedule_label text,
     budget_min_amount integer,
     budget_max_amount integer,
     deleted_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS service_requests_client_idx ON service_requests(client_id);`,
  `CREATE INDEX IF NOT EXISTS service_requests_status_idx ON service_requests(status);`,
  `CREATE TABLE IF NOT EXISTS service_request_attachments (
     id text PRIMARY KEY,
     request_id text NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
     label text NOT NULL,
     asset_url text NOT NULL,
     asset_kind text NOT NULL DEFAULT 'image',
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS service_request_attachments_request_idx ON service_request_attachments(request_id);`,
  `CREATE TABLE IF NOT EXISTS worker_lead_states (
     request_id text NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     state worker_lead_state NOT NULL DEFAULT 'new',
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY(request_id, worker_id)
   );`,
  `CREATE INDEX IF NOT EXISTS worker_lead_states_worker_idx ON worker_lead_states(worker_id);`,
  `CREATE TABLE IF NOT EXISTS offers (
     id text PRIMARY KEY,
     request_id text NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     note text NOT NULL,
     price_amount integer NOT NULL,
     eta_minutes integer,
     arrival_label text NOT NULL,
     proposed_schedule_at timestamptz,
     proposed_schedule_label text NOT NULL,
     status offer_status NOT NULL DEFAULT 'pending',
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS offers_request_worker_idx ON offers(request_id, worker_id);`,
  `CREATE INDEX IF NOT EXISTS offers_request_idx ON offers(request_id);`,
  `CREATE TABLE IF NOT EXISTS conversations (
     id text PRIMARY KEY,
     request_id text NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
     client_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     status conversation_status NOT NULL DEFAULT 'active',
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     last_message_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS conversations_request_worker_idx ON conversations(request_id, worker_id);`,
  `CREATE INDEX IF NOT EXISTS conversations_client_idx ON conversations(client_id);`,
  `CREATE INDEX IF NOT EXISTS conversations_worker_idx ON conversations(worker_id);`,
  `CREATE TABLE IF NOT EXISTS messages (
     id text PRIMARY KEY,
     conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     body text NOT NULL,
     message_type message_type NOT NULL DEFAULT 'text',
     delivery_status message_delivery_status NOT NULL DEFAULT 'sent',
     seen_at timestamptz,
     reply_to_message_id text,
      idempotency_key text,
     is_deleted_for_everyone boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key text;`,
  `CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);`,
  `CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_id);`,
    `CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency_idx ON messages(conversation_id, sender_id, idempotency_key);`,
  `CREATE TABLE IF NOT EXISTS saved_workers (
     client_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY(client_id, worker_id)
   );`,
  `CREATE INDEX IF NOT EXISTS saved_workers_worker_idx ON saved_workers(worker_id);`,
  `CREATE TABLE IF NOT EXISTS reviews (
     id text PRIMARY KEY,
     request_id text NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
     reviewer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     reviewee_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rating integer NOT NULL,
     body text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reviews_request_reviewer_reviewee_idx ON reviews(request_id, reviewer_id, reviewee_id);`,
  `CREATE TABLE IF NOT EXISTS verification_submissions (
     id text PRIMARY KEY,
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     status verification_submission_status NOT NULL DEFAULT 'draft',
     note text,
     feedback text,
     submitted_at timestamptz,
     reviewed_at timestamptz,
     reviewed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS verification_submissions_worker_idx ON verification_submissions(worker_id);`,
  `CREATE TABLE IF NOT EXISTS verification_documents (
     id text PRIMARY KEY,
     submission_id text NOT NULL REFERENCES verification_submissions(id) ON DELETE CASCADE,
     document_type verification_document_type NOT NULL,
     label text NOT NULL,
     file_url text NOT NULL,
     summary text,
     preview_title text,
     preview_body text,
     evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
     review_state verification_review_state NOT NULL DEFAULT 'ready',
     submitted_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS verification_documents_submission_idx ON verification_documents(submission_id);`,
  `CREATE TABLE IF NOT EXISTS worker_portfolio_items (
     id text PRIMARY KEY,
     worker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title text NOT NULL,
     description text NOT NULL,
     asset_url text,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS worker_portfolio_items_worker_idx ON worker_portfolio_items(worker_id);`,
  `CREATE TABLE IF NOT EXISTS notifications (
     id text PRIMARY KEY,
     user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     type text NOT NULL,
     title text NOT NULL,
     body text NOT NULL,
     status notification_status NOT NULL DEFAULT 'unread',
     related_entity_type text,
     related_entity_id text,
     created_at timestamptz NOT NULL DEFAULT now(),
     read_at timestamptz
   );`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);`,
  `CREATE TABLE IF NOT EXISTS incident_reports (
     id text PRIMARY KEY,
     title text NOT NULL,
     severity incident_severity NOT NULL DEFAULT 'low',
     submitted_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
     target_user_id text REFERENCES users(id) ON DELETE SET NULL,
     reason text NOT NULL,
     status incident_status NOT NULL DEFAULT 'open',
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS incident_reports_status_idx ON incident_reports(status);`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
     id text PRIMARY KEY,
     actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
     target_user_id text REFERENCES users(id) ON DELETE SET NULL,
     entity_type text NOT NULL,
     entity_id text NOT NULL,
     action text NOT NULL,
     summary text NOT NULL,
     metadata jsonb,
     created_at timestamptz NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);`,
  `CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_user_id);`
]

export const ensureDatabaseSchema = async (env: WorkerEnv) => {
  const connectionString = env.PROXIFIX_DB?.connectionString ?? env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Database connection is required before bootstrapping the ProxiFix schema.')
  }

  if (ensuredSchemas.has(connectionString)) {
    return
  }

  try {
    const sql = getSqlClient(env)
    for (const statement of statements) {
      await sql.unsafe(statement)
    }
    ensuredSchemas.add(connectionString)
  } catch (error) {
    ensuredSchemas.delete(connectionString)
    throw error
  }
}

export const ensureAuthSchema = ensureDatabaseSchema
