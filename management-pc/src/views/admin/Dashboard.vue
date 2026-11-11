<template>
  <div class="page-stack analytics-ui-page analytics-page-shell dashboard-cockpit">
    <AnalyticsPageHero
      kicker="数据总览"
      title="平台运营总览"
      summary="展示平台核心经营指标与系统健康状态。"
      :meta="`截至 ${dashboardLatestDate} 的关键指标`"
      :chips="['经营趋势', '推荐表现', '系统健康']"
      :highlights="dashboardHeroHighlights"
    />

    <section class="dashboard-cockpit__metric-strip">
      <article v-for="item in dashboardMetrics" :key="item.label" class="dashboard-cockpit__metric">
        <span class="dashboard-cockpit__metric-label">{{ item.label }}</span>
        <strong class="dashboard-cockpit__metric-value">{{ item.value }}</strong>
        <span class="dashboard-cockpit__metric-sub">{{ item.sub }}</span>
      </article>
    </section>

    <section class="dashboard-cockpit__board">
      <div class="dashboard-cockpit__section-head">
        <div>
          <div class="dashboard-cockpit__section-eyebrow">趋势依据</div>
          <h2 class="dashboard-cockpit__section-title">营收与订单变化</h2>
        </div>
        <div class="dashboard-cockpit__section-aside">最近 {{ recentStats.length }} 个统计日</div>
      </div>
      <div class="dashboard-cockpit__trend-grid">
        <div v-if="hasRecentStats" class="dashboard-cockpit__chart-wrap">
          <div ref="revenueChartRef" class="h-80 w-full"></div>
        </div>
        <div v-else class="dashboard-cockpit__empty">
          <div class="dashboard-cockpit__empty-title">暂无经营趋势</div>
          <p>还没有可用于绘制趋势的统计日。数据同步后这里会显示营收走势。</p>
        </div>

        <div class="analytics-evidence-grid dashboard-cockpit__evidence-grid">
          <article v-for="item in dashboardEvidenceCards" :key="item.label" class="analytics-evidence-card">
            <span class="analytics-evidence-card__label">{{ item.label }}</span>
            <strong class="analytics-evidence-card__value">{{ item.value }}</strong>
            <span class="analytics-evidence-card__note">{{ item.note }}</span>
          </article>
        </div>
      </div>
    </section>

    <section class="dashboard-cockpit__grid dashboard-cockpit__grid--double">
      <article class="dashboard-cockpit__section">
        <div class="dashboard-cockpit__section-head">
          <div>
            <div class="dashboard-cockpit__section-eyebrow">稳定性依据</div>
            <h2 class="dashboard-cockpit__section-title">系统与链路状态</h2>
          </div>
          <el-button text @click="goTo('/admin/analytics/realtime-stream')">查看实时流</el-button>

