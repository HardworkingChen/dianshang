<template>
  <div class="space-y-6 analytics-ui-page analytics-page-shell">
    <AnalyticsPageHero
      kicker="大数据分析"
      title="经营与行为分析"
      summary="看趋势、漏斗、留存、RFM、热力图和关联规则。"
      :meta="analysisHeadMeta"
      :chips="['趋势', '漏斗', '留存', 'RFM', '热力图', '关联规则']"
      :highlights="analysisHeroHighlights"
    />

    <section class="analytics-metric-strip">
      <article v-for="item in analysisMetricStrip" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <div class="analysis-stage" v-loading="loading">
      <section class="analysis-overview-grid">
        <article class="analytics-panel analysis-overview-card">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">趋势依据</div>
              <h3 class="analysis-section-head__title">近 30 天营收与订单</h3>
            </div>
            <div class="analysis-section-head__note">营收、订单和 7 日均线同屏看。</div>
          </div>
          <div class="analysis-trend-metrics" v-if="trendData.totalRevenue !== undefined">
            <div class="analysis-trend-metric">
              <span>总营收</span>
              <strong>¥{{ formatNumber(trendData.totalRevenue) }}</strong>
            </div>
            <div class="analysis-trend-metric">
              <span>订单数</span>
              <strong>{{ formatNumber(trendData.totalOrders) }}</strong>
            </div>
            <div class="analysis-trend-metric">
              <span>客单价</span>
              <strong>¥{{ formatNumber(trendData.avgOrderValue) }}</strong>
            </div>
            <div class="analysis-trend-metric">
              <span>周环比</span>
              <strong :class="Number(trendData.weekOverWeek || 0) >= 0 ? 'is-positive' : 'is-negative'">
                {{ Number(trendData.weekOverWeek || 0) > 0 ? '+' : '' }}{{ trendData.weekOverWeek || 0 }}%
              </strong>
            </div>
          </div>
          <div ref="trendChartRef" class="h-96 w-full"></div>
        </article>

        <article class="analytics-panel analysis-overview-card">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">整体判断</div>
              <h3 class="analysis-section-head__title">概览与依据</h3>
            </div>
            <div class="analysis-section-head__note">先看量级，再看是否存在明显断层。</div>
          </div>
          <div class="analysis-overview-list">
            <div class="analysis-overview-list__item">
              <span>活跃用户</span>
              <strong>{{ formatNumber(summary.totalActiveUsers) }}</strong>
            </div>
            <div class="analysis-overview-list__item">
              <span>付费用户</span>
              <strong>{{ formatNumber(summary.paidUserCount) }}</strong>
            </div>
            <div class="analysis-overview-list__item">
              <span>GMV</span>
              <strong>¥{{ formatNumber(summary.gmv) }}</strong>
            </div>
            <div class="analysis-overview-list__item">
              <span>整体转化率</span>
              <strong>{{ formatPercent(summary.overallConversionRate) }}</strong>
            </div>
          </div>
          <div class="analysis-note-card">
            <div class="analysis-note-card__title">简短结论</div>
            <p>{{ analysisSummaryNote }}</p>
          </div>
        </article>
      </section>

      <section class="analysis-funnel-grid">
        <article class="analytics-panel analysis-funnel-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">漏斗</div>
              <h3 class="analysis-section-head__title">用户行为漏斗</h3>
            </div>
            <div class="analysis-section-head__note">定位从浏览到购买的流失位置。</div>
          </div>
          <div ref="funnelChartRef" class="analysis-funnel-chart"></div>
        </article>

        <article class="analytics-panel analysis-funnel-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">转化率</div>
              <h3 class="analysis-section-head__title">关键转化率</h3>
            </div>
            <div class="analysis-section-head__note">保留三段关键转化和人数。</div>
          </div>
          <div class="analysis-funnel-rate-list">
            <div v-for="(stage, index) in funnelData.stages || []" :key="index" class="analysis-funnel-rate-row">
              <span class="analysis-funnel-rate-label">{{ stage.name }}</span>
              <div class="analysis-funnel-rate-track">
                <div
                  class="analysis-funnel-rate-fill"
                  :style="{ width: `${Math.max(Number(stage.rate) || 0, 3)}%`, background: funnelColors[index % funnelColors.length] }"
                ></div>
              </div>
              <strong class="analysis-funnel-rate-value">{{ formatNumber(stage.count) }} 人 <span>{{ formatPercent(stage.rate) }}</span></strong>
            </div>
            <div class="analysis-funnel-conversion-grid" v-if="funnelData.conversion">
              <div class="analysis-funnel-conversion-card bg-blue-50 dark:bg-blue-900/30">
                <div class="text-2xl font-bold text-blue-600">{{ formatPercent(funnelData.conversion.viewToCart) }}</div>
                <div class="text-xs text-gray-500 mt-1">浏览→加购</div>
              </div>
              <div class="analysis-funnel-conversion-card bg-green-50 dark:bg-green-900/30">
                <div class="text-2xl font-bold text-green-600">{{ formatPercent(funnelData.conversion.cartToBuy) }}</div>
                <div class="text-xs text-gray-500 mt-1">加购→购买</div>
              </div>
              <div class="analysis-funnel-conversion-card bg-amber-50 dark:bg-amber-900/30">
                <div class="text-2xl font-bold text-amber-600">{{ formatPercent(funnelData.conversion.viewToBuy) }}</div>
                <div class="text-xs text-gray-500 mt-1">浏览→购买</div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="analysis-deep-grid">
        <article class="analytics-panel analysis-deep-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">留存</div>
              <h3 class="analysis-section-head__title">留存分组</h3>
            </div>
            <div class="analysis-section-head__note">看不同注册批次后续活跃是否持续。</div>
          </div>
          <div class="analysis-chip-grid">
            <div class="analysis-chip">
              <span>批次数</span>
              <strong>{{ formatNumber(retentionSummary.cohortCount) }}</strong>
            </div>
            <div class="analysis-chip">
              <span>最新批次</span>
              <strong>{{ latestCohortLabel }}</strong>
            </div>
            <div class="analysis-chip">
              <span>M1 留存</span>
              <strong>{{ formatPercent(retentionSummary.latestMonth1) }}</strong>
            </div>
            <div class="analysis-chip">
              <span>M2 留存</span>
              <strong>{{ formatPercent(retentionSummary.latestMonth2) }}</strong>
            </div>
          </div>
          <div ref="retentionChartRef" class="analysis-heatmap-chart"></div>
        </article>

        <article class="analytics-panel analysis-deep-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">热力图</div>
              <h3 class="analysis-section-head__title">行为热力图</h3>
            </div>
            <div class="analysis-section-head__note">接口返回、图表和快照时间保持同一份数据口径。</div>
          </div>
          <div class="analysis-chip-grid">
            <div class="analysis-chip">
              <span>快照日期</span>
              <strong>{{ heatmapSnapshotLabel }}</strong>
            </div>
            <div class="analysis-chip">
              <span>峰值热度</span>
              <strong>{{ formatNumber(heatmapData.max) }}</strong>
            </div>
            <div class="analysis-chip">
              <span>时段数</span>
              <strong>{{ formatNumber((heatmapData.hours || []).length) }}</strong>
            </div>
            <div class="analysis-chip">
              <span>周区间</span>
              <strong>{{ formatNumber((heatmapData.days || []).length) }}</strong>
            </div>
          </div>
          <div ref="activityHeatmapRef" class="analysis-heatmap-chart"></div>
        </article>
      </section>

      <section class="analysis-rfm-grid">
        <article class="analytics-panel analysis-rfm-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">RFM</div>
              <h3 class="analysis-section-head__title">RFM 价值分布</h3>
            </div>
            <div class="analysis-section-head__note">看用户价值层级有没有随订单变化重排。</div>
          </div>
          <div ref="rfmChartRef" class="h-96 w-full"></div>
        </article>

        <article class="analytics-panel analysis-rfm-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">阈值</div>
              <h3 class="analysis-section-head__title">RFM 阈值与人数</h3>
            </div>
            <div class="analysis-section-head__note">一侧看中位数，一侧看分群规模。</div>
          </div>
          <div class="space-y-3 mt-4" v-if="rfmData.thresholds">
            <div class="analysis-chip analysis-chip--wide">
              <span>R 最近消费中位数</span>
              <strong>≤ {{ rfmData.thresholds.recencyMedian }} 天</strong>
            </div>
            <div class="analysis-chip analysis-chip--wide">
              <span>F 消费频率中位数</span>
              <strong>≥ {{ rfmData.thresholds.frequencyMedian }} 次</strong>
            </div>
            <div class="analysis-chip analysis-chip--wide">
              <span>M 消费金额中位数</span>
              <strong>≥ ¥{{ formatNumber(rfmData.thresholds.monetaryMedian) }}</strong>
            </div>
          </div>
          <div class="mt-5">
            <el-table :data="rfmData.segments || []" size="small" stripe border>
              <el-table-column prop="name" label="分群" min-width="140" />
              <el-table-column prop="count" label="用户数" width="100" align="center" />
              <el-table-column label="占比" width="120" align="center">
                <template #default="{ row }">
                  <el-tag size="small" type="info">{{ formatPercent(row.percentage) }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </article>
      </section>

      <section class="analysis-association-grid">
        <article class="analytics-panel analysis-association-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">关联</div>
              <h3 class="analysis-section-head__title">关联规则</h3>
            </div>
            <div class="analysis-section-head__note">商品共购关系直接映射到商品名，便于核对业务合理性。</div>
          </div>
          <div class="analysis-chip-grid">
            <div class="analysis-chip" v-for="item in associationSummaryCards" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <div class="mt-4">
            <el-table :data="associationRules" size="small" stripe border max-height="360">
              <el-table-column label="商品 A" min-width="180">
                <template #default="{ row }">
                  <div class="analysis-rule-name">{{ row.productAName || `商品 #${row.productA}` }}</div>
                </template>
              </el-table-column>
              <el-table-column label="商品 B" min-width="180">
                <template #default="{ row }">
                  <div class="analysis-rule-name">{{ row.productBName || `商品 #${row.productB}` }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="support" label="支持度数" width="100" align="center" />
              <el-table-column label="支持率" width="110" align="center">
                <template #default="{ row }">{{ formatRatioPercent(row.supportRate, '待计算') }}</template>
              </el-table-column>
              <el-table-column label="A→B 置信度" width="120" align="center">
                <template #default="{ row }">{{ formatRatioPercent(row.confidenceAB, '待计算') }}</template>
              </el-table-column>
              <el-table-column label="B→A 置信度" width="120" align="center">
                <template #default="{ row }">{{ formatRatioPercent(row.confidenceBA, '待计算') }}</template>
              </el-table-column>
              <el-table-column label="Lift" width="90" align="center">
                <template #default="{ row }">{{ formatFixed(row.lift, 2, '待计算') }}</template>
              </el-table-column>
            </el-table>
          </div>
        </article>

        <article class="analytics-panel analysis-association-panel">
          <div class="analysis-section-head">
            <div>
              <div class="analysis-section-head__kicker">亮点</div>
              <h3 class="analysis-section-head__title">高 Lift 组合</h3>
            </div>
            <div class="analysis-section-head__note">优先展示最值得业务解释的组合。</div>
          </div>
          <div class="analysis-rule-list">
            <div v-for="rule in associationHighlights" :key="`${rule.productA}-${rule.productB}`" class="analysis-rule-card">
              <div class="analysis-rule-card__top">
                <strong>{{ rule.productAName || `商品 #${rule.productA}` }}</strong>
                <span>×</span>
                <strong>{{ rule.productBName || `商品 #${rule.productB}` }}</strong>
              </div>
              <div class="analysis-rule-card__meta">
                <span>Lift {{ formatFixed(rule.lift, 2, '待计算') }}</span>
                <span>支持率 {{ formatRatioPercent(rule.supportRate, '待计算') }}</span>
                <span>A→B {{ formatRatioPercent(rule.confidenceAB, '待计算') }}</span>
              </div>
            </div>
            <el-empty v-if="!associationHighlights.length" description="暂无关联规则数据" />
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import {
  getActivityHeatmap,
  getAnalysisSummary,
  getAssociationRules,
  getFunnelAnalysis,
  getRetentionAnalysis,
  getRfmAnalysis,
  getSalesTrendAnalysis,
} from '../../api/admin'

const loading = ref(false)
const summary = ref({})
const funnelData = ref({})
const rfmData = ref({})
const trendData = ref({})
const retentionData = ref({})
const heatmapData = ref({})
const associationData = ref({})

const funnelColors = ['#2563eb', '#0f766e', '#f59e0b', '#ef4444']

const funnelChartRef = ref(null)
const rfmChartRef = ref(null)
const trendChartRef = ref(null)
const retentionChartRef = ref(null)
const activityHeatmapRef = ref(null)

const charts = []
let themeObserver = null

const analysisMetricStrip = computed(() => [
  {
    label: '行为数据总量',
    value: formatNumber(summary.value.totalBehaviorRecords),
    sub: '浏览、点击、加购、购买',
  },
  {
    label: '有效订单数',
    value: formatNumber(summary.value.totalPaidOrders),
    sub: '已支付并纳入分析',
  },
  {
    label: '付费用户数',
    value: formatNumber(summary.value.paidUserCount),
    sub: '成交用户去重统计',
  },
  {
    label: '活跃用户数',
    value: formatNumber(summary.value.totalActiveUsers),
    sub: '行为用户去重统计',
  },
  {
    label: '整体成交额',
    value: `¥${formatNumber(summary.value.gmv)}`,
    sub: '支付订单成交额',
  },
  {
    label: '总体转化率',
    value: formatPercent(summary.value.overallConversionRate),
    sub: '购买人数 / 曝光人数',
  },
])
const heatmapSnapshotLabel = computed(() => heatmapData.value.snapshotDate || '待生成')
const analysisHeroHighlights = computed(() => [
  {
    label: '活跃用户',
    value: formatNumber(summary.value.totalActiveUsers),
    note: '直接判断最新行为是否真正回流到活跃口径。',
  },
  {
    label: '付费用户',
    value: formatNumber(summary.value.paidUserCount),
    note: `GMV ¥${formatNumber(summary.value.gmv)}`,
  },
  {
    label: '留存批次',
    value: formatNumber(retentionSummary.value.cohortCount),
    note: `最新批次 ${latestCohortLabel.value}`,
  },
  {
    label: '关联规则',
    value: formatNumber(associationData.value.filteredRules || 0),
    note: `热力图快照 ${heatmapSnapshotLabel.value}`,
  },
])

const retentionSummary = computed(() => {
  const cohorts = retentionData.value.cohorts || []
  const latest = cohorts.length ? cohorts[cohorts.length - 1] : null
  const retention = latest?.retention || []
  return {
    cohortCount: cohorts.length,
    latestCohort: latest?.cohort || '',
    latestMonth1: retention[1] || 0,
    latestMonth2: retention[2] || 0,
  }
})
const latestCohortLabel = computed(() => retentionSummary.value.latestCohort || '待生成')

const associationRules = computed(() => associationData.value.rules || [])
const associationHighlights = computed(() => associationRules.value.slice(0, 6))
const associationSummaryCards = computed(() => [
  {
    label: '订单事务数',
    value: formatPendingNumber(associationData.value.totalTransactions),
  },
  {
    label: '候选商品对',
    value: formatPendingNumber(associationData.value.totalPairs),
  },
  {
    label: '筛出规则数',
    value: formatPendingNumber(associationData.value.filteredRules),
  },
  {
    label: '最高 Lift',
    value: formatFixed(associationRules.value[0]?.lift, 2, '待生成'),
  },
])

const analysisHeadMeta = computed(() => {
  const cohortCount = retentionSummary.value.cohortCount
  const ruleCount = associationData.value.filteredRules || 0
  return `${cohortCount} 个留存批次 · ${ruleCount} 条关联规则 · 热力图快照 ${heatmapSnapshotLabel.value}`
})

const analysisSummaryNote = computed(() => {
  const topRule = associationRules.value[0]
  if (!topRule) {
    return '当前页已经接入真实留存、热力图和关联规则接口；如果这一块为空，说明是数据本身为空，而不是页面没接上。'
  }
  const productA = topRule.productAName || `商品 #${topRule.productA}`
  const productB = topRule.productBName || `商品 #${topRule.productB}`
  return `当前已接入完整分析链路。当前最高 Lift 组合是「${productA} × ${productB}」，同时留存和热力图也使用真实接口数据。`
})

function disposeCharts() {
  charts.forEach(chart => chart?.dispose())
  charts.length = 0
}

function registerChart(container) {
  const chart = echarts.init(container)
  charts.push(chart)
  return chart
}

function chartStyle() {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    textColor: isDark ? '#cbd5e1' : '#64748b',
    titleColor: isDark ? '#f8fafc' : '#0f172a',
    splitLine: isDark ? 'rgba(71, 85, 105, 0.35)' : 'rgba(148, 163, 184, 0.22)',
    axisLine: isDark ? '#475569' : '#cbd5e1',
    borderColor: isDark ? '#0f172a' : '#ffffff',
    emptyColor: isDark ? '#334155' : '#dbeafe',
  }
}

function formatNumber(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '--'
}

function formatPercent(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : '--'
}

function formatRatioPercent(value, fallback = '--') {
  if (value == null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : fallback
}

function formatFixed(value, digits = 2, fallback = '--') {
  if (value == null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : fallback
}

function formatPendingNumber(value, fallback = '待生成') {
  if (value == null || value === '') return fallback
  return formatNumber(value)
}

async function loadAll() {
  loading.value = true
  try {
    const [
      summaryResult,
      funnelResult,
      rfmResult,
      trendResult,
      retentionResult,
      heatmapResult,
      associationResult,
    ] = await Promise.allSettled([
      getAnalysisSummary(),
      getFunnelAnalysis(),
      getRfmAnalysis(),
      getSalesTrendAnalysis(),
      getRetentionAnalysis(),
      getActivityHeatmap(),
      getAssociationRules({ minSupport: 1, minConfidence: 0.1 }),
    ])

    summary.value = summaryResult.status === 'fulfilled' ? (summaryResult.value || {}) : {}
    funnelData.value = funnelResult.status === 'fulfilled' ? (funnelResult.value || {}) : {}
    rfmData.value = rfmResult.status === 'fulfilled' ? (rfmResult.value || {}) : {}
    trendData.value = trendResult.status === 'fulfilled' ? (trendResult.value || {}) : {}
    retentionData.value = retentionResult.status === 'fulfilled' ? (retentionResult.value || {}) : {}
    heatmapData.value = heatmapResult.status === 'fulfilled' ? (heatmapResult.value || {}) : {}
    associationData.value = associationResult.status === 'fulfilled' ? (associationResult.value || {}) : {}

    await nextTick()
    renderAllCharts()
  } finally {
    loading.value = false
  }
}

function renderAllCharts() {
  disposeCharts()
  renderTrendChart()
  renderFunnelChart()
  renderRfmChart()
  renderRetentionChart()
  renderActivityHeatmapChart()
}

function renderTrendChart() {
  if (!trendChartRef.value) return
  const style = chartStyle()
  const chart = registerChart(trendChartRef.value)
  const data = trendData.value
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['日营收', '7日均线', '订单数'], textStyle: { color: style.textColor } },
    grid: { left: '4%', right: '4%', bottom: 72, top: 44, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.dates || [],
      axisLine: { lineStyle: { color: style.axisLine } },
      axisLabel: { color: style.textColor, rotate: 45, fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: '金额 (¥)',
        splitLine: { lineStyle: { color: style.splitLine, type: 'dashed' } },
        axisLine: { lineStyle: { color: style.axisLine } },
        axisLabel: { color: style.textColor },
      },
      {
        type: 'value',
        name: '订单数',
        splitLine: { show: false },
        axisLine: { lineStyle: { color: style.axisLine } },
        axisLabel: { color: style.textColor },
      },
    ],
    series: [
      {
        name: '日营收',
        type: 'bar',
        yAxisIndex: 0,
        barMaxWidth: 20,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37, 99, 235, 0.86)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.18)' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: data.revenues || [],
      },
      {
        name: '7日均线',
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        data: data.movingAverage7 || [],
      },
      {
        name: '订单数',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#0f766e', type: 'dashed' },
        itemStyle: { color: '#0f766e' },
        data: data.orderCounts || [],
      },
    ],
  })
}

