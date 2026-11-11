<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  tabs: {
    type: Array,
    default: () => [],
  },
  primaryLabel: { type: String, default: '' },
  pageLabel: { type: String, default: '' },
  title: { type: String, default: '功能分区' },
  description: { type: String, default: '' },
  activeLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])
const conciseCopy = import.meta.env.VITE_CONCISE_COPY !== 'false'

const currentTab = computed(() => props.tabs.find(tab => tab.key === props.modelValue) || props.tabs[0] || null)
const showTitle = computed(() => !conciseCopy && !!props.title)
const showMeta = computed(() => !!props.primaryLabel || !!props.pageLabel || showTitle.value || (!!props.description && !conciseCopy))

const setTab = key => {
  if (!key || key === props.modelValue) return
  emit('update:modelValue', key)
}
</script>

<template>
  <section class="page-section-tabs">
    <div v-if="showMeta" class="page-section-tabs__meta">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div v-if="primaryLabel || pageLabel" class="page-section-tabs__breadcrumb">
            <span v-if="primaryLabel">{{ primaryLabel }}</span>
            <template v-if="pageLabel">
              <span v-if="primaryLabel" class="page-section-tabs__dot"></span>
              <span>{{ pageLabel }}</span>
            </template>
          </div>
          <h2 v-if="showTitle" class="page-section-tabs__title">{{ title }}</h2>
          <p v-if="description && !conciseCopy" class="page-section-tabs__desc">{{ description }}</p>
        </div>
      </div>
    </div>

    <div class="page-section-tabs__body">
      <div class="overflow-x-auto pb-1">
        <div class="page-section-tabs__tab-list">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="page-section-tabs__tab"
            :class="modelValue === tab.key
              ? 'page-section-tabs__tab--active'
              : 'page-section-tabs__tab--idle'"
            @click="setTab(tab.key)"
          >
            <div class="page-section-tabs__tab-label">{{ tab.label }}</div>
            <div v-if="tab.hint && !conciseCopy" class="page-section-tabs__tab-hint">{{ tab.hint }}</div>
          </button>
        </div>
      </div>

      <div
        v-if="currentTab?.description && !conciseCopy"
        class="page-section-tabs__active-desc"
      >
        {{ currentTab.description }}
      </div>

      <slot />
    </div>
  </section>
</template>

<style scoped>
.page-section-tabs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 0;
}

.page-section-tabs__meta {
  padding: 0 2px 6px;
  border-bottom: 1px solid rgba(220, 227, 236, 0.92);
}

.dark .page-section-tabs__meta {
  border-bottom-color: rgba(51, 65, 85, 0.78);
}

.page-section-tabs__breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #909399;
}

.dark .page-section-tabs__breadcrumb {
  color: #94a3b8;
}

.page-section-tabs__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #cbd5e1;
}

.dark .page-section-tabs__dot {
  background: #475569;
}

.page-section-tabs__title {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.dark .page-section-tabs__title {
  color: #f8fafc;
}

.page-section-tabs__desc {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.7;
  color: #64748b;
}

.dark .page-section-tabs__desc {
  color: #94a3b8;
}

.page-section-tabs__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-section-tabs__tab-list {
  display: flex;
  min-width: max-content;
  gap: 8px;
  padding-bottom: 2px;
}

.page-section-tabs__tab {
  min-width: 104px;
  border-radius: 4px;
  border: 1px solid rgba(220, 227, 236, 0.92);
  padding: 9px 14px;
  text-align: left;
  transition: all 0.2s ease;
}

.page-section-tabs__tab--active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  color: #303133;
}

.page-section-tabs__tab--idle {
  background: #fff;
  color: #606266;
}

.page-section-tabs__tab--idle:hover {
  border-color: rgba(64, 158, 255, 0.64);
  color: #303133;
}

.dark .page-section-tabs__tab {
  border-color: rgba(51, 65, 85, 0.88);
}

.dark .page-section-tabs__tab--active {
  border-color: rgba(96, 165, 250, 0.6);
  background: rgba(30, 41, 59, 0.92);
  color: #eff6ff;
}

.dark .page-section-tabs__tab--idle {
  color: #cbd5e1;
}

.dark .page-section-tabs__tab--idle:hover {
  border-color: rgba(148, 163, 184, 0.72);
  color: #f8fafc;
}

.page-section-tabs__tab-label {
  font-size: 13px;
  font-weight: 600;
}

.page-section-tabs__tab-hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.72;
}

.page-section-tabs__active-desc {
  font-size: 14px;
  line-height: 1.8;
  color: #475569;
}

.dark .page-section-tabs__active-desc {
  color: #cbd5e1;
}
</style>
