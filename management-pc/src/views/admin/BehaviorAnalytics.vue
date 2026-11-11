<template>
  <div v-loading="loading" class="space-y-6 analytics-ui-page analytics-page-shell behavior-compact-page">
    <AnalyticsPageHero
      kicker="用户行为"
      title="行为分析"
      summary="看行为结构、搜索承接和转化。"
      :meta="behaviorHeadMeta"
      :chips="['行为结构', '搜索趋势', '转化承接', '证据明细']"
      :highlights="behaviorHeroHighlights"
    />

    <section class="analytics-metric-strip">
      <article v-for="item in behaviorSummaryCards" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <PageSectionTabs
      v-model="behaviorActiveTab"
      primary-label="管理端"
      page-label="行为分析"
      title="行为视图"
      description=""
      :tabs="behaviorTabs"
      :active-label="behaviorActiveTabInfo.label"
    />

    <div v-if="behaviorActiveTab === 'overview'" class="behavior-overview-grid">
      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">行为结构</div>
            <h3 class="behavior-panel__title">主行为强弱分布</h3>
          </div>
          <div class="behavior-panel__note">{{ topBehaviorText }}</div>
        </div>
        <div class="behavior-chart-stage">
          <div v-if="behaviorRows.length" ref="barChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无行为分布数据" :image-size="84" />
        </div>
        <div class="behavior-kpi-row">
          <article v-for="item in behaviorKpiCards" :key="item.label" class="behavior-kpi-chip">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
      </section>

      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">重点</div>
            <h3 class="behavior-panel__title">当前重点</h3>
          </div>
          <div class="behavior-panel__note">依据、数据、结论。</div>
        </div>
        <div class="behavior-focus-list">
          <article v-for="item in behaviorFocusRows" :key="item.label" class="behavior-focus-item">
            <span class="behavior-focus-item__label">{{ item.label }}</span>
            <strong class="behavior-focus-item__value">{{ item.value }}</strong>
            <p class="behavior-focus-item__text">{{ item.note }}</p>
          </article>
        </div>
      </section>

      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">占比</div>
            <h3 class="behavior-panel__title">行为占比结构</h3>
          </div>
          <div class="behavior-panel__note">{{ behaviorRows.length }} 类行为</div>
        </div>
        <div class="behavior-pie-stage">
          <div v-if="behaviorRows.length" ref="pieChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无行为占比数据" :image-size="84" />
        </div>
      </section>

      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">搜索</div>
            <h3 class="behavior-panel__title">搜索承接快照</h3>
          </div>
          <div class="behavior-panel__note">{{ searchLeadSummary }}</div>
        </div>
        <div class="behavior-search-snapshot-grid">
          <article v-for="item in overviewSearchCards" :key="item.label" class="behavior-snapshot-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <p>{{ item.sub }}</p>
          </article>
        </div>
      </section>
    </div>

    <div v-else-if="behaviorActiveTab === 'structure'" class="behavior-structure-grid">
      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">结构</div>
            <h3 class="behavior-panel__title">行为分布对比</h3>
          </div>
          <div class="behavior-panel__note">先看总量，再看强弱差。</div>
        </div>
        <div class="behavior-chart-stage">
          <div v-if="behaviorRows.length" ref="barChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无行为分布数据" :image-size="84" />
        </div>
      </section>

      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">占比</div>
            <h3 class="behavior-panel__title">占比与集中度</h3>
          </div>
          <div class="behavior-panel__note">{{ topBehaviorInsight }}</div>
        </div>
        <div class="behavior-structure-summary-grid">
          <article v-for="item in structureSummaryCards" :key="item.label" class="behavior-summary-tile">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <p>{{ item.sub }}</p>
          </article>
        </div>
        <div class="behavior-pie-stage behavior-pie-stage--compact">
          <div v-if="behaviorRows.length" ref="pieChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无行为占比数据" :image-size="72" />
        </div>
      </section>

      <section class="analytics-panel behavior-panel behavior-table-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">明细</div>
            <h3 class="behavior-panel__title">行为明细</h3>
          </div>
          <div class="behavior-panel__note">直接看次数、用户数、占比。</div>
        </div>
        <el-table
          :data="tableRows"
          class="!mt-4 !bg-transparent"
          :header-cell-style="{ background: 'transparent', color: 'inherit' }"
          :row-style="{ background: 'transparent' }"
        >
          <el-table-column prop="label" label="行为类型" min-width="180" />
          <el-table-column prop="count" label="行为次数" width="160" />
          <el-table-column prop="userCount" label="参与用户数" width="160" />
          <el-table-column prop="share" label="行为占比" width="140" />
        </el-table>
      </section>
    </div>

    <div v-else-if="behaviorActiveTab === 'search'" class="space-y-6">
      <section class="analytics-metric-strip behavior-search-strip">
        <article v-for="item in searchSummaryCards" :key="item.label" class="analytics-metric-strip__item">
          <span class="analytics-metric-strip__label">{{ item.label }}</span>
          <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
          <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
        </article>
      </section>

      <div class="behavior-search-grid">
        <section class="analytics-panel behavior-panel">
          <div class="behavior-panel__head">
            <div>
              <div class="analytics-panel__eyebrow">搜索趋势</div>
              <h3 class="behavior-panel__title">搜索趋势与纠错命中</h3>
            </div>
            <div class="behavior-panel__note">近 {{ searchAnalytics.days || 14 }} 天</div>
          </div>
          <div class="behavior-chart-stage">
            <div v-if="searchTrendRows.length" ref="searchTrendChartRef" class="h-full w-full"></div>
            <el-empty v-else description="暂无搜索趋势数据" :image-size="84" />
          </div>
        </section>

        <section class="analytics-panel behavior-panel">
          <div class="behavior-panel__head">
            <div>
              <div class="analytics-panel__eyebrow">关键词</div>
              <h3 class="behavior-panel__title">Top 搜索词</h3>
            </div>
            <div class="behavior-panel__note">{{ topKeywordText }}</div>
          </div>
          <div class="behavior-chart-stage">
            <div v-if="searchTopKeywords.length" ref="searchKeywordChartRef" class="h-full w-full"></div>
            <el-empty v-else description="暂无关键词排行" :image-size="84" />
          </div>
        </section>
      </div>

      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">关键词明细</div>
            <h3 class="behavior-panel__title">搜索词明细</h3>
          </div>
          <div class="behavior-panel__note">关键词直接反映显性意图。</div>
        </div>
        <div class="behavior-keyword-chip-row">
          <span v-for="item in searchTopKeywords.slice(0, 6)" :key="item.keyword" class="behavior-keyword-chip">
            {{ item.keyword }} · {{ formatNumber(item.totalCount) }}
          </span>
        </div>
        <el-table
          :data="searchTopKeywords"
          class="!mt-5 !bg-transparent"
          :header-cell-style="{ background: 'transparent', color: 'inherit' }"
          :row-style="{ background: 'transparent' }"
        >
          <el-table-column type="index" label="排名" width="90" />
          <el-table-column prop="keyword" label="关键词" min-width="220" />
          <el-table-column prop="totalCount" label="搜索次数" width="160">
            <template #default="{ row }">{{ formatNumber(row.totalCount) }}</template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <div v-else class="behavior-details-grid">
      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">明细表</div>
            <h3 class="behavior-panel__title">行为证据明细</h3>
          </div>
          <div class="behavior-panel__note">{{ behaviorRows.length }} 类行为</div>
        </div>
        <el-table
          :data="tableRows"
          class="!mt-4 !bg-transparent"
          :header-cell-style="{ background: 'transparent', color: 'inherit' }"
          :row-style="{ background: 'transparent' }"
        >
          <el-table-column prop="label" label="行为类型" min-width="180" />
          <el-table-column prop="count" label="行为次数" width="160" />
          <el-table-column prop="userCount" label="参与用户数" width="160" />
          <el-table-column prop="share" label="行为占比" width="140" />
        </el-table>
      </section>

      <section class="analytics-panel behavior-panel">
        <div class="behavior-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">判断</div>
            <h3 class="behavior-panel__title">简短判断</h3>
          </div>
          <div class="behavior-panel__note">不展开链路，只保留结果。</div>
        </div>
        <div class="behavior-focus-list">
          <article v-for="item in detailSummaryCards" :key="item.label" class="behavior-focus-item">
            <span class="behavior-focus-item__label">{{ item.label }}</span>
            <strong class="behavior-focus-item__value">{{ item.value }}</strong>
            <p class="behavior-focus-item__text">{{ item.note }}</p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useRoute, useRouter } from 'vue-router'
