import { and, eq, inArray } from 'drizzle-orm'

import {
  auditLogs,
  authAccounts,
  conversations,
  incidentReports,
  messages,
  notifications,
  offers,
  passwordCredentials,
  profiles,
  reviews,
  savedWorkers,
  serviceCategories,
  serviceRequestAttachments,
  serviceRequests,
  verificationDocuments,
  verificationSubmissions,
  workerLeadStates,
  workerPortfolioItems,
  workerProfiles,
  workerServiceCategories,
  users
} from '../db/schema'
import { getDb } from './db'
import { hashPassword } from './password'
import type { AppRole, WorkerEnv } from '../types/env'

type SeedFixture = {
  role: AppRole
  name: string
  email: string
  password: string
  city: string
  phone: string
  bio: string
  status: 'active' | 'pending_verification' | 'suspended' | 'deactivated'
  serviceCategory?: string
  aboutMe?: string
  workExperience?: string
  serviceRadiusKm?: number
  coverageAreaLabel?: string
  verificationStatus?: 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected'
  verificationBadgeActive?: boolean
}

const mockFixtures: SeedFixture[] = [
  {
    role: 'client',
    name: 'Maria Santos',
    email: 'client.maria@proxifix.test',
    password: 'Client123!',
    city: 'Makati City',
    phone: '+63 917 110 0101',
    bio: 'Frequently books home repair and emergency plumbing support for a condo household.',
    status: 'active'
  },
  {
    role: 'client',
    name: 'Justin Reyes',
    email: 'client.justin@proxifix.test',
    password: 'Client123!',
    city: 'Pasig City',
    phone: '+63 917 110 0102',
    bio: 'Uses ProxiFix for electrical troubleshooting and appliance maintenance in a family home.',
    status: 'active'
  },
  {
    role: 'client',
    name: 'Ella Navarro',
    email: 'client.ella@proxifix.test',
    password: 'Client123!',
    city: 'Quezon City',
    phone: '+63 917 110 0103',
    bio: 'Schedules tutoring and technical support requests, usually with flexible lead times.',
    status: 'active'
  },
  {
    role: 'worker',
    name: 'Marco Santos',
    email: 'worker.marco@proxifix.test',
    password: 'Worker123!',
    city: 'Makati City',
    phone: '+63 917 120 0201',
    bio: 'Verified residential plumber handling urgent leaks, fixture replacement, and maintenance visits.',
    status: 'active',
    serviceCategory: 'plumbing',
    aboutMe:
      'Seven years handling urgent plumbing repairs for condo and residential clients across Makati and Pasig.',
    workExperience:
      'Handled preventive maintenance, leak repair, and emergency plumbing service for more than 320 completed bookings.',
    serviceRadiusKm: 5,
    coverageAreaLabel: 'Makati service zone',
    verificationStatus: 'approved',
    verificationBadgeActive: true
  },
  {
    role: 'worker',
    name: 'Elaine Dela Cruz',
    email: 'worker.elaine@proxifix.test',
    password: 'Worker123!',
    city: 'Quezon City',
    phone: '+63 917 120 0202',
    bio: 'Licensed electrical technician for breaker issues, panel checks, and residential wiring fixes.',
    status: 'pending_verification',
    serviceCategory: 'electrical',
    aboutMe:
      'Electrical technician covering residential troubleshooting, panel inspections, and urgent fault isolation.',
    workExperience:
      'Five years in residential electrical work, circuit restoration, and safety-focused service calls.',
    serviceRadiusKm: 7,
    coverageAreaLabel: 'Pasig and Mandaluyong service zone',
    verificationStatus: 'under_review',
    verificationBadgeActive: false
  },
  {
    role: 'worker',
    name: 'Kevin Navarro',
    email: 'worker.kevin@proxifix.test',
    password: 'Worker123!',
    city: 'Taguig City',
    phone: '+63 917 120 0203',
    bio: 'IT support and device setup specialist for printers, laptops, software installation, and home office issues.',
    status: 'pending_verification',
    serviceCategory: 'technical-support',
    aboutMe:
      'On-site technician focused on device setup, troubleshooting, and small-office home-office support requests.',
    workExperience:
      'Six years supporting printer setup, workstation installation, and software recovery for home clients.',
    serviceRadiusKm: 8,
    coverageAreaLabel: 'Quezon City north service zone',
    verificationStatus: 'rejected',
    verificationBadgeActive: false
  },
  {
    role: 'admin',
    name: 'Ava Castillo',
    email: 'admin.ava@proxifix.test',
    password: 'Admin123!',
    city: 'Makati City',
    phone: '+63 917 130 0301',
    bio: 'Reviews worker verification and handles trust and moderation workflows.',
    status: 'active'
  },
  {
    role: 'admin',
    name: 'Liam Torres',
    email: 'admin.liam@proxifix.test',
    password: 'Admin123!',
    city: 'Pasig City',
    phone: '+63 917 130 0302',
    bio: 'Monitors platform activity, reports, and account actions for operations coverage.',
    status: 'active'
  },
  {
    role: 'admin',
    name: 'Sofia Mendoza',
    email: 'admin.sofia@proxifix.test',
    password: 'Admin123!',
    city: 'Quezon City',
    phone: '+63 917 130 0303',
    bio: 'Handles verification escalations, moderation triage, and administrative review follow-ups.',
    status: 'active'
  }
]

