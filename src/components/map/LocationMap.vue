<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Expand, LocateFixed, Minimize2, X } from 'lucide-vue-next'
import L from 'leaflet'
import type { MapPoint } from '@/data/mockData'
import { toApproximateArea } from '@/utils/locationPrivacy'

const props = withDefaults(
  defineProps<{
    modelValue: MapPoint | null
    markers?: MapPoint[]
    interactive?: boolean
    heightClass?: string
  }>(),
  {
    markers: () => [],
    interactive: false,
    heightClass: 'h-[360px]'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: MapPoint | null]
}>()

const fallbackCenter: [number, number] = [14.5547, 121.0244]

const mapRoot = ref<HTMLElement | null>(null)
const locating = ref(false)
const expanded = ref(false)

let map: L.Map | null = null
let pointsLayer: L.LayerGroup | null = null
let preserveViewportOnNextSync = false
let pendingViewport: { center: [number, number]; zoom: number } | null = null

const snapshotViewport = () => {
  if (!map) {
    return
  }

  const center = map.getCenter()
  pendingViewport = {
    center: [center.lat, center.lng],
    zoom: map.getZoom()
  }
}

const emitPinUpdate = (value: MapPoint | null, preserveViewport = false) => {
  preserveViewportOnNextSync = preserveViewport
  emit('update:modelValue', value)
}

const resetMapInstance = async () => {
  map?.remove()
  map = null
  pointsLayer = null

  await nextTick()

  if (!mapRoot.value) {
    return
  }

  map = L.map(mapRoot.value, {
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: false
  }).setView(
    pendingViewport?.center ?? resolvedCenter.value,
    pendingViewport?.zoom ?? (props.modelValue ? 15 : 13)
  )

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  drawPoints()
  bindMapInteractions()
  pendingViewport = null
}

const resolvedCenter = computed<[number, number]>(() => {
  if (props.modelValue) {
    return [props.modelValue.lat, props.modelValue.lng]
  }

  if (props.markers.length > 0) {
    return [props.markers[0].lat, props.markers[0].lng]
  }

  return fallbackCenter
})