function renderFunnelChart() {
  if (!funnelChartRef.value) return
  const chart = registerChart(funnelChartRef.value)
  const stages = funnelData.value.stages || []
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    series: [{
      type: 'funnel',
      left: '4%',
      right: '4%',
      top: 28,
      bottom: 28,
      width: '92%',
      min: 0,
      max: stages.length ? stages[0].count : 100,
      sort: 'descending',
      gap: 4,
      label: {
        show: true,
        position: 'inside',
        formatter: params => Number(params.value || 0) > 0 ? `${params.name} ${formatNumber(params.value)} 人` : '',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
      },
      labelLine: { show: false },
      itemStyle: { borderWidth: 2, borderColor: '#fff' },
      labelLayout: { hideOverlap: true },
      data: stages.map((stage, index) => ({
        name: stage.name,
        value: stage.count,
        itemStyle: { color: funnelColors[index % funnelColors.length] },
      })),
    }],
  })
}

function renderRfmChart() {
  if (!rfmChartRef.value) return
  const style = chartStyle()
  const chart = registerChart(rfmChartRef.value)
  const segments = rfmData.value.segments || []
  const colors = ['#2563eb', '#0f766e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1']
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: {
      bottom: 8,
      type: 'scroll',
      textStyle: { color: style.textColor },
    },
    series: [{
      type: 'pie',
      radius: ['35%', '64%'],
      center: ['50%', '40%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: style.borderColor },
      label: { show: false },
      emphasis: { label: { show: true, formatter: '{b}\n{d}%', fontSize: 12 } },
      data: segments.map((segment, index) => ({
        name: segment.name,
        value: segment.count,
        itemStyle: { color: colors[index % colors.length] },
      })),
    }],
  })
}

