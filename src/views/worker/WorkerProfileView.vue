<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileBadge2,
  Image as ImageIcon,
  MapPinned,
  UploadCloud
} from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { apiFetch } from '@/lib/api'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const fullName = ref('')
const specialty = ref('')
const availability = ref('Available')
const coverageArea = ref('')
const serviceRadius = ref('5 km')
const experience = ref('')
const contactNumber = ref('')
const about = ref('')
const profileFeedback = ref('')
const verificationStatus = ref('Draft')
const verificationBadgeActive = ref(false)
const loadingProfile = ref(true)
const savingProfile = ref(false)
const submittingVerification = ref(false)
const uploadingItemId = ref<string | null>(null)
const portfolioItems = ref<Array<{ id: string; title: string; description: string }>>([])
const profilePhotoInput = ref<HTMLInputElement | null>(null)
const governmentIdInput = ref<HTMLInputElement | null>(null)
const certificationInput = ref<HTMLInputElement | null>(null)
const portfolioInput = ref<HTMLInputElement | null>(null)
const setupMode = computed(() => route.query.setup === '1' || Boolean(sessionStore.currentUser && !sessionStore.currentUser.profileCompleted))
const uploadedAssets = reactive({
  profilePhoto: false,
  governmentId: false,
  certification: false,
  portfolio: false
})
const profilePhotoLabel = ref('No profile photo uploaded yet.')

const verificationChecklist = computed(() => [
  {
    id: 'profile-photo',
    label: 'Profile photo',
    helper: 'Required before you can submit verification or appear credible to clients.',
    complete: uploadedAssets.profilePhoto,
    actionLabel: uploadedAssets.profilePhoto ? 'Replace photo' : 'Upload photo'
  },
  {
    id: 'government-id',
    label: 'Valid government-issued ID',
    helper: 'Readable front-facing ID for admin review.',
    complete: uploadedAssets.governmentId,
    actionLabel: uploadedAssets.governmentId ? 'Replace file' : 'Upload file'
  },
  {
    id: 'certification',
    label: 'Certification or trade proof',
    helper: 'TESDA, company certification, or equivalent trade evidence.',
    complete: uploadedAssets.certification,
    actionLabel: uploadedAssets.certification ? 'Replace file' : 'Upload file'
  },
  {
    id: 'portfolio',
    label: 'Recent portfolio samples',
    helper: 'At least two recent work images are expected.',
    complete: uploadedAssets.portfolio,
    actionLabel: uploadedAssets.portfolio ? 'Manage uploads' : 'Upload images'
  },
  {
    id: 'coverage',
    label: 'Coverage area and radius',
    helper: 'Workers need a clear service area before appearing in nearby matching.',
    complete: Boolean(coverageArea.value.trim() && serviceRadius.value.trim()),
    actionLabel: 'Review'
  },
  {
    id: 'availability',
    label: 'Availability status',
    helper: 'Availability must be set clearly before submission.',
    complete: Boolean(availability.value.trim()),
    actionLabel: 'Review'
  }
])

const missingVerificationItems = computed(() =>
  verificationChecklist.value.filter((item) => !item.complete)
)
const verificationReady = computed(() => missingVerificationItems.value.length === 0)
const initials = computed(() =>
  (fullName.value || sessionStore.currentUser?.name || 'Worker')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
)

const updateChecklistFeedback = (message: string) => {
  profileFeedback.value = message
}

const checklistIdToDocumentType = (itemId: string) => {
  if (itemId === 'profile-photo') return 'profile_photo'
  if (itemId === 'government-id') return 'government_id'
  if (itemId === 'certification') return 'certification'
  if (itemId === 'portfolio') return 'portfolio'
  return null
}

const checklistIdToInputRef = (itemId: string) => {
  if (itemId === 'profile-photo') return profilePhotoInput
  if (itemId === 'government-id') return governmentIdInput
  if (itemId === 'certification') return certificationInput
  if (itemId === 'portfolio') return portfolioInput
  return null
}

