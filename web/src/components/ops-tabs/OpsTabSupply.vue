<template>
  <CategoryStructure :date-key="dateKey" :city="city" :store-id="storeId" />
</template>

<script setup lang="ts">
import CategoryStructure from '../CategoryStructure.vue'

defineProps<{
  dateKey: string
  city: string
  storeId: string
}>()
</script>