function renderRetentionChart() {
  if (!retentionChartRef.value) return
  const style = chartStyle()
  const chart = registerChart(retentionChartRef.value)
  const rows = (retentionData.value.cohorts || []).slice().reverse()
  const maxOffset = Math.max(...rows.map(item => (item.retention || []).length), 0)
  const xLabels = Array.from({ length: maxOffset }, (_, index) => `M${index}`)
  const yLabels = rows.map(item => `${item.cohort} · ${formatNumber(item.size)}人`)
  const cells = []

  rows.forEach((row, yIndex) => {
    ;(row.retention || []).forEach((value, xIndex) => {
      cells.push([xIndex, yIndex, Number(value || 0)])
    })
  })

  chart.setOption({
    tooltip: {
      position: 'top',
      formatter: params => `${yLabels[params.value[1]]}<br/>${xLabels[params.value[0]]} 留存：${formatPercent(params.value[2])}`,
    },
    grid: { left: 88, right: 18, top: 18, bottom: 44 },
    xAxis: {
      type: 'category',
      data: xLabels,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: style.axisLine } },
      axisLabel: { color: style.textColor },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: style.axisLine } },
      axisLabel: { color: style.textColor },
    },
    visualMap: {
      min: 0,
      max: 100,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: style.textColor },
      inRange: {
        color: ['#eff6ff', '#93c5fd', '#2563eb', '#0f3f8a'],
      },
    },
    series: [{
      type: 'heatmap',
      data: cells,
      label: {
        show: true,
        formatter: ({ value }) => `${Number(value[2] || 0).toFixed(0)}%`,
        color: '#0f172a',
        fontSize: 10,
      },
      itemStyle: {
        borderWidth: 1,
        borderColor: style.borderColor,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(15, 23, 42, 0.18)',
        },
      },
    }],
  })
}