import { getAdminBehaviorAnalytics, getAdminSearchBehaviorAnalytics } from '../../api/admin'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import PageSectionTabs from '../../components/PageSectionTabs.vue'
import { getAnalyticsChartTheme } from '../../utils/chartTheme'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const behaviorStats = ref([])
const searchAnalytics = ref({})

const barChartRef = ref(null)
const pieChartRef = ref(null)
const searchTrendChartRef = ref(null)
const searchKeywordChartRef = ref(null)

let charts = []
let themeObserver = null

const behaviorTypeMap = {
  view: '浏览信号',
  cart: '加购信号',
  favorite: '收藏信号',
  purchase: '购买信号',
  search: '搜索信号',
}

const behaviorTabs = [
  { key: 'overview', label: '行为总览', hint: '结论', description: '主行为、转化承接和搜索快照。' },
  { key: 'structure', label: '结构拆解', hint: '分布', description: '看 count、share 和覆盖差异。' },
  { key: 'search', label: '搜索分析', hint: 'query', description: '查询量、纠错命中、点击承接。' },
  { key: 'details', label: '证据明细', hint: '表格', description: '行为次数、用户数、占比。' },
]
const behaviorTabKeySet = new Set(behaviorTabs.map(item => item.key))

function normalizeBehaviorTab(value) {
  const tab = String(value || '').trim()
  return behaviorTabKeySet.has(tab) ? tab : behaviorTabs[0].key
}

