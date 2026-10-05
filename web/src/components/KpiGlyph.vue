<template>
  <svg class="glyph" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <g v-if="name === 'profit'">
      <ellipse cx="16" cy="8" rx="8" ry="3.5" />
      <path d="M8 8v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V8" />
      <path d="M8 13v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5" />
      <path d="M8 18v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5" />
    </g>
    <g v-else-if="name === 'paid'">
      <rect x="7" y="12" width="18" height="14" rx="3" />
      <path d="M11 12V9.5a5 5 0 0 1 10 0V12" />
      <circle cx="16" cy="18" r="1.8" />
      <path d="M16 19.8V23" />
    </g>
    <g v-else-if="name === 'orders'">
      <path d="M9 6h14v21l-3-2-4 2-4-2-3 2V6Z" />
      <path d="M12 11h8M12 15h8M12 19h5" />
      <path d="M12 4h8" />
    </g>
    <g v-else-if="name === 'arpu'">
      <circle cx="16" cy="11" r="5" />
      <path d="M7 26c.7-5.3 3.7-8 9-8s8.3 2.7 9 8" />
    </g>
    <g v-else-if="name === 'rate'">
      <path d="M16 5a11 11 0 1 0 11 11H16V5Z" />
      <path d="M19 5.5A9.5 9.5 0 0 1 26.5 13H19V5.5Z" />
    </g>
    <g v-else-if="name === 'gmv'">
      <circle cx="16" cy="16" r="11" />
      <path d="M16 9.2v13.6" />
      <path d="M12.2 13.2c1.1-1.6 7.6-1.6 7.6.9 0 2.1-3.2 2.4-7.6 2.4" />
      <path d="M12.2 19.2c1.3 1.5 7.6 1.5 7.6-.8" />
    </g>
    <g v-else-if="name === 'unit'">
      <path d="M7 26V16h4v10M14 26V10h4v16M21 26V6h4v20" />
      <path d="M5 26h22" />
    </g>
    <g v-else-if="name === 'online'">
      <path d="m6 13 2-7h16l2 7" />
      <path d="M8 16v10h16V16" />
      <path d="M12 26v-7h8v7" />
      <path d="M6 13c0 2 1.4 3 3 3s3-1 3-3c0 2 1.6 3 4 3s4-1 4-3c0 2 1.4 3 3 3s3-1 3-3" />
    </g>
    <g v-else>
      <path d="M25 12a10 10 0 0 0-16-3" />
      <path d="m8 5 1 4 4-1" />
      <path d="M7 20a10 10 0 0 0 16 3" />
      <path d="m24 27-1-4-4 1" />
      <path d="M11 16h10" />
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<style scoped>
.glyph {
  width: 25px;
  height: 25px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
