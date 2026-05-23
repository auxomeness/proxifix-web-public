<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, ShieldCheck } from 'lucide-vue-next'

import { apiFetch } from '@/lib/api'
import StatusPill from '@/components/shared/StatusPill.vue'

type UserStatus = 'Active' | 'Suspended' | 'Pending' | 'Deactivated'

interface AdminUserRecord {
  id: string
  name: string
  role: 'Client' | 'Worker' | 'Admin'
  status: UserStatus
  location: string
  joinedAt: string
  note: string
  email: string
}

const searchQuery = ref('')
const selectedRole = ref<'All' | 'Client' | 'Worker' | 'Admin'>('All')
const selectedStatus = ref<'All' | UserStatus>('All')
const users = ref<AdminUserRecord[]>([])
const selectedUserId = ref('')
const moderationFeedback = ref('')
const loading = ref(true)

const filteredUsers = computed(() =>
  users.value.filter((user) => {
    const matchesRole = selectedRole.value === 'All' || user.role === selectedRole.value
    const matchesStatus = selectedStatus.value === 'All' || user.status === selectedStatus.value
    const matchesSearch =
      !searchQuery.value ||
      `${user.name} ${user.location} ${user.role}`.toLowerCase().includes(searchQuery.value.toLowerCase())

    return matchesRole && matchesStatus && matchesSearch
  })
)

const pendingUsersCount = computed(() => users.value.filter((user) => user.status === 'Pending').length)
const workerUsersCount = computed(() => users.value.filter((user) => user.role === 'Worker').length)

const selectedUser = computed(
  () => filteredUsers.value.find((user) => user.id === selectedUserId.value) ?? filteredUsers.value[0] ?? users.value[0]
)

const loadUsers = async () => {
  loading.value = true

  try {
    const response = await apiFetch('/api/admin/users')
    if (!response.ok) {
      throw new Error('Unable to load accounts.')
    }

    const payload = (await response.json()) as {
      ok: boolean
      users: Array<{
        id: string
        name: string
        role: 'client' | 'worker' | 'admin'
        status: 'active' | 'suspended' | 'pending_verification' | 'deactivated'
        location: string
        joinedAt: string
        note: string
        email: string
      }>
    }

    users.value = payload.users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role === 'client' ? 'Client' : user.role === 'worker' ? 'Worker' : 'Admin',
      status:
        user.status === 'active'
          ? 'Active'
          : user.status === 'suspended'
            ? 'Suspended'
            : user.status === 'deactivated'
              ? 'Deactivated'
              : 'Pending',
      location: user.location,
      joinedAt: user.joinedAt,
      note: user.note,
      email: user.email
    }))

    if (!selectedUserId.value) {
      selectedUserId.value = users.value[0]?.id ?? ''
    }
  } catch (error) {
    moderationFeedback.value = error instanceof Error ? error.message : 'Unable to load accounts.'
  } finally {
    loading.value = false
  }
}

const updateUserStatus = async (nextStatus: UserStatus, message: string) => {
  if (!selectedUser.value) {
    return
  }

  const response = await apiFetch(`/api/admin/users/${selectedUser.value.id}/status`, {
    method: 'POST',
    body: JSON.stringify({
      status:
        nextStatus === 'Active'
          ? 'active'
          : nextStatus === 'Suspended'
            ? 'suspended'
            : nextStatus === 'Deactivated'
              ? 'deactivated'
              : 'pending_verification'
    })
  })

  if (!response.ok) {
    throw new Error('Unable to update account status.')
  }

  await loadUsers()
  moderationFeedback.value = message
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedRole.value = 'All'
  selectedStatus.value = 'All'
}

const cycleUserStatus = () => {
  if (!selectedUser.value) {
    return
  }

  const sequence: UserStatus[] = ['Active', 'Pending', 'Suspended', 'Deactivated', 'Active']
  const nextStatus = sequence[(sequence.indexOf(selectedUser.value.status) + 1) % sequence.length]
  void updateUserStatus(nextStatus, `${selectedUser.value.name} is now ${nextStatus.toLowerCase()}.`).catch((error) => {
    moderationFeedback.value = error instanceof Error ? error.message : 'Unable to update account status.'
  })
}