const categoryFixtures = [
  {
    id: 'CAT-PLUMBING',
    slug: 'plumbing',
    name: 'Plumbing',
    description: 'Leaks, fittings, drains, and residential plumbing maintenance.'
  },
  {
    id: 'CAT-ELECTRICAL',
    slug: 'electrical',
    name: 'Electrical Services',
    description: 'Breakers, panel checks, lighting, and wiring support.'
  },
  {
    id: 'CAT-TECHNICAL',
    slug: 'technical-support',
    name: 'Technical Support',
    description: 'Devices, printers, laptop setup, and home office troubleshooting.'
  },
  {
    id: 'CAT-TUTORING',
    slug: 'tutoring',
    name: 'Tutoring',
    description: 'Private tutoring and academic support.'
  },
  {
    id: 'CAT-COOLING',
    slug: 'cooling-services',
    name: 'Cooling Services',
    description: 'Air conditioning cleaning and cooling system maintenance.'
  }
] as const

const requestFixtures = [
  {
    id: 'CON-201',
    clientEmail: 'client.maria@proxifix.test',
    categorySlug: 'plumbing',
    selectedWorkerEmail: 'worker.marco@proxifix.test',
    title: 'Kitchen sink leak with low water pressure',
    description:
      'Leak under the sink started this morning and the faucet pressure dropped significantly. Need someone who can inspect tonight and confirm if fittings need immediate replacement.',
    urgency: 'urgent' as const,
    status: 'awaiting_responses' as const,
    visibilityRadiusKm: 5,
    approximateLocationLabel: 'Makati service zone',
    exactLocationLabel: 'Poblacion, Makati City',
    exactLatitude: 14.5656,
    exactLongitude: 121.0292,
    locationPrivacyState: 'approximate' as const,
    preferredScheduleLabel: 'Today, 6:30 PM',
    budgetMinAmount: 1500,
    budgetMaxAmount: 2300,
    attachments: [
      { id: 'ATT-201-1', label: 'Under-sink leak photo', assetUrl: 'https://images.proxifix.test/concerns/con-201-1.jpg' },
      { id: 'ATT-201-2', label: 'Cabinet moisture photo', assetUrl: 'https://images.proxifix.test/concerns/con-201-2.jpg' }
    ]
  },
  {
    id: 'CON-188',
    clientEmail: 'client.justin@proxifix.test',
    categorySlug: 'electrical',
    selectedWorkerEmail: 'worker.elaine@proxifix.test',
    title: 'Breaker inspection and hallway light issue',
    description:
      'Need an electrical technician to inspect a breaker issue and a flickering hallway light. Client can share another panel photo if needed.',
    urgency: 'normal' as const,
    status: 'worker_selected' as const,
    visibilityRadiusKm: 5,
    approximateLocationLabel: 'Pasig service zone',
    exactLocationLabel: 'Kapitolyo, Pasig City',
    exactLatitude: 14.5728,
    exactLongitude: 121.0622,
    locationPrivacyState: 'request_pending' as const,
    preferredScheduleLabel: 'Tomorrow, 10:00 AM',
    budgetMinAmount: 2800,
    budgetMaxAmount: 3600,
    attachments: [{ id: 'ATT-188-1', label: 'Breaker panel photo', assetUrl: 'https://images.proxifix.test/concerns/con-188-1.jpg' }]
  },
  {
    id: 'CON-172',
    clientEmail: 'client.ella@proxifix.test',
    categorySlug: 'technical-support',
    selectedWorkerEmail: 'worker.kevin@proxifix.test',
    title: 'Laptop setup and printer troubleshooting',
    description:
      'Need help connecting a home printer, moving office files, and checking the software setup before the weekend.',
    urgency: 'low' as const,
    status: 'in_progress' as const,
    visibilityRadiusKm: 8,
    approximateLocationLabel: 'Quezon City service zone',
    exactLocationLabel: 'Teachers Village, Quezon City',
    exactLatitude: 14.6498,
    exactLongitude: 121.0648,
    locationPrivacyState: 'exact_shared' as const,
    preferredScheduleLabel: 'Saturday, 1:00 PM',
    budgetMinAmount: 900,
    budgetMaxAmount: 1400,
    attachments: [{ id: 'ATT-172-1', label: 'Printer setup desk', assetUrl: 'https://images.proxifix.test/concerns/con-172-1.jpg' }]
  }
] as const

