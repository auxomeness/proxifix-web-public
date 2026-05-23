import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['client', 'worker', 'admin'])
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'pending_verification',
  'suspended',
  'deactivated'
])
export const authProviderEnum = pgEnum('auth_provider', ['google', 'password'])
export const profileImageSourceEnum = pgEnum('profile_image_source', ['google', 'custom'])
export const verificationStatusEnum = pgEnum('verification_status', [
  'not_started',
  'pending',
  'under_review',
  'approved',
  'rejected'
])
export const availabilityStatusEnum = pgEnum('availability_status', ['available', 'busy', 'offline'])
export const concernUrgencyEnum = pgEnum('concern_urgency', ['urgent', 'normal', 'low'])
export const concernStatusEnum = pgEnum('concern_status', [
  'open',
  'awaiting_responses',
  'worker_selected',
  'in_progress',
  'completed',
  'cancelled'
])
export const locationPrivacyStateEnum = pgEnum('location_privacy_state', [
  'approximate',
  'request_pending',
  'exact_shared'
])
export const workerLeadStateEnum = pgEnum('worker_lead_state', [
  'new',
  'interested',
  'offer_sent',
  'declined'
])
export const offerStatusEnum = pgEnum('offer_status', [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'saved'
])
export const conversationStatusEnum = pgEnum('conversation_status', ['active', 'closed'])
export const messageTypeEnum = pgEnum('message_type', ['text', 'system'])
export const messageDeliveryStatusEnum = pgEnum('message_delivery_status', ['sent', 'delivered', 'seen'])
export const notificationStatusEnum = pgEnum('notification_status', ['unread', 'read', 'archived'])
export const verificationSubmissionStatusEnum = pgEnum('verification_submission_status', [
  'draft',
  'pending',
  'under_review',
  'approved',
  'rejected',
  'suspended',
  'resubmission_requested'
])
export const verificationDocumentTypeEnum = pgEnum('verification_document_type', [
  'profile_photo',
  'government_id',
  'certification',
  'portfolio'
])
export const verificationReviewStateEnum = pgEnum('verification_review_state', [
  'ready',
  'needs_check',
  'approved'
])
export const incidentSeverityEnum = pgEnum('incident_severity', ['high', 'medium', 'low'])
export const incidentStatusEnum = pgEnum('incident_status', ['open', 'investigating', 'resolved'])

export const users = pgTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    googleAvatarUrl: text('google_avatar_url'),
    profileImageUrl: text('profile_image_url'),
    profileImageSource: profileImageSourceEnum('profile_image_source')
      .notNull()
      .default('google'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email)
  })
)

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProviderEnum('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    providerEmail: text('provider_email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    providerAccountIdx: uniqueIndex('auth_accounts_provider_account_idx').on(
      table.provider,
      table.providerAccountId
    )
  })
)

export const profiles = pgTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  phone: text('phone'),
  city: text('city'),
  addressLabel: text('address_label'),
  bio: text('bio'),
  preferredRadiusKm: integer('preferred_radius_km').notNull().default(5),
  profileCompleted: boolean('profile_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const workerProfiles = pgTable('worker_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  specialty: text('specialty'),
  aboutMe: text('about_me'),
  workExperience: text('work_experience'),
  serviceRadiusKm: integer('service_radius_km').notNull().default(5),
  coverageAreaLabel: text('coverage_area_label'),
  availabilityStatus: availabilityStatusEnum('availability_status').notNull().default('available'),
  verificationStatus: verificationStatusEnum('verification_status')
    .notNull()
    .default('not_started'),
  verificationSubmittedAt: timestamp('verification_submitted_at', { withTimezone: true }),
  profilePhotoRequired: boolean('profile_photo_required').notNull().default(true),
  verificationBadgeActive: boolean('verification_badge_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const passwordCredentials = pgTable('password_credentials', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    provider: authProviderEnum('provider').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('sessions_token_hash_idx').on(table.tokenHash)
  })
)

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIdx: uniqueIndex('service_categories_slug_idx').on(table.slug)
  })
)

export const workerServiceCategories = pgTable(
  'worker_service_categories',
  {
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workerId, table.categoryId], name: 'worker_service_categories_pk' }),
    workerIdx: index('worker_service_categories_worker_idx').on(table.workerId)
  })
)

