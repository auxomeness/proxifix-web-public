<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const content = computed(() => {
  const infoType = route.meta.infoType as string

  const contentMap: Record<string, { title: string; body: string[] }> = {
    privacy: {
      title: 'Privacy Policy',
      body: [
        'ProxiFix stores user profile, concern, and verification data only for platform operations and trust management.',
        'Sensitive uploads such as IDs and worker documents require admin-only access controls.',
        'Location data is used to compute proximity, filter visibility, and improve local matching relevance.'
      ]
    },
    terms: {
      title: 'Terms and Conditions',
      body: [
        'Workers are responsible for the truthfulness of submitted verification documents and professional claims.',
        'Clients and workers must use platform messaging respectfully and comply with moderation rules.',
        'ProxiFix provides trust, visibility, and accountability tools but does not guarantee service outcomes.'
      ]
    },
    about: {
      title: 'About ProxiFix',
      body: [
        'ProxiFix is a location-based platform for connecting clients with nearby verified workers.',
        'The product is designed around trust, locality, urgent service needs, and clear job coordination.',
        'Verification, structured offers, and map-based concern pinning are central to the product direction.'
      ]
    },
    contact: {
      title: 'Contact Support',
      body: [
        'Support covers account recovery, verification issues, moderation concerns, and platform guidance.',
        'Typical support channels include in-app reporting, email support, and admin review pathways.',
        'Future backend integration can connect these support flows to actual ticketing and notification systems.'
      ]
    }
  }

  return contentMap[infoType] ?? contentMap.about
})
</script>

<template>
  <main class="min-h-screen bg-[#F7F8FA] px-4 py-8 text-[#111827] sm:px-6 lg:px-8">
    <div class="mx-auto max-w-4xl rounded-[28px] border border-[#E5E7EB] bg-white p-7 shadow-sm lg:p-10">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Information page</p>
      <h1 class="app-heading mt-4 text-4xl font-semibold text-[#111827]">{{ content.title }}</h1>

      <div class="mt-8 space-y-4">
        <section
          v-for="paragraph in content.body"
          :key="paragraph"
          class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5 text-sm leading-7 text-[#6B7280]"
        >
          {{ paragraph }}
        </section>
      </div>

      <div class="mt-8">
        <RouterLink
          to="/"
          class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
        >
          Back to home
        </RouterLink>
      </div>
    </div>
  </main>
</template>