const verificationFixtures = [
  {
    submissionId: 'APP-432',
    workerEmail: 'worker.marco@proxifix.test',
    status: 'approved' as const,
    note: 'All submitted credentials are complete and match the public worker profile.',
    feedback: 'Verification approved. Worker badge remains active.',
    documentSet: [
      {
        id: 'APP-432-PROFILE',
        type: 'profile_photo' as const,
        label: 'Profile photo',
        fileUrl: 'https://images.proxifix.test/verification/marco-profile.jpg',
        summary: 'Profile photo is clear and suitable for worker discovery.',
        previewTitle: 'Public-facing profile image',
        previewBody: 'Identity photo aligns with the submitted worker profile and is suitable for public trust surfaces.',
        evidence: ['High contrast portrait', 'Face unobstructed', 'Matches worker identity'],
        reviewState: 'approved' as const
      },
      {
        id: 'APP-432-ID',
        type: 'government_id' as const,
        label: 'National ID',
        fileUrl: 'https://images.proxifix.test/verification/marco-id.jpg',
        summary: 'Government ID is readable and the document edges are visible.',
        previewTitle: 'Government-issued ID review',
        previewBody: 'ID details, worker name, and document completeness are all clear.',
        evidence: ['Name visible', 'Document edges complete', 'Birthdate readable'],
        reviewState: 'approved' as const
      },
      {
        id: 'APP-432-CERT',
        type: 'certification' as const,
        label: 'Plumbing certification',
        fileUrl: 'https://images.proxifix.test/verification/marco-cert.jpg',
        summary: 'Trade certification is readable and supports the worker’s public plumbing claim.',
        previewTitle: 'Certification proof',
        previewBody: 'Certification and issue date align with the worker profile and service claim.',
        evidence: ['Trade visible', 'Issue date readable', 'Certificate number readable'],
        reviewState: 'approved' as const
      }
    ]
  },
  {
    submissionId: 'APP-440',
    workerEmail: 'worker.elaine@proxifix.test',
    status: 'under_review' as const,
    note: 'Profile is complete. Final check needed on certificate date consistency.',
    feedback:
      'Please re-upload the certificate page with a clearer issue date so admin can confirm it against the profile details.',
    documentSet: [
      {
        id: 'APP-440-PROFILE',
        type: 'profile_photo' as const,
        label: 'Profile photo',
        fileUrl: 'https://images.proxifix.test/verification/elaine-profile.jpg',
        summary: 'Headshot is clear and matches the worker profile identity.',
        previewTitle: 'Public-facing profile image',
        previewBody: 'This image appears in discovery, profile, and chat views.',
        evidence: ['High contrast portrait', 'Matches profile name', 'No obstruction'],
        reviewState: 'ready' as const
      },
      {
        id: 'APP-440-ID',
        type: 'government_id' as const,
        label: 'National ID',
        fileUrl: 'https://images.proxifix.test/verification/elaine-id.jpg',
        summary: 'ID text is readable and document edges are visible.',
        previewTitle: 'Government-issued ID review',
        previewBody: 'Use this surface to verify identity and name matching.',
        evidence: ['Name visible', 'Document edges complete', 'ID number readable'],
        reviewState: 'ready' as const
      },
      {
        id: 'APP-440-CERT',
        type: 'certification' as const,
        label: 'TESDA certificate',
        fileUrl: 'https://images.proxifix.test/verification/elaine-cert.jpg',
        summary: 'Certificate is visible but issue date still needs confirmation.',
        previewTitle: 'Certification proof',
        previewBody: 'Certification supports the worker’s trade claim, but the issue date should be cross-checked.',
        evidence: ['Course title visible', 'Issue date visible', 'Certificate number readable'],
        reviewState: 'needs_check' as const
      },
      {
        id: 'APP-440-PORT',
        type: 'portfolio' as const,
        label: 'Portfolio set',
        fileUrl: 'https://images.proxifix.test/verification/elaine-portfolio.jpg',
        summary: 'Three recent project photos show residential electrical work clearly.',
        previewTitle: 'Recent project evidence',
        previewBody: 'Portfolio images support both skill credibility and recency.',
        evidence: ['3 uploaded images', 'Recent timestamps', 'Workmanship clearly visible'],
        reviewState: 'ready' as const
      }
    ]
  },
  {
    submissionId: 'APP-438',
    workerEmail: 'worker.kevin@proxifix.test',
    status: 'resubmission_requested' as const,
    note: 'Rejected for incomplete work proof and missing stronger identity scan.',
    feedback:
      'Please upload a clearer government ID and a stronger set of recent work samples before resubmitting.',
    documentSet: [
      {
        id: 'APP-438-PROFILE',
        type: 'profile_photo' as const,
        label: 'Profile photo',
        fileUrl: 'https://images.proxifix.test/verification/kevin-profile.jpg',
        summary: 'Profile photo is present and suitable for public visibility.',
        previewTitle: 'Worker profile photo',
        previewBody: 'The public photo is usable, but supporting documents still need improvement.',
        evidence: ['Face unobstructed', 'Good crop', 'Suitable client-facing image'],
        reviewState: 'ready' as const
      },
      {
        id: 'APP-438-ID',
        type: 'government_id' as const,
        label: 'Driver license',
        fileUrl: 'https://images.proxifix.test/verification/kevin-id.jpg',
        summary: 'License is present but needs a clearer upload for final approval.',
        previewTitle: 'License verification',
        previewBody: 'The current image is too soft for final identity confirmation.',
        evidence: ['Name partially visible', 'Expiration present', 'Needs clearer resubmission'],
        reviewState: 'needs_check' as const
      },
      {
        id: 'APP-438-PORT',
        type: 'portfolio' as const,
        label: 'Portfolio set',
        fileUrl: 'https://images.proxifix.test/verification/kevin-portfolio.jpg',
        summary: 'The current portfolio set is too thin to support approval.',
        previewTitle: 'Technical support portfolio',
        previewBody: 'Admin needs a stronger set of recent setup and repair evidence before approval.',
        evidence: ['Only 1 uploaded image', 'Needs broader scope', 'Recent timestamps missing'],
        reviewState: 'needs_check' as const
      }
    ]
  }
] as const