function renderActivityHeatmapChart() {
  if (!activityHeatmapRef.value) return
  const style = chartStyle()
  const chart = registerChart(activityHeatmapRef.value)
  const data = heatmapData.value
  chart.setOption({
    tooltip: {
      position: 'top',
      formatter: params => `${data.days?.[params.value[1]] || '--'} ${data.hours?.[params.value[0]] || '--'}<br/>行为数：${formatNumber(params.value[2])}`,
    },
    grid: { left: 72, right: 18, top: 18, bottom: 44 },
    xAxis: {
      type: 'category',
      data: data.hours || [],
      splitArea: { show: false },
      axisLine: { lineStyle: { color: style.axisLine } },
      axisLabel: { color: style.textColor, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: data.days || [],
      splitArea: { show: false },
      axisLine: { lineStyle: { color: style.axisLine } },
      axisLabel: { color: style.textColor },
    },
    visualMap: {
      min: 0,
      max: Math.max(Number(data.max || 0), 1),
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: style.textColor },
      inRange: {
        color: ['#f8fafc', '#bae6fd', '#22c55e', '#f59e0b', '#dc2626'],
      },
    },
    series: [{
      type: 'heatmap',
      data: data.data || [],
      label: { show: false },
      itemStyle: {
        borderWidth: 1,
        borderColor: style.borderColor,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(15, 23, 42, 0.18)',
        },
      },
    }],
  })
}