const behaviorActiveTab = ref(normalizeBehaviorTab(route.query.tab))
const behaviorActiveTabInfo = computed(() => behaviorTabs.find(item => item.key === behaviorActiveTab.value) || behaviorTabs[0])

const sortedBehaviorStats = computed(() =>
  [...behaviorStats.value].sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
)
const totalBehaviorCount = computed(() => sortedBehaviorStats.value.reduce((sum, item) => sum + Number(item.count || 0), 0))
const totalUserCoverage = computed(() => Math.max(0, ...sortedBehaviorStats.value.map(item => Number(item.user_count || 0))))
const topBehavior = computed(() => sortedBehaviorStats.value[0] || null)
const purchaseBehavior = computed(() => sortedBehaviorStats.value.find(item => item.behaviorType === 'purchase') || null)
const cartBehavior = computed(() => sortedBehaviorStats.value.find(item => item.behaviorType === 'cart') || null)
const searchBehavior = computed(() => sortedBehaviorStats.value.find(item => item.behaviorType === 'search') || null)

const topBehaviorText = computed(() => topBehavior.value?.label || topBehavior.value?.behaviorLabel || '等待行为数据')
const purchaseShare = computed(() => totalBehaviorCount.value ? Number(purchaseBehavior.value?.count || 0) / totalBehaviorCount.value : 0)
const cartToPurchaseRate = computed(() => {
  const cart = Number(cartBehavior.value?.count || 0)
  const purchase = Number(purchaseBehavior.value?.count || 0)
  return cart ? purchase / cart : 0
})
const searchShare = computed(() => totalBehaviorCount.value ? Number(searchBehavior.value?.count || 0) / totalBehaviorCount.value : 0)

const searchQuality = computed(() => searchAnalytics.value.quality || {})
const searchConversion = computed(() => searchAnalytics.value.conversion || {})
const searchTrendRows = computed(() => {
  const rows = Array.isArray(searchAnalytics.value.trend) ? searchAnalytics.value.trend : []
  return rows.map(item => ({
    date: item.date || '',
    totalQueries: Number(item.totalQueries || 0),
    correctedHits: Number(item.correctedHits || 0),
    correctionHitRate: Number(item.correctionHitRate || 0),
  }))
})
const searchTopKeywords = computed(() => {
  const rows = Array.isArray(searchAnalytics.value.topKeywords) ? searchAnalytics.value.topKeywords : []
  return rows
    .map(item => ({
      keyword: item.keyword || '',
      totalCount: Number(item.totalCount || 0),
    }))
    .filter(item => item.keyword)
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10)
})
const topKeywordText = computed(() => searchTopKeywords.value[0]?.keyword || '等待关键词')