const portfolioFixtures = {
  'worker.marco@proxifix.test': [
    {
      id: 'PORT-1',
      title: 'Condo kitchen line repair',
      description: 'Replaced corroded flex hose and sealed cabinet plumbing in a one-hour emergency callout.',
      assetUrl: 'https://images.proxifix.test/portfolio/marco-1.jpg'
    },
    {
      id: 'PORT-2',
      title: 'Bathroom fixture refresh',
      description: 'Installed new faucet set and pressure-balanced valves for a Pasig townhouse renovation.',
      assetUrl: 'https://images.proxifix.test/portfolio/marco-2.jpg'
    },
    {
      id: 'PORT-3',
      title: 'Emergency pipe isolation',
      description: 'Contained a burst under-sink pipe before cabinet damage spread to the adjacent unit.',
      assetUrl: 'https://images.proxifix.test/portfolio/marco-3.jpg'
    }
  ],
  'worker.elaine@proxifix.test': [
    {
      id: 'PORT-4',
      title: 'Panel troubleshooting',
      description: 'Isolated a faulty breaker loop and restored hallway lighting for a condo unit.',
      assetUrl: 'https://images.proxifix.test/portfolio/elaine-1.jpg'
    }
  ],
  'worker.kevin@proxifix.test': [
    {
      id: 'PORT-5',
      title: 'Home office setup',
      description: 'Configured laptop migration, printer onboarding, and shared folder access.',
      assetUrl: 'https://images.proxifix.test/portfolio/kevin-1.jpg'
    }
  ]
} as const

const ensurePasswordAuth = async (env: WorkerEnv, userId: string, email: string, password: string) => {
  const db = getDb(env)
  const passwordHash = await hashPassword(password)

  await db
    .insert(passwordCredentials)
    .values({
      userId,
      passwordHash
    })
    .onConflictDoUpdate({
      target: passwordCredentials.userId,
      set: {
        passwordHash,
        updatedAt: new Date()
      }
    })

  await db
    .insert(authAccounts)
    .values({
      userId,
      provider: 'password',
      providerAccountId: email,
      providerEmail: email
    })
    .onConflictDoUpdate({
      target: [authAccounts.provider, authAccounts.providerAccountId],
      set: {
        providerEmail: email,
        lastLoginAt: new Date()
      }
    })
}

const upsertProfileRecords = async (env: WorkerEnv, userId: string, fixture: SeedFixture) => {
  const db = getDb(env)

  await db
    .insert(profiles)
    .values({
      userId,
      phone: fixture.phone,
      city: fixture.city,
      addressLabel: fixture.city,
      bio: fixture.bio,
      preferredRadiusKm: fixture.serviceRadiusKm ?? 5,
      profileCompleted: true
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        phone: fixture.phone,
        city: fixture.city,
        addressLabel: fixture.city,
        bio: fixture.bio,
        preferredRadiusKm: fixture.serviceRadiusKm ?? 5,
        profileCompleted: true,
        updatedAt: new Date()
      }
    })

  if (fixture.role !== 'worker') {
    return
  }

  await db
    .insert(workerProfiles)
    .values({
      userId,
      specialty: fixture.serviceCategory ?? null,
      aboutMe: fixture.aboutMe ?? null,
      workExperience: fixture.workExperience ?? null,
      serviceRadiusKm: fixture.serviceRadiusKm ?? 5,
      coverageAreaLabel: fixture.coverageAreaLabel ?? fixture.city,
      verificationStatus: fixture.verificationStatus ?? 'not_started',
      verificationSubmittedAt: new Date(),
      profilePhotoRequired: true,
      verificationBadgeActive: fixture.verificationBadgeActive ?? false
    })
    .onConflictDoUpdate({
      target: workerProfiles.userId,
      set: {
        specialty: fixture.serviceCategory ?? null,
        aboutMe: fixture.aboutMe ?? null,
        workExperience: fixture.workExperience ?? null,
        serviceRadiusKm: fixture.serviceRadiusKm ?? 5,
        coverageAreaLabel: fixture.coverageAreaLabel ?? fixture.city,
        verificationStatus: fixture.verificationStatus ?? 'not_started',
        verificationSubmittedAt: new Date(),
        profilePhotoRequired: true,
        verificationBadgeActive: fixture.verificationBadgeActive ?? false,
        updatedAt: new Date()
      }
    })
}

const seedCategories = async (env: WorkerEnv) => {
  const db = getDb(env)
  for (const category of categoryFixtures) {
    await db
      .insert(serviceCategories)
      .values(category)
      .onConflictDoUpdate({
        target: serviceCategories.id,
        set: {
          slug: category.slug,
          name: category.name,
          description: category.description,
          isActive: true
        }
      })
  }
}