function handleResize() {
  charts.forEach(chart => chart?.resize())
}

onMounted(async () => {
  await loadAll()
  window.addEventListener('resize', handleResize)
  themeObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.attributeName === 'class')) {
      nextTick(() => renderAllCharts())
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  disposeCharts()
  window.removeEventListener('resize', handleResize)
  themeObserver?.disconnect()
})
</script>

<style scoped>
.analysis-compact-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 0 4px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.analysis-compact-head__kicker {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #2563eb;
}

.analysis-compact-head__title {
  margin-top: 8px;
  font-size: clamp(26px, 3vw, 40px);
  line-height: 1.1;
  font-weight: 900;
  color: #0f172a;
}

.analysis-compact-head__meta {
  flex: none;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  text-align: right;
}

.analysis-compact-head__summary {
  margin-top: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
  max-width: 760px;
}

.analysis-stage {
  min-width: 0;
}

.analysis-overview-grid,
.analysis-rfm-grid,
.analysis-deep-grid,
.analysis-association-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.analysis-rfm-grid,
.analysis-deep-grid,
.analysis-association-grid {
  margin-top: 20px;
}

.analysis-funnel-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
  gap: 28px;
  align-items: start;
  margin-top: 20px;
}

.analysis-overview-card,
.analysis-rfm-panel,
.analysis-funnel-panel,
.analysis-deep-panel,
.analysis-association-panel {
  padding: 22px;
  min-width: 0;
}