export const serviceRequests = pgTable(
  'service_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => serviceCategories.id, { onDelete: 'set null' }),
    selectedWorkerId: text('selected_worker_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    urgency: concernUrgencyEnum('urgency').notNull().default('normal'),
    status: concernStatusEnum('status').notNull().default('open'),
    visibilityRadiusKm: integer('visibility_radius_km').notNull().default(5),
    approximateLocationLabel: text('approximate_location_label').notNull(),
    exactLocationLabel: text('exact_location_label'),
    exactLatitude: doublePrecision('exact_latitude'),
    exactLongitude: doublePrecision('exact_longitude'),
    locationPrivacyState: locationPrivacyStateEnum('location_privacy_state')
      .notNull()
      .default('approximate'),
    locationRequestedByUserId: text('location_requested_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    locationSharedByUserId: text('location_shared_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    locationSharedUntil: timestamp('location_shared_until', { withTimezone: true }),
    preferredScheduleAt: timestamp('preferred_schedule_at', { withTimezone: true }),
    preferredScheduleLabel: text('preferred_schedule_label'),
    budgetMinAmount: integer('budget_min_amount'),
    budgetMaxAmount: integer('budget_max_amount'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    clientIdx: index('service_requests_client_idx').on(table.clientId),
    statusIdx: index('service_requests_status_idx').on(table.status)
  })
)

export const serviceRequestAttachments = pgTable(
  'service_request_attachments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    assetUrl: text('asset_url').notNull(),
    assetKind: text('asset_kind').notNull().default('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    requestIdx: index('service_request_attachments_request_idx').on(table.requestId)
  })
)

export const workerLeadStates = pgTable(
  'worker_lead_states',
  {
    requestId: text('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: workerLeadStateEnum('state').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.requestId, table.workerId], name: 'worker_lead_states_pk' }),
    workerIdx: index('worker_lead_states_worker_idx').on(table.workerId)
  })
)

export const offers = pgTable(
  'offers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    priceAmount: integer('price_amount').notNull(),
    etaMinutes: integer('eta_minutes'),
    arrivalLabel: text('arrival_label').notNull(),
    proposedScheduleAt: timestamp('proposed_schedule_at', { withTimezone: true }),
    proposedScheduleLabel: text('proposed_schedule_label').notNull(),
    status: offerStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    requestWorkerIdx: uniqueIndex('offers_request_worker_idx').on(table.requestId, table.workerId),
    requestIdx: index('offers_request_idx').on(table.requestId)
  })
)

export const conversations = pgTable(
  'conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: conversationStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    requestWorkerIdx: uniqueIndex('conversations_request_worker_idx').on(table.requestId, table.workerId),
    clientIdx: index('conversations_client_idx').on(table.clientId),
    workerIdx: index('conversations_worker_idx').on(table.workerId)
  })
)

export const messages = pgTable(
  'messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    messageType: messageTypeEnum('message_type').notNull().default('text'),
    deliveryStatus: messageDeliveryStatusEnum('delivery_status').notNull().default('sent'),
    seenAt: timestamp('seen_at', { withTimezone: true }),
    replyToMessageId: text('reply_to_message_id'),
    idempotencyKey: text('idempotency_key'),
    isDeletedForEveryone: boolean('is_deleted_for_everyone').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationIdx: index('messages_conversation_idx').on(table.conversationId),
    senderIdx: index('messages_sender_idx').on(table.senderId),
    conversationCreatedIdx: index('messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt
    ),
    idempotencyIdx: uniqueIndex('messages_idempotency_idx').on(
      table.conversationId,
      table.senderId,
      table.idempotencyKey
    )
  })
)

export const savedWorkers = pgTable(
  'saved_workers',
  {
    clientId: text('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.workerId], name: 'saved_workers_pk' }),
    workerIdx: index('saved_workers_worker_idx').on(table.workerId)
  })
)

export const reviews = pgTable(
  'reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    revieweeId: text('reviewee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    requestIdx: uniqueIndex('reviews_request_reviewer_reviewee_idx').on(
      table.requestId,
      table.reviewerId,
      table.revieweeId
    )
  })
)

export const verificationSubmissions = pgTable(
  'verification_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: verificationSubmissionStatusEnum('status').notNull().default('draft'),
    note: text('note'),
    feedback: text('feedback'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workerIdx: uniqueIndex('verification_submissions_worker_idx').on(table.workerId)
  })
)

export const verificationDocuments = pgTable(
  'verification_documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text('submission_id')
      .notNull()
      .references(() => verificationSubmissions.id, { onDelete: 'cascade' }),
    documentType: verificationDocumentTypeEnum('document_type').notNull(),
    label: text('label').notNull(),
    fileUrl: text('file_url').notNull(),
    summary: text('summary'),
    previewTitle: text('preview_title'),
    previewBody: text('preview_body'),
    evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
    reviewState: verificationReviewStateEnum('review_state').notNull().default('ready'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    submissionIdx: index('verification_documents_submission_idx').on(table.submissionId)
  })
)

export const workerPortfolioItems = pgTable(
  'worker_portfolio_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workerId: text('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    assetUrl: text('asset_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workerIdx: index('worker_portfolio_items_worker_idx').on(table.workerId)
  })
)

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: notificationStatusEnum('status').notNull().default('unread'),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: text('related_entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true })
  },
  (table) => ({
    userIdx: index('notifications_user_idx').on(table.userId)
  })
)

export const incidentReports = pgTable(
  'incident_reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    severity: incidentSeverityEnum('severity').notNull().default('low'),
    submittedByUserId: text('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    status: incidentStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index('incident_reports_status_idx').on(table.status)
  })
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    actorIdx: index('audit_logs_actor_idx').on(table.actorUserId)
  })
)

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