const seedWorkerCategoryLinks = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)
  const categories = await db.select().from(serviceCategories)
  const categoryIdBySlug = Object.fromEntries(categories.map((category) => [category.slug, category.id]))
  const workerIds = mockFixtures.filter((fixture) => fixture.role === 'worker').map((fixture) => usersByEmail[fixture.email].id)

  if (workerIds.length > 0) {
    await db.delete(workerServiceCategories).where(inArray(workerServiceCategories.workerId, workerIds))
  }

  for (const fixture of mockFixtures.filter((item) => item.role === 'worker' && item.serviceCategory)) {
    const categoryId = categoryIdBySlug[fixture.serviceCategory as string]
    if (!categoryId) {
      continue
    }

    await db.insert(workerServiceCategories).values({
      workerId: usersByEmail[fixture.email].id,
      categoryId
    })
  }
}

const seedServiceRequests = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)
  const categories = await db.select().from(serviceCategories)
  const categoryIdBySlug = Object.fromEntries(categories.map((category) => [category.slug, category.id]))

  for (const fixture of requestFixtures) {
    await db
      .insert(serviceRequests)
      .values({
        id: fixture.id,
        clientId: usersByEmail[fixture.clientEmail].id,
        categoryId: categoryIdBySlug[fixture.categorySlug] ?? null,
        selectedWorkerId: fixture.selectedWorkerEmail
          ? usersByEmail[fixture.selectedWorkerEmail].id
          : null,
        title: fixture.title,
        description: fixture.description,
        urgency: fixture.urgency,
        status: fixture.status,
        visibilityRadiusKm: fixture.visibilityRadiusKm,
        approximateLocationLabel: fixture.approximateLocationLabel,
        exactLocationLabel: fixture.exactLocationLabel,
        exactLatitude: fixture.exactLatitude,
        exactLongitude: fixture.exactLongitude,
        locationPrivacyState: fixture.locationPrivacyState,
        preferredScheduleLabel: fixture.preferredScheduleLabel,
        budgetMinAmount: fixture.budgetMinAmount,
        budgetMaxAmount: fixture.budgetMaxAmount,
        deletedAt: null
      })
      .onConflictDoUpdate({
        target: serviceRequests.id,
        set: {
          clientId: usersByEmail[fixture.clientEmail].id,
          categoryId: categoryIdBySlug[fixture.categorySlug] ?? null,
          selectedWorkerId: fixture.selectedWorkerEmail
            ? usersByEmail[fixture.selectedWorkerEmail].id
            : null,
          title: fixture.title,
          description: fixture.description,
          urgency: fixture.urgency,
          status: fixture.status,
          visibilityRadiusKm: fixture.visibilityRadiusKm,
          approximateLocationLabel: fixture.approximateLocationLabel,
          exactLocationLabel: fixture.exactLocationLabel,
          exactLatitude: fixture.exactLatitude,
          exactLongitude: fixture.exactLongitude,
          locationPrivacyState: fixture.locationPrivacyState,
          preferredScheduleLabel: fixture.preferredScheduleLabel,
          budgetMinAmount: fixture.budgetMinAmount,
          budgetMaxAmount: fixture.budgetMaxAmount,
          deletedAt: null,
          updatedAt: new Date()
        }
      })

    await db.delete(serviceRequestAttachments).where(eq(serviceRequestAttachments.requestId, fixture.id))

    if (fixture.attachments.length > 0) {
      await db.insert(serviceRequestAttachments).values(
        fixture.attachments.map((attachment) => ({
          ...attachment,
          requestId: fixture.id,
          assetKind: 'image'
        }))
      )
    }
  }
}

const seedLeadStatesAndOffers = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)

  const leadFixtures = [
    { requestId: 'CON-201', workerEmail: 'worker.marco@proxifix.test', state: 'offer_sent' as const },
    { requestId: 'CON-188', workerEmail: 'worker.elaine@proxifix.test', state: 'interested' as const },
    { requestId: 'CON-172', workerEmail: 'worker.kevin@proxifix.test', state: 'offer_sent' as const }
  ]

  for (const lead of leadFixtures) {
    await db
      .insert(workerLeadStates)
      .values({
        requestId: lead.requestId,
        workerId: usersByEmail[lead.workerEmail].id,
        state: lead.state
      })
      .onConflictDoUpdate({
        target: [workerLeadStates.requestId, workerLeadStates.workerId],
        set: {
          state: lead.state,
          updatedAt: new Date()
        }
      })
  }

  const offerFixtures = [
    {
      id: 'OFF-1',
      requestId: 'CON-201',
      workerEmail: 'worker.marco@proxifix.test',
      note:
        'Can inspect the pressure issue, replace damaged fittings, and provide a final repair estimate on-site.',
      priceAmount: 1900,
      etaMinutes: 45,
      arrivalLabel: 'Within 45 minutes',
      proposedScheduleLabel: 'Today, 7:15 PM',
      status: 'pending' as const
    },
    {
      id: 'OFF-2',
      requestId: 'CON-188',
      workerEmail: 'worker.elaine@proxifix.test',
      note:
        'I can inspect the panel tomorrow morning. One more breaker photo would help me confirm the likely issue.',
      priceAmount: 1650,
      etaMinutes: 60,
      arrivalLabel: 'Within 1 hour',
      proposedScheduleLabel: 'Tomorrow, 9:00 AM',
      status: 'pending' as const
    },
    {
      id: 'OFF-3',
      requestId: 'CON-172',
      workerEmail: 'worker.kevin@proxifix.test',
      note:
        'I have completed the software setup and will finalize the printer configuration on-site.',
      priceAmount: 1100,
      etaMinutes: 20,
      arrivalLabel: 'Within 20 minutes',
      proposedScheduleLabel: 'Saturday, 1:00 PM',
      status: 'accepted' as const
    }
  ]

  for (const offerFixture of offerFixtures) {
    await db
      .insert(offers)
      .values({
        id: offerFixture.id,
        requestId: offerFixture.requestId,
        workerId: usersByEmail[offerFixture.workerEmail].id,
        note: offerFixture.note,
        priceAmount: offerFixture.priceAmount,
        etaMinutes: offerFixture.etaMinutes,
        arrivalLabel: offerFixture.arrivalLabel,
        proposedScheduleLabel: offerFixture.proposedScheduleLabel,
        status: offerFixture.status
      })
      .onConflictDoUpdate({
        target: offers.id,
        set: {
          note: offerFixture.note,
          priceAmount: offerFixture.priceAmount,
          etaMinutes: offerFixture.etaMinutes,
          arrivalLabel: offerFixture.arrivalLabel,
          proposedScheduleLabel: offerFixture.proposedScheduleLabel,
          status: offerFixture.status,
          updatedAt: new Date()
        }
      })
  }
}