.analysis-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.analysis-section-head__kicker {
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.analysis-section-head__title {
  margin-top: 5px;
  color: #0f172a;
  font-size: 19px;
  font-weight: 800;
}

.analysis-section-head__note {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  max-width: 300px;
  text-align: right;
}

.analysis-trend-metrics,
.analysis-overview-list,
.analysis-chip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.analysis-trend-metric,
.analysis-overview-list__item,
.analysis-chip,
.analysis-rule-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.82);
}

.analysis-trend-metric,
.analysis-overview-list__item,
.analysis-chip {
  padding: 14px 15px;
}

.analysis-trend-metric span,
.analysis-overview-list__item span,
.analysis-chip span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.analysis-trend-metric strong,
.analysis-overview-list__item strong,
.analysis-chip strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 800;
}

.analysis-chip--wide strong {
  font-size: 16px;
}

.analysis-trend-metric strong.is-positive {
  color: #059669;
}

.analysis-trend-metric strong.is-negative {
  color: #dc2626;
}

.analysis-note-card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(239, 246, 255, 0.72);
  padding: 16px;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.analysis-note-card__title {
  margin-bottom: 6px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
}

.analysis-funnel-chart,
.analysis-heatmap-chart {
  width: 100%;
  height: 420px;
}

.analysis-funnel-rate-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 22px;
}

