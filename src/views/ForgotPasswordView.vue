<template>
  <main class="min-h-screen bg-[#F7F8FA] px-4 py-8 text-[#111827] sm:px-6 lg:px-8">
    <div class="mx-auto max-w-3xl">
      <div class="rounded-[28px] border border-[#E5E7EB] bg-white p-7 shadow-[0_10px_30px_rgba(17,24,39,0.06)] lg:p-10">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Account recovery</p>
        <h1 class="app-heading mt-4 text-4xl font-semibold text-[#111827]">Request a password reset</h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-[#6B7280]">
          Enter the email linked to your ProxiFix account. In the real flow, this triggers a secure email token for password reset.
        </p>

        <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_0.86fr]">
          <form class="space-y-4">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-[#374151]">Email address</span>
              <input
                class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="name@example.com"
              />
            </label>

            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.2)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
            >
              Send reset link
            </button>
          </form>

          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-sm font-semibold text-[#111827]">Recovery steps</p>
            <div class="mt-4 space-y-3">
              <div class="rounded-xl bg-white px-4 py-3 text-sm text-[#6B7280]">1. Submit account email</div>
              <div class="rounded-xl bg-white px-4 py-3 text-sm text-[#6B7280]">2. Receive reset token by email</div>
              <div class="rounded-xl bg-white px-4 py-3 text-sm text-[#6B7280]">3. Open the reset screen and choose a new password</div>
            </div>
          </div>
        </div>

        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink
            to="/reset-password"
            class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
          >
            Go to reset screen
          </RouterLink>
          <RouterLink
            to="/login"
            class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
          >
            Back to login
          </RouterLink>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