<el-button type="primary" @click="upgrade()">升级为专业版</el-button>
        </div>
        <div class="dashboard-cockpit__status-list">
          <div v-for="item in healthItems" :key="item.key" class="dashboard-cockpit__status-row">
            <div>
              <div class="dashboard-cockpit__status-title">{{ item.title }}</div>
              <div class="dashboard-cockpit__status-text">{{ item.message }}</div>
            </div>
            <el-tag :type="statusTagType(item.status)" effect="light">{{ statusLabel(item.status) }}</el-tag>
          </div>
        </div>
      </article>

      <article class="dashboard-cockpit__section">
        <div class="dashboard-cockpit__section-head">
          <div>
            <div class="dashboard-cockpit__section-eyebrow">实时表现</div>
            <h2 class="dashboard-cockpit__section-title">热榜前五（1 分钟）</h2>
          </div>
          <el-button text @click="goTo('/admin/analytics/realtime-stream')">查看完整热榜</el-button>
        </div>
        <div v-if="hotProductsPreview.length" class="dashboard-cockpit__rank-list">
          <div v-for="(item, index) in hotProductsPreview" :key="`${item.productId || item.name}-${index}`" class="dashboard-cockpit__rank-row">
            <div class="dashboard-cockpit__rank-main">
              <span class="dashboard-cockpit__rank-index">{{ index + 1 }}</span>
              <div class="dashboard-cockpit__rank-title">{{ item.name }}</div>
            </div>
            <div class="dashboard-cockpit__rank-side">
              <span class="dashboard-cockpit__rank-score">{{ item.score }}</span>
              <span class="dashboard-cockpit__rank-price">{{ item.price }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无热榜数据" :image-size="80" />
      </article>
    </section>

  </div>
  <div class="dashboard-commercial-banner">
    <el-badge type="warning" style="margin-bottom:8px;display:inline-block;">限时优惠</el-badge>
    <p style="margin:0;font-size:14px;color:#1f222b;"><strong>专业版专属功能：</strong>高级看板、独家风控模型、API 额外配额，即点即得。</p>
    <el-button type="primary" @click="upgrade()">立即升级</el-button>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import {
  getAdminDashboard,
  getAdminStreamOverview,
  getAdminSystemHealth,
} from '../../api/admin'

const router = useRouter()

const dashData = ref({})
const streamOverview = ref({})
const systemHealth = ref({})
const revenueChartRef = ref(null)

let revenueChart = null
let themeObserver = null
let echartsLoadPromise = null

function loadEcharts() {
  if (!echartsLoadPromise) {
    echartsLoadPromise = import('echarts')
  }
  return echartsLoadPromise
}

const performanceSummary = computed(() => {
  const data = dashData.value || {}
  const source =
    data.performanceSummary ||
    data.recommendationSummary ||
    data.performance ||
    data.recommendationPerformance ||
    {}
  return {
    exposureCount: source.exposureCount ?? source.impressionCount ?? 0,
    conversionRate: source.conversionRate ?? source.cvr ?? source.orderRate ?? source.purchaseRate ?? 0,
    clickCount: source.clickCount ?? source.clickedCount ?? 0,
    purchaseCount: source.purchaseCount ?? source.orderCount ?? source.convertedCount ?? 0,
    clickThroughRate: source.clickThroughRate ?? source.clickRate ?? source.ctr ?? null,
  }
})

const recentStats = computed(() => (Array.isArray(dashData.value?.recentStats) ? dashData.value.recentStats : []))
const hasRecentStats = computed(() => recentStats.value.some(item =>
  Number(item?.amount || item?.revenue || item?.totalRevenue || item?.count || item?.orders || item?.orderCount || 0) > 0
))
const latestStat = computed(() => recentStats.value[recentStats.value.length - 1] || {})
const previousStat = computed(() => recentStats.value[recentStats.value.length - 2] || {})
const latestRevenue = computed(() =>
  Number(latestStat.value.amount || latestStat.value.revenue || latestStat.value.totalRevenue || 0)
)
const previousRevenue = computed(() =>
  Number(previousStat.value.amount || previousStat.value.revenue || previousStat.value.totalRevenue || 0)
)
const latestOrderCount = computed(() =>
  Number(latestStat.value.count || latestStat.value.orders || latestStat.value.orderCount || 0)
)
const latestPaidUsers = computed(() =>
  Number(dashData.value?.paidUserCount || dashData.value?.activeUsers || 0)
)
const latestConversionRate = computed(() => Number(performanceSummary.value.conversionRate || 0))
const latestRecommendCtr = computed(() => {
  const raw = Number(performanceSummary.value.clickThroughRate)
  if (Number.isFinite(raw)) return raw
  const exposure = Number(performanceSummary.value.exposureCount || 0)
  const click = Number(performanceSummary.value.clickCount || 0)
  return exposure > 0 ? (click / exposure) * 100 : 0
})
const revenueDelta = computed(() => {
  if (!previousRevenue.value) return null
  return ((latestRevenue.value - previousRevenue.value) / previousRevenue.value) * 100
})
const warningCount = computed(() =>
  healthItems.value.filter(item => item.status === 'WARN' || item.status === 'DOWN' || item.status === 'MISSING').length
)
const dashboardLatestDate = computed(() => latestStat.value.date || latestStat.value.orderDate || '待同步')
const dashboardHeadline = computed(() => {
  if (warningCount.value > 0) return `待处理风险 ${warningCount.value} 项`
  if (latestConversionRate.value >= 10) return '推荐转化稳定'
  if (latestRevenue.value > 0) return '经营数据持续更新'
  return '等待经营数据'
})
const dashboardMetrics = computed(() => [
  {
    label: '最近统计日营收',
    value: formatMoney(latestRevenue.value),
    sub: revenueDelta.value == null ? '当前基线' : `较上日 ${revenueDelta.value >= 0 ? '+' : ''}${formatDecimal(revenueDelta.value, 1)}%`,
  },
  { label: '最近统计日订单', value: formatNumber(latestOrderCount.value), sub: '日订单量' },
  { label: '推荐曝光量', value: formatNumber(performanceSummary.value.exposureCount), sub: '核心流量指标' },
  { label: '推荐转化率', value: formatPercent(latestConversionRate.value), sub: '推荐效果指标' },
  { label: '推荐 CTR', value: formatKpiPercent(latestRecommendCtr.value), sub: '点击率' },
  { label: '活跃 / 付费用户', value: formatNumber(latestPaidUsers.value), sub: '活跃用户规模' },
])
const dashboardHeroHighlights = computed(() => [
  {
    label: '当前判断',
    value: dashboardHeadline.value,
    note: warningCount.value > 0 ? `仍有 ${warningCount.value} 项链路需要关注` : '当前链路没有显著异常',
    tone: warningCount.value > 0 ? 'warning' : 'success',
  },
  {
    label: '最近统计日营收',
    value: formatMoney(latestRevenue.value),
    note: revenueDelta.value == null ? '暂无上日对比' : `较上日 ${revenueDelta.value >= 0 ? '+' : ''}${formatDecimal(revenueDelta.value, 1)}%`,
  },
  {
    label: '推荐转化率',
    value: formatPercent(latestConversionRate.value),
    note: `CTR ${formatKpiPercent(latestRecommendCtr.value)} · 曝光 ${formatNumber(performanceSummary.value.exposureCount)}`,
  },
  {
    label: '系统检查时间',
    value: formatDateTime(systemHealth.value?.timestamp),
    note: `${healthItems.value.filter(item => item.status === 'OK').length} 项正常`,
  },
])
const dashboardEvidenceCards = computed(() => [
  {
    label: '营收与订单',
    value: `${formatMoney(latestRevenue.value)} / ${formatNumber(latestOrderCount.value)}`,
    note: '同一张图里看收入、订单和均线，方便解释规模变化。',
  },
  {
    label: '推荐链路',
    value: `${formatNumber(performanceSummary.value.clickCount)} 点击`,
    note: `当前推荐曝光 ${formatNumber(performanceSummary.value.exposureCount)}，已能直接支撑 CTR/CVR 解释。`,
  },
  {
    label: '活跃覆盖',
    value: formatNumber(latestPaidUsers.value),
    note: '用活跃 / 付费用户判断最近这批经营结果是否只是少数订单拉动。',
  },
])

const hotProductsPreview = computed(() => {
  const rows = Array.isArray(streamOverview.value?.hotProducts1m) ? streamOverview.value.hotProducts1m : []
  return rows.slice(0, 5).map((row, index) => {
    const score = pickNumber(row, ['score', 'hotScore', 'count', 'heat', 'value'])
    const price = pickNumber(row, ['price'])
    return {
      productId: row?.productId || row?.id || `hot-${index + 1}`,
      name: row?.productName || row?.name || `商品 ${index + 1}`,
      score: formatNumber(score),
      price: formatMoney(price),
    }
  })
})

const healthItems = computed(() => {
  const mysql = systemHealth.value.mysql || {}
  const redis = systemHealth.value.redis || {}
  const pythonAnalytics = systemHealth.value.pythonAnalytics || {}
  const sqlInit = systemHealth.value.sqlInit || {}
  const modules = systemHealth.value.modules || {}
  return [
    { key: 'mysql', title: 'MySQL', status: mysql.status || 'UNKNOWN', message: mysql.message || '检查数据库连接' },
    { key: 'redis', title: 'Redis', status: redis.status || 'UNKNOWN', message: redis.message || '检查缓存连接' },
    { key: 'python', title: 'Python 分析', status: pythonAnalytics.status || 'UNKNOWN', message: pythonAnalytics.message || '检查离线分析脚本' },
    { key: 'sql', title: '初始化 SQL', status: sqlInit.status || 'UNKNOWN', message: sqlInit.message || '检查数据库初始化' },
    { key: 'modules', title: '模块开关', status: modules.status || 'UNKNOWN', message: `${modules.enabled || 0}/${modules.total || 0} 已启用` },
  ]
})

function formatNumber(value) {
  const number = Number(value || 0)
  return Number.isNaN(number) ? '0' : number.toLocaleString('zh-CN')
}

function formatMoney(value) {
  const number = Number(value || 0)
  if (Number.isNaN(number)) return '¥0.00'
  return `¥${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDecimal(value, digits = 2) {
  if (value == null || value === '') return '待计算'
  const number = Number(value)
  return Number.isNaN(number) ? '待计算' : number.toFixed(digits)
}

function formatPercent(value) {
  if (value == null || value === '') return '0%'
  const number = Number(value)
  if (Number.isNaN(number)) return '0%'
  return `${number.toFixed(2).replace(/\.00$/, '')}%`
}

function formatKpiPercent(value) {
  if (value == null || value === '') return '待同步'
  const number = Number(value)
  if (Number.isNaN(number)) return '待同步'
  const normalized = Math.abs(number) <= 1 ? number * 100 : number
  return `${normalized.toFixed(2).replace(/\.00$/, '')}%`
}

function pickNumber(obj, keys = []) {
  for (const key of keys) {
    const value = obj?.[key]
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return 0
}

function formatDateTime(value) {
  if (!value) return '待同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

function statusTagType(status) {
  if (status === 'UP') return 'success'
  if (status === 'WARN') return 'warning'
  if (status === 'DOWN' || status === 'MISSING') return 'danger'
  return 'info'
}

function statusLabel(status) {
  if (status === 'UP') return '正常'
  if (status === 'WARN') return '关注'
  if (status === 'DOWN') return '异常'
  if (status === 'MISSING') return '缺失'
  return '未知'
}

function goTo(path) {
  if (router.currentRoute.value.path !== path) router.push(path)
}

function disposeCharts() {
  revenueChart?.dispose()
  revenueChart = null
}

async function renderCharts() {
  if (!hasRecentStats.value) { disposeCharts(); return }
  const echarts = await loadEcharts()
  const isDark = document.documentElement.classList.contains('dark')
  const textColor = isDark ? '#cbd5e1' : '#475569'
  const splitLineColor = isDark ? '#334155' : '#e2e8f0'
  disposeCharts()
  if (revenueChartRef.value) {
    revenueChart = echarts.init(revenueChartRef.value)
    revenueChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '4%', right: '4%', bottom: 40, top: 18, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: recentStats.value.map(item => item.date || item.orderDate || ''),
        axisLabel: { color: textColor, margin: 12 },
        axisLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: { color: textColor },
      },
      series: [{
        name: '营收',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: '#2563eb' },
        itemStyle: { color: '#2563eb' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37, 99, 235, 0.24)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0)' },
          ]),
        },
        data: recentStats.value.map(item => item.amount || item.revenue || item.totalRevenue || 0),
      }],
    })
  }
}

async function loadDashboardData() {
  const [dashboardResult, streamResult, healthResult] = await Promise.allSettled([
    getAdminDashboard(),
    getAdminStreamOverview({ hotLimit: 6, userLimit: 6 }),
    getAdminSystemHealth(),
  ])
  dashData.value = dashboardResult.status === 'fulfilled' ? dashboardResult.value || {} : {}
  streamOverview.value = streamResult.status === 'fulfilled' ? streamResult.value || {} : {}
  systemHealth.value = healthResult.status === 'fulfilled' ? healthResult.value || {} : {}
  await nextTick()
  renderCharts()
}

onMounted(async () => {
  await loadDashboardData()
  window.addEventListener('resize', renderCharts)
  themeObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.attributeName === 'class')) {
      nextTick(() => renderCharts())
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  window.removeEventListener('resize', renderCharts)
  themeObserver?.disconnect()
  disposeCharts()
})
</script>

<style scoped>
.dashboard-cockpit { color: #0f172a; }

.dashboard-cockpit__section-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #0f766e;
}

.dashboard-cockpit__status-text { color: #475569; line-height: 1.8; }

.dashboard-cockpit__summary-meta,
.dashboard-cockpit__section-aside,
.dashboard-cockpit__metric-sub {
  color: #64748b;
}

.dashboard-cockpit__metric-strip {
  display: grid;
  gap: 0 20px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  padding: 4px 0 8px;
}

.dashboard-cockpit__metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 20px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.dashboard-cockpit__metric-label,
.dashboard-cockpit__fact-label { font-size: 12px; color: #64748b; }

.dashboard-cockpit__metric-value {
  font-size: 28px;
  line-height: 1.1;
  font-weight: 800;
}

.dashboard-cockpit__board,
.dashboard-cockpit__section {
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding-top: 24px;
}

.dashboard-cockpit__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-cockpit__section-title {
  margin-top: 10px;
  font-size: 24px;
  line-height: 1.28;
  font-weight: 800;
}

.dashboard-cockpit__trend-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.34fr) minmax(280px, 0.66fr);
  gap: 18px;
  margin-top: 20px;
}

.dashboard-cockpit__chart-wrap { min-width: 0; }

.dashboard-cockpit__empty {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed rgba(148, 163, 184, 0.42);
  border-radius: 18px;
  color: #64748b;
  text-align: center;
  padding: 28px;
}

.dashboard-cockpit__empty-title { font-size: 16px; font-weight: 800; color: #334155; }

.dashboard-cockpit__evidence-grid {
  align-content: start;
}

.dashboard-cockpit__status-list { display: flex; flex-direction: column; }

.dashboard-cockpit__status-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.dashboard-cockpit__status-row:first-child { border-top: none; }

.dashboard-cockpit__status-title {
  margin-top: 6px;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.dashboard-cockpit__grid { display: grid; gap: 28px; }

.dashboard-cockpit__grid--double {
  grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
}

.dashboard-cockpit__rank-list { margin-top: 16px; display: flex; flex-direction: column; }

.dashboard-cockpit__rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.dashboard-cockpit__rank-row:first-child { border-top: none; }

.dashboard-cockpit__rank-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-cockpit__rank-index {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #0f766e;
  background: rgba(20, 184, 166, 0.12);
}

.dashboard-cockpit__rank-title { font-size: 14px; font-weight: 600; color: #0f172a; }

.dashboard-cockpit__rank-side {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #64748b;
  font-size: 13px;
}

.dashboard-cockpit__rank-score { font-weight: 700; color: #0f172a; }

html.dark .dashboard-cockpit { color: #e2e8f0; }
html.dark .dashboard-cockpit__status-text,
html.dark .dashboard-cockpit__summary-meta,
html.dark .dashboard-cockpit__section-aside,
html.dark .dashboard-cockpit__metric-sub,
html.dark .dashboard-cockpit__metric-label,
html.dark .dashboard-cockpit__fact-label { color: #94a3b8; }
html.dark .dashboard-cockpit__status-title,
html.dark .dashboard-cockpit__rank-title,
html.dark .dashboard-cockpit__rank-score { color: #f8fafc; }

@media (max-width: 1279px) {
  .dashboard-cockpit__trend-grid,
  .dashboard-cockpit__grid--double { grid-template-columns: 1fr; }
}

@media (max-width: 767px) {
  .dashboard-cockpit__metric-strip { grid-template-columns: 1fr 1fr; }
  .dashboard-cockpit__section-title { font-size: 20px; }
}
</style>
