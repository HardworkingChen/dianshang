<template>
  <section class="analytics-page-hero panel-card">
    <div class="analytics-page-hero__shell">
      <div class="analytics-page-hero__copy">
        <div class="analytics-page-hero__kicker">{{ kicker }}</div>
        <h1 class="analytics-page-hero__title">{{ title }}</h1>
        <p v-if="shouldShowSummary" class="analytics-page-hero__summary">{{ summary }}</p>

        <div v-if="chips.length" class="analytics-page-hero__chips">
          <span v-for="chip in chips" :key="chip" class="analytics-page-hero__chip">
            {{ chip }}
          </span>
        </div>

        <div v-if="meta" class="analytics-page-hero__meta">{{ meta }}</div>

        <div v-if="$slots.actions" class="analytics-page-hero__actions">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="safeHighlights.length" class="analytics-page-hero__facts">
        <article
          v-for="item in safeHighlights"
          :key="item.label"
          class="analytics-page-hero__fact"
          :class="item.tone ? `is-${item.tone}` : ''"
        >
          <span class="analytics-page-hero__fact-label">{{ item.label }}</span>
          <strong class="analytics-page-hero__fact-value">{{ item.value }}</strong>
          <span v-if="item.note" class="analytics-page-hero__fact-note">{{ item.note }}</span>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  kicker: {
    type: String,
    default: '数据工作台',
  },
  title: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  chips: {
    type: Array,
    default: () => [],
  },
  highlights: {
    type: Array,
    default: () => [],
  },
})

const conciseCopy = import.meta.env.VITE_CONCISE_COPY !== 'false'

const safeHighlights = computed(() =>
  (Array.isArray(props.highlights) ? props.highlights : [])
    .filter(item => item && item.label && item.value !== undefined && item.value !== null)
    .slice(0, 4)
)

const shouldShowSummary = computed(() => !conciseCopy && !!props.summary)
</script>
