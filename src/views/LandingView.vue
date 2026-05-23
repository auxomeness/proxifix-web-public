<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowRight,
  Clock3,
  MapPinned,
  ShieldCheck
} from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import ProxifixLogo from '@/components/shared/ProxifixLogo.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import {
  landingMetrics,
  platformHighlights,
  stackSummary
} from '@/data/mockData'

const router = useRouter()
const pendingPortal = ref<'client' | 'worker' | ''>('')

const openPortal = async (portal: 'client' | 'worker') => {
  if (pendingPortal.value) {
    return
  }

  pendingPortal.value = portal
  await router.push(`/login?portal=${portal}`)
}
</script>

<template>
  <main class="landing-shell relative min-h-screen overflow-hidden bg-[var(--pf-bg)] text-[var(--pf-text)]">
    <div class="pointer-events-none absolute inset-x-0 top-[-220px] z-0 flex justify-center">
      <div class="h-[520px] w-[1040px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.22),rgba(255,138,61,0.07)_48%,transparent_74%)] blur-[90px]" />
    </div>
    <div class="pointer-events-none absolute left-[-120px] top-[420px] z-0 h-[240px] w-[240px] rounded-full bg-[rgba(255,90,31,0.08)] blur-[80px]" />
    <div class="pointer-events-none absolute right-[-80px] top-[220px] z-0 h-[340px] w-[340px] rounded-full bg-[rgba(255,166,77,0.09)] blur-[90px]" />

    <header class="landing-topbar topbar-glass relative z-10 border-b border-[var(--pf-border)]">
      <div class="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <RouterLink to="/" class="flex items-center gap-3">
          <ProxifixLogo compact />
        </RouterLink>

        <nav class="hidden items-center gap-7 text-sm font-medium text-[#6B7280] lg:flex">
          <a href="#features" class="transition hover:text-[#111827]">Features</a>
          <a href="#flow" class="transition hover:text-[#111827]">Flow</a>
          <a href="#technology" class="transition hover:text-[#111827]">Technology</a>
        </nav>

        <div class="flex items-center gap-3">
          <RouterLink
            to="/login"
            class="inline-flex items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface-muted)]"
          >
            Sign in
          </RouterLink>
          <RouterLink
            to="/register"
            class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
          >
            Create account
          </RouterLink>
        </div>
      </div>
    </header>

    <div class="relative z-10">
      <section class="landing-hero relative min-h-[calc(100vh-80px)] overflow-hidden border-b border-[var(--pf-border)] bg-[var(--pf-surface)] shadow-[0_20px_48px_rgba(17,24,39,0.06)]">
        <div class="landing-accent-stage absolute inset-y-0 right-0 hidden w-[50%] lg:block [clip-path:ellipse(78%_90%_at_82%_50%)]" />
        <div class="absolute right-[10%] top-[14%] hidden h-16 w-16 rounded-full bg-white/20 lg:block" />
        <div class="absolute bottom-[14%] right-[24%] hidden h-8 w-8 rounded-full bg-white/22 lg:block" />

        <div class="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div class="grid min-h-[calc(100vh-80px)] items-stretch gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 xl:gap-16">
            <div class="flex flex-col justify-center gap-10 py-14 lg:py-[4.5rem] xl:pr-4">
              <div class="max-w-2xl text-left">
                <h1 class="app-heading bg-gradient-to-r from-[#FF8A3D] via-[#FF6D26] to-[#FF4F18] bg-clip-text text-6xl font-semibold leading-[0.92] text-transparent lg:text-[6.2rem]">
                  ProxiFix
                </h1>

                <p class="mt-5 max-w-xl text-lg font-medium leading-8 text-[#374151] lg:text-xl">
                  Local help that feels immediate, verified, and reliable.
                </p>

                <p class="mt-4 max-w-xl text-base leading-8 text-[#6B7280] lg:text-lg">
                  ProxiFix connects clients with nearby verified workers through privacy-safe map pinning,
                  structured offers, lightweight messaging, and admin review that protects trust before the first booking.
                </p>

                <div class="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    :disabled="pendingPortal !== ''"
                    class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-5 py-3 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-wait disabled:opacity-80"
                    @click="openPortal('client')"
                  >
                    {{ pendingPortal === 'client' ? 'Opening client portal…' : 'Open client portal' }}
                    <ArrowRight class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    :disabled="pendingPortal !== ''"
                    class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB] disabled:cursor-wait disabled:opacity-80"
                    @click="openPortal('worker')"
                  >
                    {{ pendingPortal === 'worker' ? 'Opening worker portal…' : 'Open worker portal' }}
                  </button>
                </div>
              </div>

              <div class="grid gap-5 border-t border-[#E5E7EB] pt-6 sm:grid-cols-3">
                <article v-for="metric in landingMetrics" :key="metric.label" class="space-y-2">
                  <p class="app-heading text-3xl font-semibold text-[#111827]">{{ metric.value }}</p>
                  <p class="text-sm font-semibold text-[#374151]">{{ metric.label }}</p>
                  <p class="text-sm leading-6 text-[#6B7280]">{{ metric.helper }}</p>
                </article>
              </div>
            </div>

            <div class="relative flex items-center justify-center py-14 lg:px-4 lg:py-[4.5rem]">
              <div class="relative w-full max-w-[620px]">
                <article class="landing-main-card relative z-20 ml-auto w-full max-w-[500px] rounded-[32px] border border-[#FFD4BE] bg-white p-6 shadow-[0_24px_50px_rgba(17,24,39,0.12)]">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Active job</p>
                      <h2 class="mt-3 text-2xl font-semibold text-[#111827]">Kitchen sink leak in Makati</h2>
                      <p class="mt-2 text-sm leading-6 text-[#6B7280]">
                        Client shared only the approximate service zone, set urgency, and opened the request to nearby verified plumbers only.
                      </p>
                    </div>
                    <span class="inline-flex items-center rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#DC2626]">
                      Urgent
                    </span>
                  </div>

                  <div class="mt-5 rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="flex items-center gap-2">
                          <p class="font-semibold text-[#111827]">Marco Santos</p>
                          <VerifiedBadge size="sm" />
                        </div>
                        <p class="mt-1 text-sm text-[#6B7280]">Residential plumber · Available now</p>
                      </div>
                      <span class="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#4B5563] shadow-sm">
                        2.1 km away
                      </span>
                    </div>

                    <div class="mt-4 grid gap-3 sm:grid-cols-2">
                      <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                        <p class="text-sm font-semibold text-[#111827]">Arrival</p>
                        <p class="mt-2 text-sm text-[#6B7280]">Within 45 minutes</p>
                      </div>
                      <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                        <p class="text-sm font-semibold text-[#111827]">Quote</p>
                        <p class="mt-2 text-sm text-[#6B7280]">₱1,900 · Today, 7:15 PM</p>
                      </div>
                    </div>
                  </div>
                </article>

                <article class="landing-float-card relative z-10 mt-[-22px] w-[56%] rounded-[28px] border border-white/55 bg-white/98 p-5 shadow-[0_18px_38px_rgba(17,24,39,0.1)]">
                  <div class="flex items-center gap-2">
                    <MapPinned class="h-4.5 w-4.5 text-[#FF5A1F]" />
                    <p class="text-sm font-semibold text-[#111827]">Approximate service zone</p>
                  </div>
                  <p class="mt-3 text-sm leading-6 text-[#6B7280]">
                    Makati service zone
                  </p>
                  <div class="mt-4 flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm">
                    <span class="text-[#6B7280]">Visibility radius</span>
                    <span class="font-semibold text-[#111827]">5 km</span>
                  </div>
                </article>

                <article class="landing-float-card absolute right-[10px] top-[14%] z-30 hidden w-[220px] rounded-[26px] border border-white/50 bg-white/98 p-4 shadow-[0_18px_36px_rgba(17,24,39,0.1)] lg:block">
                  <div class="flex items-center gap-2">
                    <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
                    <p class="text-sm font-semibold text-[#111827]">Trust first</p>
                  </div>
                  <p class="mt-3 text-sm leading-6 text-[#6B7280]">
                    Worker visibility starts only after admin verification is approved.
                  </p>
                </article>

                <article class="landing-float-card absolute bottom-[8%] right-[9%] z-30 hidden w-[236px] rounded-[26px] border border-white/50 bg-white/98 p-4 shadow-[0_18px_36px_rgba(17,24,39,0.1)] lg:block">
                  <div class="flex items-center gap-2">
                    <Clock3 class="h-4.5 w-4.5 text-[#FF5A1F]" />
                    <p class="text-sm font-semibold text-[#111827]">Fast decisions</p>
                  </div>
                  <p class="mt-3 text-sm leading-6 text-[#6B7280]">
                    Structured offers keep price, schedule, and service notes readable in one surface.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-0 sm:px-6 lg:px-8">
        <section class="space-y-10 pb-16 lg:space-y-12 lg:pb-24">
          <section id="features" class="grid gap-6 lg:grid-cols-3">
          <article
            v-for="feature in platformHighlights"
            :key="feature.title"
            class="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.08)]"
          >
            <div class="h-1 w-12 rounded-full bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F]" />
            <h2 class="mt-5 text-xl font-semibold tracking-tight text-[#111827]">{{ feature.title }}</h2>
            <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ feature.body }}</p>
          </article>
        </section>

          <section class="grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
            <SectionCard
              id="flow"
              eyebrow="Client flow"
              title="The product stays short, direct, and confidence-building"
              description="The system reduces friction at every step so clients can move from problem to action without getting lost."
            >
              <div class="space-y-4">
                <div
                  v-for="item in ['Describe the problem and set urgency', 'Place a private pin and keep the exact point hidden by default', 'Review nearby verified workers by distance and availability', 'Compare structured offers in a consistent format', 'Confirm the worker, message, and complete the job with a rating']"
                  :key="item"
                  class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm font-medium text-[#374151]"
                >
                  {{ item }}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="technology"
              eyebrow="Technology"
              title="Web-first architecture that matches the product direction"
              description="Frontend polish comes first, but the interface is already organized around the backend services, security layers, and map interactions the platform will use next."
            >
              <div class="grid gap-3 sm:grid-cols-2">
                <div
                  v-for="item in stackSummary"
                  :key="item"
                  class="rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-semibold text-[#374151]"
                >
                  {{ item }}
                </div>
              </div>
            </SectionCard>
          </section>
        </section>
      </div>
    </div>

    <footer class="landing-topbar topbar-glass relative z-10 border-t border-[var(--pf-border)]">
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 text-sm text-[#6B7280] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <p>ProxiFix is a web-first platform for verified local service coordination.</p>
        <div class="flex flex-wrap gap-4">
          <RouterLink to="/privacy-policy" class="transition hover:text-[#111827]">Privacy Policy</RouterLink>
          <RouterLink to="/terms-and-conditions" class="transition hover:text-[#111827]">Terms and Conditions</RouterLink>
          <RouterLink to="/about-us" class="transition hover:text-[#111827]">About Us</RouterLink>
          <RouterLink to="/contact-support" class="transition hover:text-[#111827]">Contact Support</RouterLink>
        </div>
      </div>
    </footer>
  </main>
</template>
