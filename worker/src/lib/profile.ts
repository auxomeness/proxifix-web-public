import { profiles, users, workerProfiles } from '../db/schema'

type ProfileRow = typeof profiles.$inferSelect | null | undefined
type WorkerProfileRow = typeof workerProfiles.$inferSelect | null | undefined
type UserRow = typeof users.$inferSelect

const hasText = (value: string | null | undefined) => Boolean(value?.trim())

export const computeProfileCompleted = (
  role: UserRow['role'],
  profileRecord?: ProfileRow,
  workerProfileRecord?: WorkerProfileRow
) => {
  if (role === 'admin') {
    return true
  }

  const hasBaseLocation = hasText(profileRecord?.addressLabel) || hasText(profileRecord?.city)
  const hasPhone = hasText(profileRecord?.phone)

  if (role === 'client') {
    return hasBaseLocation && hasPhone
  }

  return Boolean(
    hasBaseLocation &&
      hasPhone &&
      hasText(workerProfileRecord?.specialty) &&
      hasText(workerProfileRecord?.aboutMe) &&
      hasText(workerProfileRecord?.workExperience) &&
      hasText(workerProfileRecord?.coverageAreaLabel ?? profileRecord?.addressLabel ?? profileRecord?.city) &&
      (workerProfileRecord?.serviceRadiusKm ?? 0) > 0
  )
}

export const serializeAuthenticatedUser = (
  user: UserRow,
  provider: 'system' | 'form' | 'google' = 'system',
  profileCompleted = false
) => ({
  id: user.id,
  email: user.email,
  name: user.displayName,
  role: user.role,
  status: user.status,
  provider,
  profileImageUrl: user.profileImageUrl,
  googleAvatarUrl: user.googleAvatarUrl,
  profileImageSource: user.profileImageSource,
  profileCompleted
})