const seedConversationsAndMessages = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)

  const conversationFixtures = [
    {
      id: 'TH-1',
      requestId: 'CON-201',
      clientEmail: 'client.maria@proxifix.test',
      workerEmail: 'worker.marco@proxifix.test',
      messages: [
        {
          id: 'MSG-1',
          senderEmail: 'worker.marco@proxifix.test',
          body: 'I reviewed the photos. It looks like a sink trap leak plus possible faucet sediment buildup.',
          createdAt: new Date('2026-04-04T18:58:00+08:00'),
          status: 'delivered' as const
        },
        {
          id: 'MSG-2',
          senderEmail: 'client.maria@proxifix.test',
          body: 'That matches what we saw. Is tonight still possible? The cabinet is already damp.',
          createdAt: new Date('2026-04-04T19:00:00+08:00'),
          status: 'seen' as const
        },
        {
          id: 'MSG-3',
          senderEmail: 'worker.marco@proxifix.test',
          body: 'Yes. I can arrive in 45 minutes and bring replacement fittings if needed.',
          createdAt: new Date('2026-04-04T19:01:00+08:00'),
          status: 'seen' as const
        }
      ]
    },
    {
      id: 'TH-2',
      requestId: 'CON-188',
      clientEmail: 'client.justin@proxifix.test',
      workerEmail: 'worker.elaine@proxifix.test',
      messages: [
        {
          id: 'MSG-4',
          senderEmail: 'worker.elaine@proxifix.test',
          body: 'I can inspect the panel tomorrow morning. One more breaker photo would help me confirm the likely issue.',
          createdAt: new Date('2026-04-04T15:14:00+08:00'),
          status: 'delivered' as const
        },
        {
          id: 'MSG-5',
          senderEmail: 'client.justin@proxifix.test',
          body: 'Understood. I will upload another photo tonight.',
          createdAt: new Date('2026-04-04T15:18:00+08:00'),
          status: 'sent' as const
        }
      ]
    },
    {
      id: 'TH-3',
      requestId: 'CON-172',
      clientEmail: 'client.ella@proxifix.test',
      workerEmail: 'worker.kevin@proxifix.test',
      messages: [
        {
          id: 'MSG-6',
          senderEmail: 'worker.kevin@proxifix.test',
          body: 'The device transfer is complete. I am running the printer configuration now.',
          createdAt: new Date('2026-04-04T13:35:00+08:00'),
          status: 'delivered' as const
        },
        {
          id: 'MSG-7',
          senderEmail: 'client.ella@proxifix.test',
          body: 'Thank you. Let me know if I need to restart anything.',
          createdAt: new Date('2026-04-04T13:37:00+08:00'),
          status: 'seen' as const
        }
      ]
    }
  ]

  for (const fixture of conversationFixtures) {
    await db
      .insert(conversations)
      .values({
        id: fixture.id,
        requestId: fixture.requestId,
        clientId: usersByEmail[fixture.clientEmail].id,
        workerId: usersByEmail[fixture.workerEmail].id,
        status: 'active',
        lastMessageAt: fixture.messages[fixture.messages.length - 1]?.createdAt ?? new Date()
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          clientId: usersByEmail[fixture.clientEmail].id,
          workerId: usersByEmail[fixture.workerEmail].id,
          status: 'active',
          lastMessageAt: fixture.messages[fixture.messages.length - 1]?.createdAt ?? new Date(),
          updatedAt: new Date()
        }
      })

    await db.delete(messages).where(eq(messages.conversationId, fixture.id))

    await db.insert(messages).values(
      fixture.messages.map((message) => ({
        id: message.id,
        conversationId: fixture.id,
        senderId: usersByEmail[message.senderEmail].id,
        body: message.body,
        messageType: 'text' as const,
        deliveryStatus: message.status,
        seenAt: message.status === 'seen' ? message.createdAt : null,
        createdAt: message.createdAt,
        updatedAt: message.createdAt
      }))
    )
  }
}