.analysis-funnel-rate-row {
  display: grid;
  grid-template-columns: 58px minmax(180px, 1fr) minmax(112px, max-content);
  gap: 14px;
  align-items: center;
}

.analysis-funnel-rate-label {
  color: #64748b;
  font-size: 14px;
  text-align: right;
}

.analysis-funnel-rate-track {
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
}

.analysis-funnel-rate-fill {
  height: 100%;
  min-width: 12px;
  border-radius: inherit;
  transition: width 0.35s ease;
}

.analysis-funnel-rate-value {
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.analysis-funnel-rate-value span {
  color: #64748b;
  font-weight: 600;
}

.analysis-funnel-conversion-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 28px;
}

.analysis-funnel-conversion-card {
  min-width: 0;
  border-radius: 12px;
  padding: 18px 14px;
  text-align: center;
}

.analysis-rule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analysis-rule-card {
  padding: 14px 16px;
}

.analysis-rule-card__top {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #0f172a;
  font-size: 14px;
}

.analysis-rule-card__top span {
  color: #94a3b8;
}

.analysis-rule-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  color: #64748b;
  font-size: 12px;
}

.analysis-rule-name {
  color: #0f172a;
  font-weight: 700;
  line-height: 1.5;
}

.dark .analysis-compact-head__summary,
.dark .analysis-compact-head__meta,
.dark .analysis-section-head__note,
.dark .analysis-trend-metric span,
.dark .analysis-overview-list__item span,
.dark .analysis-chip span,
.dark .analysis-note-card,
.dark .analysis-funnel-rate-value span,
.dark .analysis-funnel-rate-label,
.dark .analysis-rule-card__meta {
  color: #cbd5e1;
}