const suspendUser = () => {
  if (!selectedUser.value) {
    return
  }

  void updateUserStatus('Suspended', `${selectedUser.value.name} was suspended.`).catch((error) => {
    moderationFeedback.value = error instanceof Error ? error.message : 'Unable to suspend account.'
  })
}

const deactivateUser = () => {
  if (!selectedUser.value) {
    return
  }

  void updateUserStatus('Deactivated', `${selectedUser.value.name} was marked as deactivated.`).catch((error) => {
    moderationFeedback.value = error instanceof Error ? error.message : 'Unable to deactivate account.'
  })
}

const deleteUser = async () => {
  if (!selectedUser.value) {
    return
  }

  if (selectedUser.value.role === 'Admin') {
    moderationFeedback.value = 'Admin accounts cannot be deleted.'
    return
  }

  const approved = window.confirm(
    `Delete ${selectedUser.value.name}'s account permanently? This action cannot be undone.`
  )
  if (!approved) {
    return
  }

  try {
    const response = await apiFetch(`/api/admin/users/${selectedUser.value.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Unable to delete account.')
    }

    await loadUsers()
    moderationFeedback.value = `${selectedUser.value.name}'s account was deleted.`
  } catch (error) {
    moderationFeedback.value = error instanceof Error ? error.message : 'Unable to delete account.'
  }
}

watch(filteredUsers, (items) => {
  if (items.length === 0) {
    return
  }

  if (!items.some((user) => user.id === selectedUserId.value)) {
    selectedUserId.value = items[0].id
  }
})

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_14px_34px_rgba(17,24,39,0.06)] lg:p-8">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">User control</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">User management</h2>
          <p class="mt-4 max-w-2xl text-base leading-8 text-[#6B7280]">
            Search accounts, narrow the moderation view by role and state, and move into the selected account without losing context.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <article class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Total accounts</p>
            <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ users.length }}</p>
          </article>
          <article class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Workers</p>
            <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ workerUsersCount }}</p>
          </article>
          <article class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Pending review</p>
            <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ pendingUsersCount }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div class="space-y-6">
        <section class="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm lg:p-7">
          <div class="grid gap-5">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div class="relative min-w-0 flex-1">
                <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  v-model="searchQuery"
                  class="h-13 w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 pl-12 text-base text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                  placeholder="Search name, role, or location"
                />
              </div>

              <div class="flex items-center gap-3">
                <p class="text-sm font-medium text-[#6B7280]">
                  {{ filteredUsers.length }} result{{ filteredUsers.length === 1 ? '' : 's' }}
                </p>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="resetFilters"
                >
                  Clear filters
                </button>
              </div>
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
              <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-4 lg:p-5">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Role filter</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button
                    v-for="role in (['All', 'Client', 'Worker', 'Admin'] as const)"
                    :key="role"
                    type="button"
                    class="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                    :class="
                      selectedRole === role
                        ? 'bg-[#FFF1EB] text-[#FF5A1F]'
                        : 'border border-transparent text-[#6B7280] hover:border-[#E5E7EB] hover:bg-white hover:text-[#111827]'
                    "
                    @click="selectedRole = role"
                  >
                    {{ role }}
                  </button>
                </div>
              </div>

              <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-4 lg:p-5">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Account state</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button
                    v-for="status in (['All', 'Active', 'Suspended', 'Pending', 'Deactivated'] as const)"
                    :key="status"
                    type="button"
                    class="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                    :class="
                      selectedStatus === status
                        ? 'bg-[#111827] text-white shadow-sm'
                        : 'border border-transparent text-[#6B7280] hover:border-[#E5E7EB] hover:bg-white hover:text-[#111827]'
                    "
                    @click="selectedStatus = status"
                  >
                    {{ status }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-[#111827]">Accounts in view</p>
              <p class="mt-1 text-sm text-[#6B7280]">Select one account to inspect details and take action.</p>
            </div>
          </div>

          <div v-if="filteredUsers.length > 0" class="mt-4 space-y-3">
            <button
              v-for="user in filteredUsers"
              :key="user.id"
              type="button"
              class="w-full rounded-[24px] border p-5 text-left transition lg:p-6"
              :class="
                selectedUser?.id === user.id
                  ? 'border-[#FFCAA8] bg-[linear-gradient(135deg,#FFF5EE_0%,#FFFFFF_100%)] shadow-[0_12px_24px_rgba(255,90,31,0.08)]'
                  : 'border-[#E5E7EB] bg-[#FBFBFC] hover:border-[#D7DCE3] hover:bg-white'
              "
              @click="selectedUserId = user.id"
            >
              <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-lg font-semibold text-[#111827]">{{ user.name }}</h3>
                    <StatusPill
                      :label="user.status"
                      :tone="user.status === 'Active' ? 'success' : user.status === 'Suspended' || user.status === 'Deactivated' ? 'danger' : 'warning'"
                    />
                    <StatusPill :label="user.role" tone="neutral" />
                  </div>
                  <p class="mt-2 text-sm text-[#6B7280]">{{ user.location }} · Joined {{ user.joinedAt }}</p>
                  <p class="mt-3 max-w-3xl text-sm leading-6 text-[#6B7280]">{{ user.note }}</p>
                </div>

                <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                  {{ user.id }}
                </span>
              </div>
            </button>
          </div>
          <div
            v-else-if="!loading"
            class="mt-4 rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-10 text-center"
          >
            <h3 class="text-base font-semibold text-[#111827]">No accounts match these filters</h3>
            <p class="mt-2 text-sm text-[#6B7280]">Try clearing one filter or widening the search.</p>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <section class="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_10px_24px_rgba(17,24,39,0.06)]">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">Selected account</p>
              <h3 class="mt-2 text-2xl font-semibold text-[#111827]">{{ selectedUser?.name }}</h3>
              <p class="mt-2 text-sm text-[#6B7280]">{{ selectedUser?.role }} · {{ selectedUser?.location }}</p>
            </div>
            <StatusPill
              v-if="selectedUser"
              :label="selectedUser.status"
              :tone="selectedUser.status === 'Active' ? 'success' : selectedUser.status === 'Suspended' || selectedUser.status === 'Deactivated' ? 'danger' : 'warning'"
            />
          </div>

          <div class="mt-5 grid gap-3 text-sm text-[#6B7280]">
            <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
              <span>Joined</span>
              <span class="font-semibold text-[#111827]">{{ selectedUser?.joinedAt }}</span>
            </div>
            <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
              <span>Account type</span>
              <span class="font-semibold text-[#111827]">{{ selectedUser?.role }}</span>
            </div>
            <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
              <span>Current state</span>
              <span class="font-semibold text-[#111827]">{{ selectedUser?.status }}</span>
            </div>
          </div>

          <p class="mt-5 text-sm leading-7 text-[#6B7280]">{{ selectedUser?.note }}</p>

          <div class="mt-6 grid gap-3">
            <button
              type="button"
              class="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-3 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.16)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
              @click="cycleUserStatus"
            >
              Change status
            </button>
            <div class="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-white"
                @click="suspendUser"
              >
                Suspend user
              </button>
              <button
                type="button"
                class="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-[#F4D5D5] bg-white px-4 py-3 text-sm font-semibold text-[#C24141] transition hover:bg-[#FFF6F6]"
                @click="deactivateUser"
              >
                Deactivate account
              </button>
            </div>
            <button
              type="button"
              class="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-[#F4D5D5] bg-white px-4 py-3 text-sm font-semibold text-[#B91C1C] transition hover:bg-[#FFF1F1]"
              @click="deleteUser"
            >
              Delete account permanently
            </button>
          </div>

          <div
            v-if="moderationFeedback"
            class="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm font-medium text-[#374151]"
          >
            {{ moderationFeedback }}
          </div>
        </section>

        <section class="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div class="flex items-center gap-2">
            <ShieldCheck class="h-5 w-5 text-[#FF5A1F]" />
            <h3 class="text-base font-semibold text-[#111827]">Moderation guide</h3>
          </div>
          <div class="mt-4 space-y-3">
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm text-[#4B5563]">
              Review reports tied to the account before applying suspension or deactivation.
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm text-[#4B5563]">
              Remove verified visibility when a worker account no longer meets platform trust requirements.
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm text-[#4B5563]">
              Preserve moderation notes so repeated complaints and suspicious activity patterns remain traceable.
            </div>
          </div>
        </section>
      </aside>
    </section>
  </div>
</template>