const behaviorRows = computed(() => sortedBehaviorStats.value.map(item => {
  const shareValue = totalBehaviorCount.value ? Number(item.count || 0) / totalBehaviorCount.value : 0
  return {
    label: item.label || item.behaviorLabel,
    countRaw: Number(item.count || 0),
    userCountRaw: Number(item.user_count || 0),
    count: formatNumber(item.count),
    userCount: formatNumber(item.user_count),
    shareValue,
    share: formatPercent(shareValue),
  }
}))

const behaviorHeadMeta = computed(() => {
  if (!totalBehaviorCount.value) {
    return '这里继续拆到搜索、加购和购买承接，而不是只停留在总流量和访问人数。'
  }
  return `${topBehaviorText.value} 当前占比 ${formatPercent(topBehavior.value ? Number(topBehavior.value.count || 0) / totalBehaviorCount.value : 0)}，购买占比 ${formatPercent(purchaseShare.value)}，搜索参与度 ${formatPercent(searchShare.value)}。`
})

const behaviorSummaryCards = computed(() => [
  {
    label: '总行为量',
    value: formatNumber(totalBehaviorCount.value),
    sub: '全部行为事件',
  },
  {
    label: '峰值参与用户',
    value: formatNumber(totalUserCoverage.value),
    sub: '最高 user_count',
  },
  {
    label: '购买占比',
    value: formatPercent(purchaseShare.value),
    sub: 'purchase / all',
  },
  {
    label: '搜索参与度',
    value: formatPercent(searchShare.value),
    sub: 'search / all',
  },
])
const behaviorHeroHighlights = computed(() => [
  {
    label: '总行为量',
    value: formatNumber(totalBehaviorCount.value),
    note: '所有行为事件汇总口径。',
  },
  {
    label: '当前主行为',
    value: topBehaviorText.value,
    note: topBehavior.value ? `占比 ${formatPercent(Number(topBehavior.value.count || 0) / Math.max(totalBehaviorCount.value, 1))}` : '等待行为数据',
  },
  {
    label: '加购到购买',
    value: formatPercent(cartToPurchaseRate.value),
    note: '直接验证承接是否通畅。',
  },
  {
    label: '搜索参与度',
    value: formatPercent(searchShare.value),
    note: topKeywordText.value === '等待关键词' ? '等待搜索数据' : `Top 词 ${topKeywordText.value}`,
  },
])

const behaviorKpiCards = computed(() => [
  { label: '当前主行为', value: topBehaviorText.value },
  { label: '加购→购买', value: formatPercent(cartToPurchaseRate.value) },
  { label: '搜索占比', value: formatPercent(searchShare.value) },
  { label: '峰值用户', value: formatNumber(totalUserCoverage.value) },
])

const behaviorFocusRows = computed(() => [
  {
    label: '传统盲区',
    value: '只看 PV / UV',
    note: '很难解释哪类动作最接近真实意图，也很难给推荐排序依据。',
  },
  {
    label: '当前主行为',
    value: topBehaviorText.value,
    note: topBehavior.value
      ? `当前行为次数 ${formatNumber(topBehavior.value.count)}，是最主要的用户动作。`
      : '等待行为数据回流。',
  },
  {
    label: '转化承接',
    value: formatPercent(cartToPurchaseRate.value),
    note: `加购 ${formatNumber(cartBehavior.value?.count || 0)}，购买 ${formatNumber(purchaseBehavior.value?.count || 0)}。`,
  },
  {
    label: '搜索信号',
    value: formatPercentValue(searchConversion.value.searchToClickRate),
    note: `搜索后点击率，当前总查询 ${formatNumber(searchQuality.value.totalQueries)} 次。`,
  },
])

const overviewSearchCards = computed(() => [
  {
    label: '搜索总次数',
    value: formatNumber(searchQuality.value.totalQueries),
    sub: 'query 总量',
  },
  {
    label: '纠错命中率',
    value: formatPercentValue(searchQuality.value.correctionHitRate),
    sub: '纠错承接质量',
  },
  {
    label: '搜索后点击率',
    value: formatPercentValue(searchConversion.value.searchToClickRate),
    sub: `点击用户 ${formatNumber(searchConversion.value.searchToClickUserCount)}`,
  },
  {
    label: '搜索后购买率',
    value: formatPercentValue(searchConversion.value.searchToPurchaseRate),
    sub: `购买用户 ${formatNumber(searchConversion.value.searchToPurchaseUserCount)}`,
  },
])