const seedSavedWorkersAndReviews = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)

  const savedFixtures = [
    { clientEmail: 'client.maria@proxifix.test', workerEmail: 'worker.marco@proxifix.test' },
    { clientEmail: 'client.maria@proxifix.test', workerEmail: 'worker.kevin@proxifix.test' },
    { clientEmail: 'client.justin@proxifix.test', workerEmail: 'worker.elaine@proxifix.test' }
  ]

  const clientIds = savedFixtures.map((item) => usersByEmail[item.clientEmail].id)
  await db.delete(savedWorkers).where(inArray(savedWorkers.clientId, clientIds))
  await db.insert(savedWorkers).values(
    savedFixtures.map((item) => ({
      clientId: usersByEmail[item.clientEmail].id,
      workerId: usersByEmail[item.workerEmail].id
    }))
  )

  const reviewFixtures = [
    {
      id: 'REV-1',
      requestId: 'CON-201',
      reviewerEmail: 'client.maria@proxifix.test',
      revieweeEmail: 'worker.marco@proxifix.test',
      rating: 5,
      body: 'Quick arrival, clear explanation, and professional repair.'
    },
    {
      id: 'REV-2',
      requestId: 'CON-172',
      reviewerEmail: 'client.ella@proxifix.test',
      revieweeEmail: 'worker.kevin@proxifix.test',
      rating: 4,
      body: 'Setup was efficient and communication stayed clear the whole time.'
    }
  ]

  await db.delete(reviews).where(inArray(reviews.id, reviewFixtures.map((item) => item.id)))
  await db.insert(reviews).values(
    reviewFixtures.map((item) => ({
      id: item.id,
      requestId: item.requestId,
      reviewerId: usersByEmail[item.reviewerEmail].id,
      revieweeId: usersByEmail[item.revieweeEmail].id,
      rating: item.rating,
      body: item.body
    }))
  )
}

const seedVerificationAndPortfolio = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)

  await db.delete(verificationDocuments).where(
    inArray(
      verificationDocuments.submissionId,
      verificationFixtures.map((item) => item.submissionId)
    )
  )

  for (const fixture of verificationFixtures) {
    await db
      .insert(verificationSubmissions)
      .values({
        id: fixture.submissionId,
        workerId: usersByEmail[fixture.workerEmail].id,
        status: fixture.status,
        note: fixture.note,
        feedback: fixture.feedback,
        submittedAt: new Date('2026-04-04T08:10:00+08:00')
      })
      .onConflictDoUpdate({
        target: verificationSubmissions.id,
        set: {
          workerId: usersByEmail[fixture.workerEmail].id,
          status: fixture.status,
          note: fixture.note,
          feedback: fixture.feedback,
          submittedAt: new Date('2026-04-04T08:10:00+08:00'),
          updatedAt: new Date()
        }
      })

    await db.insert(verificationDocuments).values(
      fixture.documentSet.map((document) => ({
        id: document.id,
        submissionId: fixture.submissionId,
        documentType: document.type,
        label: document.label,
        fileUrl: document.fileUrl,
        summary: document.summary,
        previewTitle: document.previewTitle,
        previewBody: document.previewBody,
        evidence: [...document.evidence],
        reviewState: document.reviewState
      }))
    )
  }

  const portfolioWorkerIds = Object.keys(portfolioFixtures).map((email) => usersByEmail[email].id)
  if (portfolioWorkerIds.length > 0) {
    await db.delete(workerPortfolioItems).where(inArray(workerPortfolioItems.workerId, portfolioWorkerIds))
  }

  for (const [email, items] of Object.entries(portfolioFixtures)) {
    await db.insert(workerPortfolioItems).values(
      items.map((item) => ({
        ...item,
        workerId: usersByEmail[email].id
      }))
    )
  }
}