const uploadVerificationDocument = async (itemId: string, file: File) => {
  const documentType = checklistIdToDocumentType(itemId)
  if (!documentType) {
    return
  }

  uploadingItemId.value = itemId
  profileFeedback.value = ''

  try {
    const formData = new FormData()
    formData.set('documentType', documentType)
    formData.set('file', file)

    const response = await apiFetch('/api/profile/me/verification/documents', {
      method: 'POST',
      body: formData
    })

    const payload = (await response.json()) as {
      ok?: boolean
      message?: string
      uploaded?: {
        documentType: string
        fileName: string
      }
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'Unable to upload verification document right now.')
    }

    profileFeedback.value = `${payload.uploaded?.fileName ?? 'Document'} uploaded successfully.`
    await loadProfile()
  } catch (error) {
    profileFeedback.value = error instanceof Error ? error.message : 'Unable to upload verification document right now.'
  } finally {
    uploadingItemId.value = null
  }
}

const onUploadSelected = async (itemId: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    return
  }

  await uploadVerificationDocument(itemId, file)
  target.value = ''
}

const toggleUpload = (itemId: string) => {
  if (itemId === 'coverage') {
    updateChecklistFeedback('Coverage area and service radius are already edited in the profile form on the left.')
    return
  }

  if (itemId === 'availability') {
    updateChecklistFeedback('Availability can be adjusted directly in the profile form on the left.')
    return
  }

  const inputRef = checklistIdToInputRef(itemId)
  if (!inputRef?.value) {
    updateChecklistFeedback('Upload control is not available right now. Refresh and try again.')
    return
  }

  inputRef.value.click()
}

const saveProfile = async () => {
  savingProfile.value = true
  profileFeedback.value = ''

  try {
    const response = await apiFetch('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: fullName.value,
        phone: contactNumber.value || null,
        city: coverageArea.value || null,
        addressLabel: coverageArea.value || null,
        bio: about.value || null,
        specialty: specialty.value || null,
        aboutMe: about.value || null,
        workExperience: experience.value || null,
        serviceRadiusKm: Number.parseInt(serviceRadius.value, 10) || 5,
        coverageAreaLabel: coverageArea.value || null,
        availabilityStatus: availability.value === 'Busy' ? 'busy' : availability.value === 'Offline' ? 'offline' : 'available'
      })
    })

    if (!response.ok) {
      throw new Error('Unable to save worker profile right now.')
    }

    await sessionStore.hydrateSession(true)

    if (!uploadedAssets.profilePhoto) {
      verificationStatus.value = 'Draft'
      profileFeedback.value = `Profile updated for ${fullName.value}. A profile photo is still required before you can submit verification.`
      return
    }

    profileFeedback.value = `Worker profile updated for ${fullName.value}. Client-facing details are now saved to your account.`

    if (setupMode.value) {
      void router.replace('/app/worker/overview')
    }
  } catch (error) {
    profileFeedback.value = error instanceof Error ? error.message : 'Unable to save worker profile right now.'
  } finally {
    savingProfile.value = false
  }
}

const submitVerification = async () => {
  if (!verificationReady.value) {
    verificationStatus.value = 'Draft'
    profileFeedback.value = `Verification is still missing ${missingVerificationItems.value.length} required item${missingVerificationItems.value.length === 1 ? '' : 's'}.`
    return
  }

  submittingVerification.value = true
  profileFeedback.value = ''

  try {
    const response = await apiFetch('/api/profile/me/verification/submit', {
      method: 'POST',
      body: JSON.stringify({})
    })

    const payload = (await response.json()) as {
      ok?: boolean
      code?: string
      message?: string
      verificationSubmission?: {
        status?: string
      } | null
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'Unable to submit verification right now.')
    }

    verificationStatus.value = payload.verificationSubmission?.status === 'pending' ? 'Pending review' : 'Submitted'
    profileFeedback.value = 'Verification submitted successfully. Admin review is now in progress.'
    await loadProfile()
  } catch (error) {
    profileFeedback.value = error instanceof Error ? error.message : 'Unable to submit verification right now.'
  } finally {
    submittingVerification.value = false
  }
}