const searchSummaryCards = computed(() => [
  {
    label: '搜索总次数',
    value: formatNumber(searchQuality.value.totalQueries),
    sub: 'query 总量',
  },
  {
    label: '纠错命中率',
    value: formatPercentValue(searchQuality.value.correctionHitRate),
    sub: 'correction_hit_rate',
  },
  {
    label: '搜索后点击率',
    value: formatPercentValue(searchConversion.value.searchToClickRate),
    sub: `click_user ${formatNumber(searchConversion.value.searchToClickUserCount)}`,
  },
  {
    label: '搜索后购买率',
    value: formatPercentValue(searchConversion.value.searchToPurchaseRate),
    sub: `purchase_user ${formatNumber(searchConversion.value.searchToPurchaseUserCount)}`,
  },
])

const structureSummaryCards = computed(() => [
  {
    label: '主行为',
    value: topBehaviorText.value,
    sub: topBehavior.value ? `次数 ${formatNumber(topBehavior.value.count)}` : '等待回流',
  },
  {
    label: '购买占比',
    value: formatPercent(purchaseShare.value),
    sub: '接近真实成交意图',
  },
  {
    label: '搜索参与度',
    value: formatPercent(searchShare.value),
    sub: '显性意图入口',
  },
  {
    label: '峰值用户',
    value: formatNumber(totalUserCoverage.value),
    sub: '用户覆盖上限',
  },
])

const detailSummaryCards = computed(() => [
  {
    label: '主行为判断',
    value: topBehaviorText.value,
    note: '当前最强行为适合直接作为排序和召回的高权重信号。',
  },
  {
    label: '购买承接',
    value: formatPercent(purchaseShare.value),
    note: '购买占比越高，说明行为链条越接近真实转化。',
  },
  {
    label: '搜索承接',
    value: formatPercentValue(searchConversion.value.searchToPurchaseRate),
    note: `${topKeywordText.value} 是当前最强显性意图之一。`,
  },
])

const searchLeadSummary = computed(() => {
  if (!searchQuality.value.totalQueries) return '等待搜索数据'
  return `${formatNumber(searchQuality.value.totalQueries)} 次 query`
})

const topBehaviorInsight = computed(() => {
  if (!topBehavior.value || !totalBehaviorCount.value) return '等待行为数据'
  const share = Number(topBehavior.value.count || 0) / totalBehaviorCount.value
  if (share >= 0.5) return '头部行为集中度偏高'
  if (share >= 0.35) return '头部行为较明显'
  return '行为结构相对均衡'
})

const tableRows = computed(() => behaviorRows.value.map(item => ({
  label: item.label,
  count: item.count,
  userCount: item.userCount,
  share: item.share,
})))

function formatNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '0'
}

function formatPercent(value) {
  const number = Number(value || 0)
  return `${(number * 100).toFixed(number * 100 >= 10 ? 1 : 2)}%`
}

function formatPercentValue(value) {
  const number = Number(value || 0)
  return `${number.toFixed(number >= 10 ? 1 : 2)}%`
}

const getBehaviorType = item => item.behaviorType || item.behavior_type || ''
const getBehaviorCount = item => Number(item.count || 0)