const seedNotificationsReportsAndAudit = async (
  env: WorkerEnv,
  usersByEmail: Record<string, typeof users.$inferSelect>
) => {
  const db = getDb(env)

  const notificationFixtures = [
    {
      id: 'NT-1',
      userEmail: 'client.maria@proxifix.test',
      type: 'offer_received',
      title: 'New offer received',
      body: 'Marco Santos sent a structured quote for your kitchen sink leak concern.',
      status: 'unread' as const,
      relatedEntityType: 'offer',
      relatedEntityId: 'OFF-1'
    },
    {
      id: 'NT-2',
      userEmail: 'worker.elaine@proxifix.test',
      type: 'verification_update',
      title: 'Verification review updated',
      body: 'Admin requested a clearer certification issue date before approval.',
      status: 'unread' as const,
      relatedEntityType: 'verification_submission',
      relatedEntityId: 'APP-440'
    },
    {
      id: 'NT-3',
      userEmail: 'admin.ava@proxifix.test',
      type: 'verification_queue',
      title: 'Worker review queued',
      body: 'Kevin Navarro is waiting for a verification decision.',
      status: 'unread' as const,
      relatedEntityType: 'verification_submission',
      relatedEntityId: 'APP-438'
    }
  ]

  await db.delete(notifications).where(inArray(notifications.id, notificationFixtures.map((item) => item.id)))
  await db.insert(notifications).values(
    notificationFixtures.map((item) => ({
      id: item.id,
      userId: usersByEmail[item.userEmail].id,
      type: item.type,
      title: item.title,
      body: item.body,
      status: item.status,
      relatedEntityType: item.relatedEntityType,
      relatedEntityId: item.relatedEntityId
    }))
  )

  const incidentFixtures = [
    {
      id: 'REP-77',
      title: 'Worker missed scheduled urgent visit',
      severity: 'high' as const,
      submittedByEmail: 'client.justin@proxifix.test',
      targetUserEmail: 'worker.elaine@proxifix.test',
      reason:
        'Worker accepted an urgent electrical call and did not show up within the agreed time window.',
      status: 'investigating' as const
    },
    {
      id: 'REP-75',
      title: 'Abusive language in chat thread',
      severity: 'high' as const,
      submittedByEmail: 'worker.kevin@proxifix.test',
      targetUserEmail: 'client.ella@proxifix.test',
      reason: 'Client used repeated insulting language after quote negotiation failed.',
      status: 'open' as const
    },
    {
      id: 'REP-69',
      title: 'Suspicious duplicate account',
      severity: 'medium' as const,
      submittedByEmail: 'admin.liam@proxifix.test',
      targetUserEmail: 'worker.kevin@proxifix.test',
      reason: 'Matching device pattern suggests the same worker profile may have been re-created after suspension.',
      status: 'resolved' as const
    }
  ]

  await db.delete(incidentReports).where(inArray(incidentReports.id, incidentFixtures.map((item) => item.id)))
  await db.insert(incidentReports).values(
    incidentFixtures.map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      submittedByUserId: usersByEmail[item.submittedByEmail].id,
      targetUserId: usersByEmail[item.targetUserEmail].id,
      reason: item.reason,
      status: item.status
    }))
  )

  const auditFixtures = [
    {
      id: 'AUD-1',
      actorEmail: 'admin.ava@proxifix.test',
      targetEmail: 'worker.elaine@proxifix.test',
      entityType: 'verification_submission',
      entityId: 'APP-440',
      action: 'review_requested',
      summary: 'APP-440 escalated for certificate review after document mismatch.',
      metadata: { severity: 'warning' }
    },
    {
      id: 'AUD-2',
      actorEmail: 'admin.liam@proxifix.test',
      targetEmail: 'client.ella@proxifix.test',
      entityType: 'incident_report',
      entityId: 'REP-75',
      action: 'moderation_opened',
      summary: 'REP-75 chat transcript preserved for active moderation.',
      metadata: { severity: 'high' }
    },
    {
      id: 'AUD-3',
      actorEmail: 'admin.sofia@proxifix.test',
      targetEmail: 'worker.marco@proxifix.test',
      entityType: 'worker_profile',
      entityId: usersByEmail['worker.marco@proxifix.test'].id,
      action: 'verification_confirmed',
      summary: 'Marco Santos remains visible after verification review confirmed ID and trade proof.',
      metadata: { badgeActive: true }
    }
  ]

  await db.delete(auditLogs).where(inArray(auditLogs.id, auditFixtures.map((item) => item.id)))
  await db.insert(auditLogs).values(
    auditFixtures.map((item) => ({
      id: item.id,
      actorUserId: usersByEmail[item.actorEmail].id,
      targetUserId: usersByEmail[item.targetEmail].id,
      entityType: item.entityType,
      entityId: item.entityId,
      action: item.action,
      summary: item.summary,
      metadata: item.metadata
    }))
  )
}

export const seedMockAccounts = async (env: WorkerEnv) => {
  const db = getDb(env)
  const seededUsers: Array<{
    role: AppRole
    name: string
    email: string
    password: string
    status: SeedFixture['status']
  }> = []
  const usersByEmail: Record<string, typeof users.$inferSelect> = {}

  for (const fixture of mockFixtures) {
    const existingUser = await db.select().from(users).where(eq(users.email, fixture.email)).limit(1)

    const userRecord =
      existingUser[0] ??
      (
        await db
          .insert(users)
          .values({
            email: fixture.email,
            displayName: fixture.name,
            role: fixture.role,
            status: fixture.status,
            googleAvatarUrl: null,
            profileImageUrl: null,
            profileImageSource: 'custom'
          })
          .returning()
      )[0]

    if (existingUser[0]) {
      await db
        .update(users)
        .set({
          displayName: fixture.name,
          role: fixture.role,
          status: fixture.status,
          updatedAt: new Date()
        })
        .where(eq(users.id, userRecord.id))
    }

    usersByEmail[fixture.email] = {
      ...userRecord,
      displayName: fixture.name,
      role: fixture.role,
      status: fixture.status
    }

    await upsertProfileRecords(env, userRecord.id, fixture)
    await ensurePasswordAuth(env, userRecord.id, fixture.email, fixture.password)

    seededUsers.push({
      role: fixture.role,
      name: fixture.name,
      email: fixture.email,
      password: fixture.password,
      status: fixture.status
    })
  }

  await seedCategories(env)
  await seedWorkerCategoryLinks(env, usersByEmail)
  await seedServiceRequests(env, usersByEmail)
  await seedLeadStatesAndOffers(env, usersByEmail)
  await seedConversationsAndMessages(env, usersByEmail)
  await seedSavedWorkersAndReviews(env, usersByEmail)
  await seedVerificationAndPortfolio(env, usersByEmail)
  await seedNotificationsReportsAndAudit(env, usersByEmail)

  return seededUsers
}

export const mockAccountFixtures = mockFixtures
