<template>
  <main class="min-h-screen bg-[#F7F8FA] px-4 py-8 text-[#111827] sm:px-6 lg:px-8">
    <div class="mx-auto max-w-3xl">
      <div class="rounded-[28px] border border-[#E5E7EB] bg-white p-7 shadow-[0_10px_30px_rgba(17,24,39,0.06)] lg:p-10">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Token-based reset</p>
        <h1 class="app-heading mt-4 text-4xl font-semibold text-[#111827]">Choose a new password</h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-[#6B7280]">
          This front-end screen represents the email-token reset flow you listed in the checklist. The backend token validation will be added later.
        </p>

        <form class="mt-8 grid gap-4">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-[#374151]">Reset token</span>
            <input
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              placeholder="Paste token from email"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-[#374151]">New password</span>
            <input
              type="password"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              placeholder="••••••••"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-[#374151]">Confirm password</span>
            <input
              type="password"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              placeholder="••••••••"
            />
          </label>

          <button
            type="button"
            class="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.2)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
          >
            Reset password
          </button>
        </form>
      </div>
    </div>
  </main>
</template>
