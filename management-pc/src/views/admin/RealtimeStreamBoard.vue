<template>
  <div class="page-stack stream-page stream-page--aligned analytics-ui-page analytics-page-shell" v-loading="loading">
    <AnalyticsPageHero
      kicker="实时数据"
      title="实时看板"
      summary="看热榜、KPI、样本用户和画像快照。"
      :meta="overview.status?.redisHotLastUpdate ? `最后刷新 ${formatDateTime(overview.status?.redisHotLastUpdate)}` : '等待实时数据同步'"
      :chips="['热榜', '推荐 KPI', '样本用户', '画像快照']"
      :highlights="streamHeroHighlights"
    >
      <template #actions>
        <el-button type="primary" @click="refreshAll">刷新</el-button>
        <el-button @click="goTo('/admin/recommend/preview')">推荐预览</el-button>
      </template>
    </AnalyticsPageHero>

    <section class="analytics-metric-strip">
      <article v-for="item in heroMetrics" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <section v-if="recommendationKpiReady" class="analytics-panel stream-kpi-panel">
      <div class="stream-kpi-panel__head">
        <div>
          <div class="stream-page__kicker">推荐指标</div>
          <h3 class="stream-kpi-panel__title">推荐实时指标</h3>
        </div>
        <div class="stream-kpi-panel__meta">
          统计日期 {{ recommendationKpi.statDate || '--' }} · 刷新 {{ formatDateTime(recommendationKpi.lastUpdate) }}
        </div>
      </div>

      <div class="stream-kpi-grid">
        <article v-for="item in recommendationKpiCards" :key="item.label" class="stream-kpi-card">
          <span class="stream-kpi-card__label">{{ item.label }}</span>
          <strong class="stream-kpi-card__value">{{ item.value }}</strong>
          <span class="stream-kpi-card__sub">{{ item.sub }}</span>
        </article>
      </div>

      <div class="stream-kpi-counts">
        <div v-for="item in recommendationCountRows" :key="item.label" class="stream-kpi-count">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1fr]">
      <GlassCard title="热榜" class="stream-shell-card">
        <template #header>
          <div class="stream-toggle">
            <button
              v-for="item in hotWindowOptions"
              :key="item.value"
              type="button"
              class="stream-toggle__item"
              :class="{ 'is-active': hotWindow === item.value }"
              @click="hotWindow = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </template>

        <div class="space-y-5">
          <div ref="hotChartRef" class="h-72 w-full"></div>

          <div class="stream-hot-list">
            <button
              v-for="item in visibleHotProducts"
              :key="`${hotWindow}-${item.productId}`"
              type="button"
              class="stream-hot-item"
            >
              <div class="stream-hot-item__rank">{{ item.rank }}</div>
              <img
                v-if="item.productImage"
                :src="item.productImage"
                :alt="item.productName || `商品${item.productId}`"
                class="stream-hot-item__image"
              />
              <div v-else class="stream-hot-item__image stream-hot-item__image--placeholder">
                {{ String(item.productName || item.productId || '--').slice(0, 2) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {{ item.productName || `商品 #${item.productId}` }}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{{ item.categoryName || '未分类' }}</span>
                  <span>¥{{ formatPrice(item.price) }}</span>
                  <span>销量 {{ formatNumber(item.salesCount) }}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ formatDecimal(item.score) }}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">热度分</div>
              </div>
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="当前用户画像" class="stream-shell-card">
        <div v-if="selectedSnapshot.user" class="space-y-5">
          <div class="stream-user-spotlight">
            <div class="flex items-center gap-4">
              <el-avatar :size="48" class="stream-user-spotlight__avatar">{{ getUserInitial(selectedSnapshot.user) }}</el-avatar>
              <div>
                <div class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {{ selectedSnapshot.user.nickname || selectedSnapshot.user.username || `用户 #${selectedSnapshot.user.id}` }}
                </div>
                <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">刷新 {{ formatDateTime(selectedSnapshot.lastUpdate) }}</div>
              </div>
            </div>

            <div class="stream-user-spotlight__facts">
              <div class="fact"><span>行为总量</span><strong>{{ formatNumber(totalBehaviorCount) }}</strong></div>
              <div class="fact"><span>偏好类目</span><strong>{{ selectedSnapshot.categoryWeights?.length || 0 }}</strong></div>
              <div class="fact"><span>实时标签</span><strong>{{ selectedSnapshot.tags?.length || 0 }}</strong></div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1.02fr_1fr]">
            <div class="panel-card--muted p-4">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">行为分布</div>
              <div ref="behaviorChartRef" class="mt-3 h-72 w-full"></div>
            </div>
            <div class="panel-card--muted p-4">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">类目权重</div>
              <div ref="categoryChartRef" class="mt-3 h-72 w-full"></div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="panel-card--muted p-4">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">用户标签</div>
              <div class="mt-3 flex flex-wrap gap-2">
                <el-tag v-for="tag in visibleSnapshotTags" :key="tag" effect="light" round>{{ tag }}</el-tag>
                <span v-if="!visibleSnapshotTags.length" class="text-sm text-slate-500 dark:text-slate-400">暂无标签</span>
              </div>
            </div>

            <div class="panel-card--muted p-4">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">高权重类目</div>
              <div class="mt-3 space-y-3">
                <div v-for="item in visibleTopCategories" :key="item.categoryName" class="stream-score-row">
                  <div class="flex items-center justify-between gap-3">
                    <span class="truncate text-sm text-slate-700 dark:text-slate-200">{{ item.categoryName }}</span>
                    <span class="text-xs text-slate-500 dark:text-slate-400">{{ formatDecimal(item.weight) }}</span>
                  </div>
                  <div class="stream-score-bar"><div class="stream-score-bar__fill" :style="{ width: `${item.ratio}%` }"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无实时画像样本" />
      </GlassCard>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <GlassCard title="样本用户" class="stream-shell-card">
        <div class="stream-sample-grid">
          <button
            v-for="item in visibleSampleUsers"
            :key="item.user?.id"
            type="button"
            class="stream-sample-card"
            :class="{ 'is-active': selectedUserId === item.user?.id }"
            @click="selectUser(item.user?.id)"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {{ item.user?.nickname || item.user?.username || `用户 #${item.user?.id}` }}
                </div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ formatDateTime(item.lastUpdate) }}</div>
              </div>
              <el-tag effect="plain">行为 {{ formatNumber(item.behaviorEventCount) }}</el-tag>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="tag in getUserTagPreview(item)" :key="tag" class="stream-mini-tag">{{ tag }}</span>
            </div>
            <div class="mt-4 text-xs text-slate-500 dark:text-slate-400">头部类目：{{ item.topCategory || '暂无' }}</div>
          </button>
        </div>
      </GlassCard>

      <GlassCard title="运行状态" class="stream-shell-card">
        <div class="space-y-4">
          <div class="stream-status-grid">
            <div class="stream-status-grid__item">
              <div class="label">实时画像</div>
              <div class="value">{{ overview.status?.realtimeEnabled ? '已开启' : '未开启' }}</div>
            </div>
            <div class="stream-status-grid__item">
              <div class="label">Kafka 消费</div>
              <div class="value">{{ overview.status?.kafkaConsumerEnabled ? '已接入' : '未开启' }}</div>
            </div>
            <div class="stream-status-grid__item">
              <div class="label">消费组</div>
              <div class="value">{{ overview.status?.consumerGroupId || '--' }}</div>
            </div>
            <div class="stream-status-grid__item">
              <div class="label">最后刷新</div>
              <div class="value">{{ formatDateTime(overview.status?.redisHotLastUpdate) }}</div>
            </div>
          </div>

          <div class="panel-card--muted p-4">
            <div class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">监控摘要</div>
            <div class="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div class="stream-kv-row">
                <span class="stream-kv-row__topic">监控状态</span>
                <span class="stream-kv-row__metric">{{ monitorData.available ? '在线' : '离线' }}</span>
              </div>
              <div class="stream-kv-row">
                <span class="stream-kv-row__topic">消费积压</span>
                <span class="stream-kv-row__metric">{{ formatNumber(monitorData.consumerLag?.totalLag || 0) }}</span>
              </div>
              <div class="stream-kv-row">
                <span class="stream-kv-row__topic">监控刷新</span>
                <span class="stream-kv-row__metric">{{ formatDateTime(monitorData.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <div class="panel-card--muted p-4">
            <div class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">消费积压 Top</div>
            <div class="space-y-2">
              <div v-for="item in visibleLagTopics" :key="item.topic" class="stream-kv-row">
                <span class="stream-kv-row__topic">{{ item.topic }}</span>
                <span class="stream-kv-row__metric">{{ formatNumber(item.lag) }}</span>
              </div>
              <div v-if="!lagTopics.length" class="text-xs text-slate-500 dark:text-slate-400">暂无积压数据</div>
            </div>
          </div>
          <div class="panel-card--muted p-4">
            <div class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">处理阶段</div>
            <div class="stream-page__pipeline">
              <span v-for="step in pipelineSteps" :key="step.name" class="stream-chip" :class="`is-${step.status}`">
                {{ step.name }}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getAdminStreamOverview, getAdminStreamUserSnapshot } from '../../api/admin'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import GlassCard from '../../components/GlassCard.vue'
import { subscribeRealtime } from '../../utils/realtime'
import { getAnalyticsChartTheme } from '../../utils/chartTheme'

const router = useRouter()
const loading = ref(false)
const overview = ref({})
const selectedSnapshot = ref({})
const selectedUserId = ref(null)
const hotWindow = ref('1h')
const compactMode = ref(false)
const hotChartRef = ref(null)
const behaviorChartRef = ref(null)
const categoryChartRef = ref(null)

let hotChart = null
let behaviorChart = null
let categoryChart = null
let themeObserver = null
let unsubscribeStreamRealtime = null
let refreshPromise = null
let compactQuery = null

const hotWindowOptions = [{ label: '近 1 分钟', value: '1m' }, { label: '近 1 小时', value: '1h' }, { label: '近 1 天', value: '1d' }]
const pipelineSteps = computed(() => overview.value.pipeline || [])
const sampleUsers = computed(() => overview.value.sampleUsers || [])
const monitorData = computed(() => overview.value.monitor || {})
const lagTopics = computed(() => monitorData.value.consumerLag?.topics || [])
const recommendationKpi = computed(() => overview.value.recommendationKpi || {})
const recommendationMetrics = computed(() => recommendationKpi.value.metrics || {})
const recommendationCounts = computed(() => recommendationKpi.value.counts || {})
const currentHotProducts = computed(() => {
  if (hotWindow.value === '1m') return overview.value.hotProducts1m || []
  if (hotWindow.value === '1d') return overview.value.hotProducts1d || []
  return overview.value.hotProducts1h || []
})
const visibleHotProducts = computed(() => (compactMode.value ? currentHotProducts.value.slice(0, 5) : currentHotProducts.value))
const visibleLagTopics = computed(() => (compactMode.value ? lagTopics.value.slice(0, 3) : lagTopics.value.slice(0, 4)))
const visibleSampleUsers = computed(() => (compactMode.value ? sampleUsers.value.slice(0, 4) : sampleUsers.value))
const visibleSnapshotTags = computed(() => {
  const tags = selectedSnapshot.value.tags || []
  return compactMode.value ? tags.slice(0, 6) : tags
})
const heroMetrics = computed(() => [
  { label: '分钟榜商品', value: formatNumber(overview.value.metrics?.hotProducts1m || 0), sub: '1 分钟热榜数' },
  { label: '小时榜商品', value: formatNumber(overview.value.metrics?.hotProducts1h || 0), sub: '1 小时热榜数' },
  { label: '在线画像样本', value: formatNumber(overview.value.metrics?.sampleUsers || 0), sub: '实时画像数' },
  { label: '消费积压', value: formatNumber(monitorData.value.consumerLag?.totalLag || 0), sub: monitorData.value.available ? '当前监控口径' : '监控离线' },
])
const streamHeroHighlights = computed(() => [
  {
    label: '分钟榜商品',
    value: formatNumber(overview.value.metrics?.hotProducts1m || 0),
    note: '1 分钟窗口内的实时热度商品数。',
  },
  {
    label: '在线画像样本',
    value: formatNumber(overview.value.metrics?.sampleUsers || 0),
    note: `当前选中样本 ${selectedUserId.value || '--'}`,
  },
  {
    label: '实时链路',
    value: overview.value.status?.realtimeEnabled ? '已开启' : '未开启',
    note: overview.value.status?.kafkaConsumerEnabled ? 'Kafka 消费中' : '当前未启用 Kafka 消费',
    tone: overview.value.status?.realtimeEnabled ? 'success' : 'warning',
  },
  {
    label: '消费积压',
    value: formatNumber(monitorData.value.consumerLag?.totalLag || 0),
    note: monitorData.value.available ? '来自监控汇总口径' : '监控离线，等待恢复',
    tone: Number(monitorData.value.consumerLag?.totalLag || 0) > 0 ? 'warning' : 'success',
  },
])
const recommendationKpiReady = computed(() => {
  return Object.keys(recommendationMetrics.value).length > 0 || Object.keys(recommendationCounts.value).length > 0
})
const recommendationKpiCards = computed(() => [
  {
    label: 'CTR',
    value: formatPercent(recommendationMetrics.value.CTR),
    sub: `${formatNumber(recommendationCounts.value.clickCount)} 点击 / ${formatNumber(recommendationCounts.value.exposureCount)} 曝光`,
  },
  {
    label: 'CVR',
    value: formatPercent(recommendationMetrics.value.CVR),
    sub: `${formatNumber(recommendationCounts.value.orderCount)} 下单 / ${formatNumber(recommendationCounts.value.clickCount)} 点击`,
  },
  {
    label: 'GMV',
    value: formatCurrency(recommendationMetrics.value.GMV),
    sub: '推荐链路成交额',
  },
  {
    label: 'AOV',
    value: formatCurrency(recommendationMetrics.value.AOV),
    sub: '平均客单价',
  },
  {
    label: '7 日留存',
    value: formatPercent(recommendationMetrics.value.Retention7d),
    sub: '近 7 日留存',
  },
  {
    label: '退款率',
    value: formatPercent(recommendationMetrics.value.RefundRate),
    sub: `${formatNumber(recommendationCounts.value.refundCount)} 退款 / ${formatNumber(recommendationCounts.value.orderCount)} 下单`,
  },
])
const recommendationCountRows = computed(() => [
  { label: '曝光', value: formatNumber(recommendationCounts.value.exposureCount) },
  { label: '点击', value: formatNumber(recommendationCounts.value.clickCount) },
  { label: '下单', value: formatNumber(recommendationCounts.value.orderCount) },
  { label: '退款', value: formatNumber(recommendationCounts.value.refundCount) },
])
const totalBehaviorCount = computed(() => (selectedSnapshot.value.behaviorDistribution || []).reduce((sum, item) => sum + Number(item.count || 0), 0))
const topCategories = computed(() => {
  const rows = selectedSnapshot.value.categoryWeights || []
  if (!rows.length) return []
  const max = Math.max(...rows.map(item => Number(item.weight || 0)), 1)
  return rows.map(item => ({ ...item, ratio: Math.max(12, Math.round((Number(item.weight || 0) / max) * 100)) }))
})
const visibleTopCategories = computed(() => (compactMode.value ? topCategories.value.slice(0, 4) : topCategories.value.slice(0, 6)))

function syncCompactMode() {
  compactMode.value = compactQuery?.matches || false
}

function getUserTagPreview(item) {
  const tags = item?.tags || []
  return compactMode.value ? tags.slice(0, 3) : tags.slice(0, 4)
}

function formatNumber(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isNaN(number) ? '--' : number.toLocaleString('zh-CN')
}

function formatPrice(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isNaN(number) ? '--' : number.toFixed(2)
}

function formatDecimal(value, digits = 1) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isNaN(number) ? '--' : number.toFixed(digits)
}

function formatPercent(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isNaN(number) ? '--' : `${number.toFixed(2)}%`
}

function formatCurrency(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isNaN(number)
    ? '--'
    : `¥${number.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function getUserInitial(user) {
  const name = user?.nickname || user?.username || 'U'
  return String(name).slice(0, 1).toUpperCase()
}

function goTo(path) {
  if (router.currentRoute.value.path !== path) router.push(path)
}

async function refreshAll(options) {
  const silent = Boolean(options && options.silent)
  if (refreshPromise) {
    return refreshPromise
  }

  if (!silent) {
    loading.value = true
  }

  refreshPromise = (async () => {
    overview.value = (await getAdminStreamOverview({ hotLimit: 8, userLimit: 6 })) || {}
    const candidates = overview.value.sampleUsers || []
    if (candidates.length) {
      const nextUserId = selectedUserId.value && candidates.some(item => item.user?.id === selectedUserId.value)
        ? selectedUserId.value
        : candidates[0].user?.id
      await selectUser(nextUserId, false)
    } else {
      selectedUserId.value = null
      selectedSnapshot.value = {}
    }
    await nextTick()
    renderCharts()
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
    if (!silent) {
      loading.value = false
    }
  }
}

async function selectUser(userId, shouldRender = true) {
  if (!userId) {
    selectedUserId.value = null
    selectedSnapshot.value = {}
    return
  }
  selectedUserId.value = userId
  selectedSnapshot.value = (await getAdminStreamUserSnapshot(userId)) || {}
  if (shouldRender) {
    await nextTick()
    renderCharts()
  }
}

function renderCharts() {
  const theme = getAnalyticsChartTheme()
  const { textColor, splitLineColor, axisColor, surfaceColor, palette } = theme
  const axisLine = { lineStyle: { color: axisColor } }

  hotChart?.dispose()
  behaviorChart?.dispose()
  categoryChart?.dispose()

  if (hotChartRef.value) {
    hotChart = echarts.init(hotChartRef.value)
    const hotRows = visibleHotProducts.value.slice().reverse()
    hotChart.setOption({
      animationDuration: 520,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '3%', top: 16, bottom: 24, containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }, axisLabel: { color: textColor } },
      yAxis: { type: 'category', axisLabel: { color: textColor, width: 96, overflow: 'truncate' }, axisLine, data: hotRows.map(item => item.productName || `#${item.productId}`) },
      series: [{
        type: 'bar',
        barWidth: 16,
        data: hotRows.map(item => Number(item.score || 0)),
        itemStyle: {
          borderRadius: [0, 10, 10, 0],
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: palette.primary },
            { offset: 1, color: palette.secondary },
          ]),
        },
      }],
    })
  }

  if (behaviorChartRef.value) {
    const rows = selectedSnapshot.value.behaviorDistribution || []
    const behaviorColors = [palette.primary, palette.secondary, palette.success, palette.warning, palette.accent, palette.danger]
    behaviorChart = echarts.init(behaviorChartRef.value)
    behaviorChart.setOption({
      animationDuration: 520,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: textColor } },
      series: [{
        type: 'pie',
        radius: ['48%', '74%'],
        center: ['50%', '42%'],
        itemStyle: { borderRadius: 10, borderColor: surfaceColor, borderWidth: 3 },
        label: { formatter: '{b}\n{d}%', color: textColor, fontSize: 11 },
        data: rows.length
          ? rows.map((item, index) => ({
              name: item.behaviorType,
              value: Number(item.count || 0),
              itemStyle: { color: behaviorColors[index % behaviorColors.length] },
            }))
          : [{ name: '暂无数据', value: 1, itemStyle: { color: axisColor } }],
      }],
    })
  }

  if (categoryChartRef.value) {
    const rows = (selectedSnapshot.value.categoryWeights || []).slice(0, 6)
    categoryChart = echarts.init(categoryChartRef.value)
    categoryChart.setOption({
      animationDuration: 520,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '4%', right: '4%', top: 12, bottom: 24, containLabel: true },
      xAxis: { type: 'category', axisLabel: { color: textColor, interval: 0, rotate: 20 }, axisLine, data: rows.map(item => item.categoryName) },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }, axisLabel: { color: textColor } },
      series: [{
        type: 'bar',
        barWidth: 24,
        data: rows.map(item => Number(item.weight || 0)),
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: palette.secondary },
            { offset: 1, color: palette.primary },
          ]),
        },
      }],
    })
  }
}

