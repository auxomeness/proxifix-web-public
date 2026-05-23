<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md'
    title?: string
  }>(),
  {
    size: 'md',
    title: 'Verified worker'
  }
)

const uid = `verified-${Math.random().toString(36).slice(2, 9)}`

const sizeClasses = {
  sm: 'h-4.5 w-4.5',
  md: 'h-5 w-5'
}
</script>

<template>
  <span
    class="inline-flex items-center justify-center align-middle"
    :title="title"
    :aria-label="title"
  >
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      :class="sizeClasses[props.size]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient :id="`${uid}-gradient`" x1="3" y1="3" x2="17" y2="17" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF8B3D" />
          <stop offset="1" stop-color="#FF5A1F" />
        </linearGradient>
        <filter :id="`${uid}-badge-shadow`" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#FF5A1F" flood-opacity="0.28" />
        </filter>
        <filter :id="`${uid}-check-shadow`" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.8" flood-color="#7C2D12" flood-opacity="0.18" />
        </filter>
      </defs>

      <path
        d="M10 1.5 12.06 2.34 14.31 2.05 15.53 3.96 17.69 4.67 17.95 6.92 19.48 8.58 18.73 10.72 19.48 12.87 17.95 14.53 17.69 16.78 15.53 17.49 14.31 19.4 12.06 19.11 10 19.95 7.94 19.11 5.69 19.4 4.47 17.49 2.31 16.78 2.05 14.53 .52 12.87 1.27 10.72 .52 8.58 2.05 6.92 2.31 4.67 4.47 3.96 5.69 2.05 7.94 2.34 10 1.5Z"
        :fill="`url(#${uid}-gradient)`"
        :filter="`url(#${uid}-badge-shadow)`"
      />
      <path
        d="M10 2.9 11.8 3.63 13.76 3.38 14.83 5.04 16.7 5.65 16.92 7.62 18.25 9.07 17.6 10.95 18.25 12.82 16.92 14.27 16.7 16.24 14.83 16.85 13.76 18.51 11.8 18.26 10 19 8.2 18.26 6.24 18.51 5.17 16.85 3.3 16.24 3.08 14.27 1.75 12.82 2.4 10.95 1.75 9.07 3.08 7.62 3.3 5.65 5.17 5.04 6.24 3.38 8.2 3.63 10 2.9Z"
        stroke="rgba(255,255,255,0.24)"
        stroke-width="0.7"
      />
      <path
        d="M6.95 10.35 9.05 12.4l4-4.2"
        stroke="#fff"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :filter="`url(#${uid}-check-shadow)`"
      />
    </svg>
  </span>
</template>