const loadProfile = async () => {
  loadingProfile.value = true

  try {
    const response = await apiFetch('/api/profile/me')
    if (!response.ok) {
      throw new Error('Unable to load worker profile.')
    }

    const payload = (await response.json()) as {
      ok: boolean
      user: { name: string }
      profile: {
        phone: string | null
        city: string | null
        addressLabel: string | null
        bio: string | null
      } | null
      workerProfile: {
        specialty: string | null
        aboutMe: string | null
        workExperience: string | null
        serviceRadiusKm: number | null
        coverageAreaLabel: string | null
        availabilityStatus: 'available' | 'busy' | 'offline'
        verificationStatus?: string
        verificationBadgeActive?: boolean
      } | null
      verificationDocuments: Array<{ documentType: string }>
      portfolio: Array<{ id: string; title: string; description: string }>
      verificationSubmission: { status: string } | null
    }

    fullName.value = payload.user.name
    specialty.value = payload.workerProfile?.specialty ?? ''
    availability.value =
      payload.workerProfile?.availabilityStatus === 'busy'
        ? 'Busy'
        : payload.workerProfile?.availabilityStatus === 'offline'
          ? 'Offline'
          : 'Available'
    coverageArea.value = payload.workerProfile?.coverageAreaLabel ?? payload.profile?.addressLabel ?? payload.profile?.city ?? ''
    serviceRadius.value = `${payload.workerProfile?.serviceRadiusKm ?? 5} km`
    contactNumber.value = payload.profile?.phone ?? ''
    about.value = payload.workerProfile?.aboutMe ?? payload.profile?.bio ?? ''
    experience.value = payload.workerProfile?.workExperience ?? ''
    uploadedAssets.profilePhoto = payload.verificationDocuments.some((document) => document.documentType === 'profile_photo')
    uploadedAssets.governmentId = payload.verificationDocuments.some((document) => document.documentType === 'government_id')
    uploadedAssets.certification = payload.verificationDocuments.some((document) => document.documentType === 'certification')
    uploadedAssets.portfolio = payload.verificationDocuments.some((document) => document.documentType === 'portfolio')

    if (uploadedAssets.profilePhoto) {
      profilePhotoLabel.value = 'Profile photo already on file.'
    }

    portfolioItems.value = payload.portfolio ?? []
    verificationBadgeActive.value = payload.workerProfile?.verificationBadgeActive ?? false
    verificationStatus.value = payload.verificationSubmission?.status
      ? payload.verificationSubmission.status === 'pending'
        ? 'Pending review'
        : payload.verificationSubmission.status === 'approved'
          ? 'Approved'
          : payload.verificationSubmission.status === 'under_review'
            ? 'Under review'
            : payload.verificationSubmission.status === 'resubmission_requested'
              ? 'Resubmission requested'
              : payload.verificationSubmission.status === 'rejected'
                ? 'Rejected'
                : 'Draft'
      : uploadedAssets.profilePhoto && uploadedAssets.governmentId && uploadedAssets.certification && uploadedAssets.portfolio
        ? 'Ready for submission'
        : 'Draft'
  } catch (error) {
    profileFeedback.value = error instanceof Error ? error.message : 'Unable to load worker profile.'
  } finally {
    loadingProfile.value = false
  }
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="grid gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
    <SectionCard
      eyebrow="Professional identity"
      title="Worker profile"
      description="Edit the details clients use to decide whether to trust your profile, message you, and accept your offer."
    >
      <div class="space-y-6">
        <div
          v-if="setupMode"
          class="rounded-2xl border border-[#FFD4BE] bg-[#FFF6F1] px-4 py-4 text-sm leading-6 text-[#8A3C17]"
        >
          Finish your worker setup first. New worker accounts stay empty until you add your details and required verification items.
        </div>

        <div
          v-if="loadingProfile"
          class="space-y-4"
        >
          <div class="h-6 w-44 animate-pulse rounded-full bg-[#F3F4F6]" />
          <div class="h-24 animate-pulse rounded-2xl bg-[#F9FAFB]" />
        </div>

        <div class="rounded-[28px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-4">
              <div
                class="flex h-16 w-16 items-center justify-center rounded-[26px] border border-[var(--pf-border)] text-xl font-bold"
                :class="
                  uploadedAssets.profilePhoto
                    ? 'bg-gradient-to-br from-[#FF7B36] to-[#FF5A1F] text-white'
                    : 'bg-[var(--pf-surface)] text-[var(--pf-text-soft)]'
                "
              >
                <Camera v-if="!uploadedAssets.profilePhoto" class="h-6 w-6" />
                <template v-else>{{ initials }}</template>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-xl font-semibold text-[var(--pf-text)]">{{ fullName }}</h3>
                  <VerifiedBadge v-if="verificationBadgeActive" />
                </div>
                <p class="mt-2 text-sm text-[var(--pf-text-soft)]">{{ specialty || 'Specialty pending' }} · {{ coverageArea || 'Coverage area pending' }} · {{ serviceRadius }}</p>
                <p class="mt-1 text-xs font-semibold uppercase tracking-[0.18em]" :class="verificationBadgeActive ? 'text-[var(--pf-success)]' : uploadedAssets.profilePhoto ? 'text-[#D97706]' : 'text-[#D97706]'">
                  {{ verificationBadgeActive ? 'Verification badge active' : uploadedAssets.profilePhoto ? 'Profile photo uploaded' : 'Profile photo required' }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface-muted)]"
                @click="toggleUpload('profile-photo')"
              >
                {{ uploadedAssets.profilePhoto ? 'Review photo status' : 'Photo required' }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-70"
                :disabled="savingProfile"
                @click="saveProfile"
              >
                {{ savingProfile ? 'Saving…' : 'Save profile' }}
              </button>
            </div>
          </div>
        </div>

        <div class="rounded-[28px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-5">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div class="flex items-start gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pf-accent-soft)]">
                <Camera class="h-5 w-5 text-[var(--pf-accent)]" />
              </div>
              <div>
                <p class="text-sm font-semibold text-[var(--pf-text)]">Profile photo</p>
                <p class="mt-1 text-sm leading-6 text-[var(--pf-text-soft)]">
                  {{ profilePhotoLabel }} This is required before the worker profile can be submitted for verification.
                </p>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface)]"
              @click="toggleUpload('profile-photo')"
            >
              {{ uploadedAssets.profilePhoto ? 'Replace photo' : 'Upload now' }}
            </button>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Full name</span>
            <input
              v-model="fullName"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Primary specialty</span>
            <input
              v-model="specialty"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Availability</span>
            <select
              v-model="availability"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            >
              <option>Available</option>
              <option>Busy</option>
              <option>Offline</option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Contact number</span>
            <input
              v-model="contactNumber"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Coverage area</span>
            <input
              v-model="coverageArea"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Service radius</span>
            <select
              v-model="serviceRadius"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            >
              <option>3 km</option>
              <option>5 km</option>
              <option>8 km</option>
              <option>10 km</option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">Experience</span>
            <input
              v-model="experience"
              class="h-11 w-full rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>
          <div class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-4">
            <BadgeCheck class="h-5 w-5 text-[var(--pf-accent)]" />
            <p class="mt-3 font-semibold text-[var(--pf-text)]">Visibility state</p>
            <p class="mt-2 text-sm text-[var(--pf-text-soft)]">
              {{ availability === 'Available' ? 'Visible for nearby urgent requests.' : `Status set to ${availability.toLowerCase()}.` }}
            </p>
          </div>
          <label class="space-y-2 lg:col-span-2">
            <span class="text-sm font-medium text-[var(--pf-text)]">About me</span>
            <textarea
              v-model="about"
              class="min-h-[120px] w-full rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 py-3 text-sm text-[var(--pf-text)] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>
        </div>

        <div
          v-if="profileFeedback"
          class="rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] px-4 py-4 text-sm font-medium text-[var(--pf-text)]"
        >
          {{ profileFeedback }}
        </div>
      </div>
    </SectionCard>

    <div class="space-y-5">
      <SectionCard
        eyebrow="Verification"
        title="Requirements checklist"
        description="These uploads and confirmations are required before the worker profile can be submitted for admin review."
      >
        <div class="space-y-3">
          <article
            v-for="item in verificationChecklist"
            :key="item.id"
            class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl" :class="item.complete ? 'bg-[#ECFDF3]' : 'bg-[var(--pf-accent-soft)]'">
                  <CheckCircle2 v-if="item.complete" class="h-5 w-5 text-[#059669]" />
                  <FileBadge2 v-else class="h-5 w-5 text-[var(--pf-accent)]" />
                </div>
                <div>
                  <p class="text-sm font-semibold text-[var(--pf-text)]">{{ item.label }}</p>
                  <p class="mt-1 text-sm leading-6 text-[var(--pf-text-soft)]">{{ item.helper }}</p>
                </div>
              </div>

              <div class="flex shrink-0 flex-col items-end gap-2">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="item.complete ? 'bg-[#ECFDF3] text-[#059669]' : 'bg-[#FFF7ED] text-[#D97706]'"
                >
                  {{ item.complete ? 'Complete' : 'Required' }}
                </span>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface)]"
                  :disabled="uploadingItemId === item.id"
                  @click="toggleUpload(item.id)"
                >
                  {{ uploadingItemId === item.id ? 'Uploading…' : item.actionLabel }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div class="mt-4 rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-[var(--pf-text)]">Verification submission</p>
              <p class="mt-1 text-sm text-[var(--pf-text-soft)]">
                {{ verificationReady ? 'All required uploads are complete.' : `${missingVerificationItems.length} required item${missingVerificationItems.length === 1 ? '' : 's'} still need attention.` }}
              </p>
            </div>

            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
              :class="verificationReady ? 'bg-[#ECFDF3] text-[#059669]' : 'bg-[#FFF7ED] text-[#D97706]'"
            >
              {{ verificationStatus }}
            </span>
          </div>

          <button
            type="button"
            class="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!verificationReady || submittingVerification"
            @click="submitVerification"
          >
            {{ submittingVerification ? 'Submitting…' : 'Submit verification' }}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Portfolio"
        title="Uploaded work samples"
        description="Clients rely on work samples to judge quality before they accept a quote or start a message thread."
      >
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-4">
            <div>
              <p class="text-sm font-semibold text-[var(--pf-text)]">Portfolio upload state</p>
              <p class="mt-1 text-sm text-[var(--pf-text-soft)]">Keep at least two recent images attached so admin review and client trust both stay strong.</p>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface-muted)]"
              :disabled="uploadingItemId === 'portfolio'"
              @click="toggleUpload('portfolio')"
            >
              <UploadCloud class="h-4.5 w-4.5" />
              {{ uploadingItemId === 'portfolio' ? 'Uploading…' : uploadedAssets.portfolio ? 'Manage portfolio' : 'Upload portfolio' }}
            </button>
          </div>

          <article
            v-for="item in portfolioItems"
            :key="item.id"
            class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-4"
          >
            <div class="flex items-start gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pf-accent-soft)]">
                <ImageIcon class="h-5 w-5 text-[var(--pf-accent)]" />
              </div>
              <div>
                <h3 class="font-semibold text-[var(--pf-text)]">{{ item.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-[var(--pf-text-soft)]">{{ item.description }}</p>
              </div>
            </div>
          </article>
          <article
            v-if="portfolioItems.length === 0"
            class="rounded-[24px] border border-dashed border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 text-sm text-[var(--pf-text-soft)]"
          >
            No portfolio items are saved for this worker profile yet.
          </article>
        </div>
      </SectionCard>

      <input
        ref="profilePhotoInput"
        type="file"
        class="hidden"
        accept="image/jpeg,image/png,image/webp"
        @change="onUploadSelected('profile-photo', $event)"
      />
      <input
        ref="governmentIdInput"
        type="file"
        class="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        @change="onUploadSelected('government-id', $event)"
      />
      <input
        ref="certificationInput"
        type="file"
        class="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        @change="onUploadSelected('certification', $event)"
      />
      <input
        ref="portfolioInput"
        type="file"
        class="hidden"
        accept="image/jpeg,image/png,image/webp"
        @change="onUploadSelected('portfolio', $event)"
      />

      <SectionCard
        eyebrow="Coverage"
        title="Live profile summary"
        description="This gives the worker a fast read on what clients will currently see in discovery and messaging."
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-4">
            <MapPinned class="h-5 w-5 text-[var(--pf-accent)]" />
            <p class="mt-3 font-semibold text-[var(--pf-text)]">Coverage</p>
            <p class="mt-2 text-sm text-[var(--pf-text-soft)]">{{ coverageArea }} · {{ serviceRadius }}</p>
          </div>
          <div class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-4">
            <BadgeCheck class="h-5 w-5 text-[var(--pf-accent)]" />
            <p class="mt-3 font-semibold text-[var(--pf-text)]">Availability</p>
            <p class="mt-2 text-sm text-[var(--pf-text-soft)]">{{ availability }}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>