async function fetchData() {
  loading.value = true
  try {
    const [behaviorRes, searchRes] = await Promise.all([
      getAdminBehaviorAnalytics(),
      getAdminSearchBehaviorAnalytics(14).catch(() => null),
    ])

    behaviorStats.value = (behaviorRes || []).map(item => {
      const behaviorType = getBehaviorType(item)
      return {
        behaviorType,
        behaviorLabel: behaviorTypeMap[behaviorType] || behaviorType || '未知行为',
        label: behaviorTypeMap[behaviorType] || behaviorType || '未知行为',
        count: getBehaviorCount(item),
        user_count: Number(item.user_count || item.userCount || 0),
      }
    })

    searchAnalytics.value = searchRes || {
      days: 14,
      quality: {},
      trend: [],
      topKeywords: [],
      conversion: {},
    }

    await nextTick()
    renderCharts()
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  charts.forEach(chart => chart?.dispose())
  charts = []

  const theme = getAnalyticsChartTheme()
  const { textColor, splitLineColor, axisColor, surfaceColor, palette } = theme
  const colors = [palette.primary, palette.secondary, palette.warning, palette.success, palette.accent]

  if (barChartRef.value && behaviorRows.value.length) {
    const chart = echarts.init(barChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '4%', right: '4%', bottom: 52, top: 28, containLabel: true },
      xAxis: {
        type: 'category',
        data: behaviorRows.value.map(item => item.label),
        axisLabel: { color: textColor, interval: 0, margin: 14 },
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
      },
      series: [{
        type: 'bar',
        barMaxWidth: 40,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: params => colors[params.dataIndex % colors.length],
        },
        data: behaviorRows.value.map(item => item.countRaw),
      }],
    })
    charts.push(chart)
  }

  if (pieChartRef.value && behaviorRows.value.length) {
    const chart = echarts.init(pieChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 8, type: 'scroll', textStyle: { color: textColor } },
      series: [{
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '42%'],
        itemStyle: { borderRadius: 10, borderColor: surfaceColor, borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: textColor } },
        data: behaviorRows.value.map((item, index) => ({
          value: item.countRaw,
          name: item.label,
          itemStyle: { color: colors[index % colors.length] },
        })),
      }],
    })
    charts.push(chart)
  }

  if (searchTrendChartRef.value && searchTrendRows.value.length) {
    const chart = echarts.init(searchTrendChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 0, data: ['搜索总次数', '纠错命中率'], textStyle: { color: textColor } },
      grid: { left: '4%', right: '4%', bottom: 52, top: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: searchTrendRows.value.map(item => item.date),
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: [
        {
          type: 'value',
          name: '次数',
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        },
        {
          type: 'value',
          name: '命中率',
          max: 100,
          axisLabel: { color: textColor, formatter: value => `${value}%` },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '搜索总次数',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: { borderRadius: [8, 8, 0, 0], color: palette.primary },
          data: searchTrendRows.value.map(item => item.totalQueries),
        },
        {
          name: '纠错命中率',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: palette.warning },
          data: searchTrendRows.value.map(item => item.correctionHitRate),
        },
      ],
    })
    charts.push(chart)
  }

  if (searchKeywordChartRef.value && searchTopKeywords.value.length) {
    const chart = echarts.init(searchKeywordChartRef.value)
    const keywordRows = [...searchTopKeywords.value].slice(0, 8).reverse()
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '4%', right: '4%', bottom: 20, top: 20, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: keywordRows.map(item => item.keyword),
        axisLabel: { color: textColor },
      },
      series: [{
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { borderRadius: 8, color: palette.accent },
        data: keywordRows.map(item => item.totalCount),
      }],
    })
    charts.push(chart)
  }
}

function handleResize() {
  charts.forEach(chart => chart?.resize())
}

watch(
  () => route.query.tab,
  value => {
    const nextTab = normalizeBehaviorTab(value)
    if (nextTab !== behaviorActiveTab.value) {
      behaviorActiveTab.value = nextTab
    }
  }
)

watch(behaviorActiveTab, value => {
  const nextTab = normalizeBehaviorTab(value)
  const currentTab = normalizeBehaviorTab(route.query.tab)
  if (nextTab !== currentTab) {
    router.replace({
      query: {
        ...route.query,
        tab: nextTab === behaviorTabs[0].key ? undefined : nextTab,
      },
    })
  }
  nextTick(() => renderCharts())
})

onMounted(async () => {
  await fetchData()
  window.addEventListener('resize', handleResize)
  themeObserver = new MutationObserver(mutations => {
    if (mutations.some(item => item.attributeName === 'class')) {
      nextTick(() => renderCharts())
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  themeObserver?.disconnect()
  charts.forEach(chart => chart?.dispose())
})
</script>

<style scoped>
.behavior-compact-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 18px;
  align-items: end;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.behavior-compact-head__kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2563eb;
}

.behavior-compact-head__title {
  margin: 8px 0 0;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.12;
  color: #0f172a;
}

.behavior-compact-head__summary {
  margin: 10px 0 0;
  max-width: 700px;
  font-size: 14px;
  line-height: 1.75;
  color: #475569;
}

.behavior-compact-head__aside {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(239, 246, 255, 0.92));
}

.behavior-compact-head__tag {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
}

.behavior-compact-head__aside p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
}

.behavior-overview-grid,
.behavior-structure-grid,
.behavior-search-grid,
.behavior-details-grid {
  display: grid;
  gap: 16px;
}