const mainMarkerIcon = L.divIcon({
  className: 'proxifix-map-pin',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;">
      <div style="position:absolute;inset:0;border-radius:999px;background:rgba(255,90,31,0.18);box-shadow:0 0 0 8px rgba(255,90,31,0.08);"></div>
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:linear-gradient(135deg,#ff8f45,#ff5a1f);border:3px solid #ffffff;box-shadow:0 14px 28px rgba(255,90,31,0.34),0 0 0 1px rgba(17,24,39,0.06);"></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
})

const buildConcernPoint = (lat: number, lng: number): MapPoint => ({
  id: props.modelValue?.id ?? 'concern-pin',
  label: props.modelValue?.label ?? 'Pinned job location',
  lat: Number(lat.toFixed(5)),
  lng: Number(lng.toFixed(5)),
  kind: 'concern'
})

const drawPoints = () => {
  if (!map) {
    return
  }

  pointsLayer?.remove()
  pointsLayer = L.layerGroup()

  props.markers.forEach((marker) => {
    const approximateLat = Number(marker.lat.toFixed(3))
    const approximateLng = Number(marker.lng.toFixed(3))

    L.circle([approximateLat, approximateLng], {
      radius: 180,
      weight: 1.5,
      color: '#ff7b36',
      fillColor: '#ff8a3d',
      fillOpacity: 0.16
    }).addTo(pointsLayer!)

    L.circleMarker([approximateLat, approximateLng], {
      radius: 6,
      weight: 2.5,
      color: '#ffffff',
      fillColor: '#ff5a1f',
      fillOpacity: 1
    })
      .bindTooltip(`${toApproximateArea(marker.label)} · nearby`, { direction: 'top' })
      .addTo(pointsLayer!)
  })

  if (props.modelValue) {
    const marker = L.marker([props.modelValue.lat, props.modelValue.lng], {
      icon: mainMarkerIcon,
      draggable: props.interactive
    })

    marker.bindTooltip('Private exact pin', {
      direction: 'top',
      permanent: true,
      offset: [0, -18]
    })

    if (props.interactive) {
      marker.on('dragend', () => {
        const next = marker.getLatLng()
        emitPinUpdate(buildConcernPoint(next.lat, next.lng), true)
      })

      marker.on('dblclick', () => {
        emitPinUpdate(null, true)
      })
    }

    marker.addTo(pointsLayer)
  }

  pointsLayer.addTo(map)
}

const centerMap = () => {
  if (!map) {
    return
  }

  map.setView(resolvedCenter.value, props.modelValue ? 15 : 13, { animate: false })
}

const bindMapInteractions = () => {
  if (!map || !props.interactive) {
    return
  }

  map.on('dblclick', (event: L.LeafletMouseEvent) => {
    if (props.modelValue) {
      const distanceToPin = map!.distance([props.modelValue.lat, props.modelValue.lng], event.latlng)

      if (distanceToPin <= 42) {
        emitPinUpdate(null, true)
        return
      }
    }

    emitPinUpdate(buildConcernPoint(event.latlng.lat, event.latlng.lng), true)
  })
}

const useCurrentLocation = () => {
  if (!navigator.geolocation || locating.value) {
    return
  }

  locating.value = true

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const nextPoint = buildConcernPoint(coords.latitude, coords.longitude)
      emitPinUpdate(nextPoint, true)
      locating.value = false

      if (map) {
        map.setView([nextPoint.lat, nextPoint.lng], 16)
      }
    },
    () => {
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

const toggleExpanded = async () => {
  snapshotViewport()
  expanded.value = !expanded.value
}

onMounted(() => {
  resetMapInstance()
})

watch(
  () => [props.modelValue, props.markers] as const,
  async () => {
    if (!map) {
      return
    }

    await nextTick()
    map.invalidateSize()
    drawPoints()

    if (preserveViewportOnNextSync) {
      preserveViewportOnNextSync = false
      return
    }

    centerMap()
  },
  { deep: true }
)

watch(expanded, async () => {
  await resetMapInstance()
})

onBeforeUnmount(() => {
  map?.remove()
})
</script>

<template>
  <div>
    <div
      v-if="expanded"
      class="fixed inset-0 z-[59] bg-[#111827]/20 backdrop-blur-[1px]"
      @click.self="toggleExpanded"
    />

    <div
      :class="
        expanded
          ? 'fixed inset-x-6 top-6 z-[60] mx-auto max-w-6xl'
          : ''
      "
    >
      <div class="relative overflow-hidden rounded-[28px] border border-[var(--pf-border)] bg-white shadow-[0_16px_40px_rgba(17,24,39,0.08)]">
        <div class="absolute left-4 right-4 top-4 z-[500] flex flex-wrap items-center justify-between gap-3">
          <div class="rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-[#4B5563] shadow-sm">
            Double-click to place or clear your private pin. Nearby workers stay approximate until you choose to share more.
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-if="interactive"
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white/95 px-3 py-2 text-xs font-semibold text-[#111827] shadow-sm transition hover:bg-white"
              @click="useCurrentLocation"
            >
              <LocateFixed class="h-3.5 w-3.5 text-[#FF5A1F]" />
              {{ locating ? 'Locating...' : 'Use current location' }}
            </button>

            <button
              v-if="interactive && modelValue"
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white/95 px-3 py-2 text-xs font-semibold text-[#111827] shadow-sm transition hover:bg-white"
              @click="emitPinUpdate(null, true)"
            >
              <X class="h-3.5 w-3.5 text-[#FF5A1F]" />
              Clear private pin
            </button>

            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white/95 px-3 py-2 text-xs font-semibold text-[#111827] shadow-sm transition hover:bg-white"
              @click="toggleExpanded"
            >
              <component :is="expanded ? Minimize2 : Expand" class="h-3.5 w-3.5 text-[#FF5A1F]" />
              {{ expanded ? 'Minimize map' : 'Maximize map' }}
            </button>
          </div>
        </div>

        <div ref="mapRoot" :class="[expanded ? 'h-[78vh] min-h-[560px]' : heightClass]" />
      </div>
    </div>
  </div>
</template>