.dark .analysis-compact-head__title,
.dark .analysis-section-head__title,
.dark .analysis-trend-metric strong,
.dark .analysis-overview-list__item strong,
.dark .analysis-chip strong,
.dark .analysis-note-card__title,
.dark .analysis-funnel-rate-value,
.dark .analysis-rule-name,
.dark .analysis-rule-card__top {
  color: #f8fafc;
}

.dark .analysis-trend-metric,
.dark .analysis-overview-list__item,
.dark .analysis-chip,
.dark .analysis-rule-card {
  border-color: rgba(71, 85, 105, 0.62);
  background: rgba(15, 23, 42, 0.48);
}

.dark .analysis-note-card {
  border-color: rgba(56, 189, 248, 0.18);
  background: rgba(15, 23, 42, 0.48);
}

.dark .analysis-funnel-rate-track {
  background: rgba(51, 65, 85, 0.82);
}

@media (max-width: 1280px) {
  .analysis-overview-grid,
  .analysis-rfm-grid,
  .analysis-deep-grid,
  .analysis-association-grid,
  .analysis-funnel-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .analysis-trend-metrics,
  .analysis-overview-list,
  .analysis-chip-grid,
  .analysis-funnel-conversion-grid {
    grid-template-columns: 1fr;
  }

  .analysis-funnel-chart,
  .analysis-heatmap-chart {
    height: 340px;
  }

  .analysis-funnel-rate-row {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .analysis-funnel-rate-value {
    grid-column: 2;
    font-size: 13px;
  }

  .analysis-compact-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .analysis-compact-head__meta,
  .analysis-section-head__note {
    text-align: left;
    max-width: none;
  }
}
</style>