.behavior-overview-grid,
.behavior-structure-grid,
.behavior-search-grid,
.behavior-details-grid {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.92fr);
}

.behavior-table-panel {
  grid-column: 1 / -1;
}

.behavior-panel {
  padding: 20px 22px;
  min-width: 0;
}

.behavior-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.behavior-panel__title {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a;
}

.behavior-panel__note {
  max-width: 240px;
  font-size: 13px;
  line-height: 1.7;
  text-align: right;
  color: #64748b;
}

.behavior-chart-stage,
.behavior-pie-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 320px;
  border: 1px dashed rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.72), rgba(255, 255, 255, 0.98));
  overflow: hidden;
}

.behavior-pie-stage--compact {
  height: 260px;
  margin-top: 14px;
}

.behavior-kpi-row,
.behavior-search-snapshot-grid,
.behavior-structure-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.behavior-kpi-row {
  margin-top: 14px;
}

.behavior-kpi-chip,
.behavior-focus-item,
.behavior-snapshot-card,
.behavior-summary-tile {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.92);
}

.behavior-kpi-chip,
.behavior-snapshot-card,
.behavior-summary-tile {
  padding: 12px 14px;
}

.behavior-kpi-chip span,
.behavior-focus-item__label,
.behavior-snapshot-card span,
.behavior-summary-tile span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.behavior-kpi-chip strong,
.behavior-focus-item__value,
.behavior-snapshot-card strong,
.behavior-summary-tile strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  line-height: 1.35;
  color: #0f172a;
}

.behavior-snapshot-card p,
.behavior-summary-tile p,
.behavior-focus-item__text {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.75;
  color: #475569;
}

.behavior-focus-list {
  display: grid;
  gap: 12px;
}

.behavior-focus-item {
  padding: 14px 16px;
}

.behavior-focus-item__value {
  font-size: 22px;
  font-weight: 700;
}

.behavior-keyword-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.behavior-keyword-chip {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.9);
  font-size: 12px;
  color: #334155;
}

.behavior-search-strip {
  border-top-color: rgba(59, 130, 246, 0.16);
}

.dark .behavior-compact-head {
  border-bottom-color: rgba(71, 85, 105, 0.46);
}

.dark .behavior-compact-head__title,
.dark .behavior-panel__title,
.dark .behavior-kpi-chip strong,
.dark .behavior-focus-item__value,
.dark .behavior-snapshot-card strong,
.dark .behavior-summary-tile strong {
  color: #f8fafc;
}

.dark .behavior-compact-head__summary,
.dark .behavior-compact-head__aside p,
.dark .behavior-snapshot-card p,
.dark .behavior-summary-tile p,
.dark .behavior-focus-item__text {
  color: #cbd5e1;
}

.dark .behavior-panel__note,
.dark .behavior-kpi-chip span,
.dark .behavior-focus-item__label,
.dark .behavior-snapshot-card span,
.dark .behavior-summary-tile span {
  color: #94a3b8;
}

.dark .behavior-compact-head__aside,
.dark .behavior-chart-stage,
.dark .behavior-pie-stage,
.dark .behavior-kpi-chip,
.dark .behavior-focus-item,
.dark .behavior-snapshot-card,
.dark .behavior-summary-tile,
.dark .behavior-keyword-chip {
  border-color: rgba(71, 85, 105, 0.52);
  background: rgba(15, 23, 42, 0.54);
}

.dark .behavior-compact-head__tag {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(71, 85, 105, 0.52);
  color: #cbd5e1;
}

@media (max-width: 1180px) {
  .behavior-compact-head,
  .behavior-overview-grid,
  .behavior-structure-grid,
  .behavior-search-grid,
  .behavior-details-grid {
    grid-template-columns: 1fr;
  }

  .behavior-panel__note {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 768px) {
  .behavior-panel {
    padding: 16px;
  }

  .behavior-compact-head__title {
    font-size: 28px;
  }

  .behavior-kpi-row,
  .behavior-search-snapshot-grid,
  .behavior-structure-summary-grid {
    grid-template-columns: 1fr;
  }

  .behavior-chart-stage,
  .behavior-pie-stage {
    height: 280px;
  }

  .behavior-pie-stage--compact {
    height: 240px;
  }
}
</style>