watch(hotWindow, async () => {
  await nextTick()
  renderCharts()
})

watch(compactMode, async () => {
  await nextTick()
  renderCharts()
})

onMounted(async () => {
  compactQuery = window.matchMedia('(max-width: 768px)')
  compactQuery.addEventListener('change', syncCompactMode)
  syncCompactMode()
  await refreshAll()
  unsubscribeStreamRealtime = subscribeRealtime('/topic/admin/stream/refresh', () => {
    refreshAll({ silent: true })
  })
  window.addEventListener('resize', renderCharts)
  themeObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.attributeName === 'class')) nextTick(() => renderCharts())
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  if (compactQuery) {
    compactQuery.removeEventListener('change', syncCompactMode)
  }
  if (typeof unsubscribeStreamRealtime === 'function') {
    unsubscribeStreamRealtime()
    unsubscribeStreamRealtime = null
  }
  window.removeEventListener('resize', renderCharts)
  themeObserver?.disconnect()
  hotChart?.dispose()
  behaviorChart?.dispose()
  categoryChart?.dispose()
})
</script>

<style scoped>
.stream-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}

.stream-page__kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #0f766e;
}

.stream-page__title {
  margin-top: 8px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0f172a;
}

html.dark .stream-page__title { color: #f1f5f9; }

.stream-page__summary {
  margin-top: 10px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
}

html.dark .stream-page__summary { color: #cbd5e1; }

.stream-page__pipeline {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stream-page__header-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  flex-shrink: 0;
}

.stream-kpi-panel {
  padding: 22px;
}

.stream-kpi-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.stream-kpi-panel__title {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.stream-kpi-panel__meta {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.stream-kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.stream-kpi-card,
.stream-kpi-count {
  border: 1px solid var(--stream-border);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
}

.stream-kpi-card {
  padding: 16px;
}

.stream-kpi-card__label,
.stream-kpi-count span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.stream-kpi-card__value,
.stream-kpi-count strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 22px;
  font-weight: 800;
}

.stream-kpi-card__sub {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.stream-kpi-counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.stream-kpi-count {
  padding: 14px 16px;
}

.stream-page--aligned {
  --stream-border: rgba(148, 163, 184, 0.22);
  --stream-soft-bg: rgba(248, 250, 252, 0.92);
}

.stream-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stream-hot-item,
.stream-sample-card,
.stream-user-spotlight {
  border: 1px solid var(--stream-border);
  background: rgba(255, 255, 255, 0.76);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}
.stream-hot-item:hover,
.stream-sample-card:hover,
.stream-sample-card.is-active {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  border-color: rgba(96, 165, 250, 0.35);
}

.stream-chip,
.stream-toggle__item,
.stream-mini-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
}

.stream-chip {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--stream-border);
  background: rgba(255, 255, 255, 0.78);
  color: #334155;
}

.stream-chip.is-active {
  color: #0f766e;
  background: rgba(240, 253, 250, 0.92);
  border-color: rgba(45, 212, 191, 0.4);
}

.stream-chip.is-ready {
  color: #0369a1;
  background: rgba(240, 249, 255, 0.92);
  border-color: rgba(125, 211, 252, 0.45);
}

.stream-chip.is-idle {
  color: #92400e;
  background: rgba(255, 251, 235, 0.92);
  border-color: rgba(252, 211, 77, 0.45);
}

.stream-toggle__item {
  padding: 8px 12px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: rgba(255, 255, 255, 0.76);
  font-size: 12px;
  color: #475569;
  transition: all 180ms ease;
}

.stream-toggle__item.is-active {
  border-color: rgba(59, 130, 246, 0.45);
  background: rgba(239, 248, 255, 0.98);
  color: #0369a1;
  box-shadow: 0 10px 22px rgba(59, 130, 246, 0.14);
}

.stream-hot-list,
.stream-sample-grid {
  display: grid;
  gap: 12px;
}

.stream-hot-item {
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: 18px;
  padding: 12px 14px;
}

.stream-hot-item__rank {
  width: 30px;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
}

.stream-hot-item__image {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid var(--stream-border);
  background: #fff;
}

.stream-hot-item__image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #0f766e;
  background: linear-gradient(135deg, rgba(204, 251, 241, 0.9), rgba(236, 253, 245, 0.9));
}

.stream-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stream-status-grid__item,
.stream-user-spotlight__facts .fact {
  border-radius: 16px;
  padding: 14px;
  background: rgba(248, 250, 252, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.stream-status-grid__item .label,
.stream-user-spotlight__facts .fact span {
  font-size: 12px;
  color: #64748b;
}

.stream-status-grid__item .value,
.stream-user-spotlight__facts .fact strong {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.stream-kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid var(--stream-border);
}

.stream-kv-row__topic {
  max-width: 72%;
  font-size: 12px;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stream-kv-row__metric {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.stream-user-spotlight {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 22px;
  padding: 18px;
}

.stream-user-spotlight__avatar {
  background: linear-gradient(135deg, #4fa9ff, #b8e1ff);
  color: #fff;
}

.stream-user-spotlight__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stream-score-row + .stream-score-row {
  margin-top: 12px;
}

.stream-score-bar {
  height: 8px;
  margin-top: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.24);
  overflow: hidden;
}

.stream-score-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7cc6ff, #4fa9ff);
  transition: width 360ms ease-in-out;
}

.stream-sample-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stream-sample-card {
  border-radius: 20px;
  padding: 16px;
  text-align: left;
}

.stream-mini-tag {
  padding: 5px 8px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(240, 249, 255, 0.98);
  color: #0c4a6e;
  font-size: 12px;
}

:deep(.stream-shell-card > header) {
  border-bottom-color: rgba(148, 163, 184, 0.24) !important;
}

:deep(.stream-shell-card .panel-card--muted) {
  border-color: rgba(148, 163, 184, 0.22);
  background: var(--stream-soft-bg);
}

.dark .stream-hot-item__rank,
.dark .stream-kpi-panel__title,
.dark .stream-kpi-card__value,
.dark .stream-kpi-count strong,
.dark .stream-status-grid__item .value,
.dark .stream-user-spotlight__facts .fact strong {
  color: #e5edf7;
}

.dark .stream-toggle__item,
.dark .stream-kpi-panel__meta,
.dark .stream-kpi-card__label,
.dark .stream-kpi-card__sub,
.dark .stream-kpi-count span,
.dark .stream-status-grid__item .label,
.dark .stream-user-spotlight__facts .fact span {
  color: #94a3b8;
}

.dark .stream-kpi-card,
.dark .stream-kpi-count,
.dark .stream-hot-item,
.dark .stream-sample-card,
.dark .stream-user-spotlight {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(71, 85, 105, 0.58);
}

.dark .stream-status-grid__item,
.dark .stream-user-spotlight__facts .fact {
  background: rgba(17, 24, 39, 0.94);
  border-color: rgba(71, 85, 105, 0.62);
}

.dark .stream-kv-row {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(71, 85, 105, 0.72);
}

.dark .stream-kv-row__topic {
  color: #cbd5e1;
}

.dark .stream-kv-row__metric {
  color: #e5edf7;
}

.dark .stream-toggle__item.is-active {
  background: rgba(15, 23, 42, 0.9);
  color: #bae6fd;
}

.dark .stream-mini-tag {
  border-color: rgba(71, 85, 105, 0.64);
  background: rgba(15, 23, 42, 0.64);
  color: #bae6fd;
}

@media (max-width: 1024px) {
  .stream-kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .stream-sample-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stream-user-spotlight {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .stream-kpi-panel__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .stream-kpi-grid,
  .stream-kpi-counts,
  .stream-status-grid,
  .stream-sample-grid {
    grid-template-columns: 1fr;
  }
}
</style>
