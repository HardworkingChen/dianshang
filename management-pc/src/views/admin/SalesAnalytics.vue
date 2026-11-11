<template>
  <div v-loading="loading" class="space-y-6 analytics-ui-page analytics-page-shell sales-compact-page">
    <AnalyticsPageHero
      kicker="经营洞察"
      title="销售分析"
      summary="看营收、订单、爆品和品类结构。"
      :meta="salesHeroMeta"
      :chips="['营收', '订单', '爆品', '品类结构']"
      :highlights="salesHeroHighlights"
    />

    <section class="analytics-metric-strip">
      <article v-for="item in salesSummaryCards" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <PageSectionTabs
      v-model="salesActiveTab"
      primary-label="管理端"
      page-label="销售分析"
      title="经营视图"
      description="趋势、爆品、结构。"
      :tabs="salesTabs"
      :active-label="salesActiveTabInfo.label"
    />

    <div v-if="salesActiveTab === 'overview'" class="sales-overview-grid">
      <section class="analytics-panel sales-panel sales-chart-panel">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">趋势</div>
            <h3 class="sales-panel__title">营收与订单趋势</h3>
          </div>
          <div class="sales-panel__note">{{ trendNarrative }}</div>
        </div>
        <div class="sales-chart-stage">
          <div v-if="recentStats.length" ref="mainChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无趋势数据" :image-size="84" />
        </div>
        <div class="sales-kpi-row">
          <article class="sales-kpi-chip">
            <span>阶段涨幅</span>
            <strong>{{ formatPercent(revenueGrowth) }}</strong>
          </article>
          <article class="sales-kpi-chip">
            <span>近期订单</span>
            <strong>{{ formatNumber(totalOrders) }}</strong>
          </article>
          <article class="sales-kpi-chip">
            <span>平均客单价</span>
            <strong>{{ formatCurrency(avgOrderValue) }}</strong>
          </article>
        </div>
      </section>

      <section class="analytics-panel sales-panel sales-focus-panel">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">重点</div>
            <h3 class="sales-panel__title">当前重点</h3>
          </div>
          <div class="sales-panel__note">依据、数据、结论。</div>
        </div>
        <div class="sales-focus-list">
          <article v-for="item in salesFocusRows" :key="item.label" class="sales-focus-item">
            <span class="sales-focus-item__label">{{ item.label }}</span>
            <strong class="sales-focus-item__value">{{ item.value }}</strong>
            <p class="sales-focus-item__text">{{ item.note }}</p>
          </article>
        </div>
      </section>

      <section class="analytics-panel sales-panel sales-products-panel">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">爆品</div>
            <h3 class="sales-panel__title">营收拉动商品</h3>
          </div>
          <div class="sales-panel__note">{{ visibleHotProductRows.length }} 项</div>
        </div>
        <div v-if="visibleHotProductRows.length" class="sales-product-list">
          <article v-for="(item, index) in visibleHotProductRows" :key="`${getHotProductName(item)}-${index}`" class="sales-product-row">
            <div class="sales-product-row__rank">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="sales-product-row__body">
              <div class="sales-product-row__name">{{ getHotProductName(item) }}</div>
              <div class="sales-product-row__meta">销量 {{ formatNumber(item.salesCount || item.sales_count || 0) }}</div>
            </div>
            <span class="sales-product-row__badge">{{ getCategoryName(item) }}</span>
          </article>
        </div>
        <div v-else class="sales-empty-shell">
          <el-empty description="暂无热销商品数据" :image-size="72" />
        </div>
      </section>

      <section class="analytics-panel sales-panel sales-structure-panel">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">品类</div>
            <h3 class="sales-panel__title">品类贡献</h3>
          </div>
          <div class="sales-panel__note">{{ categoryRows.length }} 个分类</div>
        </div>
        <div class="sales-category-highlight">
          <span>结构判断</span>
          <strong>{{ structureInsight }}</strong>
          <p>{{ bestCategory ? `${getCategoryName(bestCategory)} 占比 ${formatPercent(topCategoryShare)}。` : '等待分类贡献数据回流。' }}</p>
        </div>
        <div v-if="topCategoryRows.length" class="sales-category-list">
          <article v-for="item in topCategoryRows" :key="item.name" class="sales-category-row">
            <div class="sales-category-row__top">
              <span>{{ item.name }}</span>
              <strong>{{ item.share }}</strong>
            </div>
            <div class="sales-category-row__track">
              <div
                class="sales-category-row__fill"
                :style="{ width: item.shareValue ? `${Math.max(item.shareValue * 100, 6)}%` : '0%' }"
              ></div>
            </div>
            <div class="sales-category-row__bottom">销量 {{ item.sales }}</div>
          </article>
        </div>
        <div v-else class="sales-empty-shell">
          <el-empty description="暂无品类贡献数据" :image-size="72" />
        </div>
      </section>
    </div>

    <section v-else-if="salesActiveTab === 'trend'" class="sales-trend-grid">
      <article class="analytics-panel sales-panel sales-trend-main">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">复盘</div>
            <h3 class="sales-panel__title">量价变化复盘</h3>
          </div>
          <div class="sales-panel__note">营收、订单、客单价。</div>
        </div>
        <div class="sales-chart-stage sales-chart-stage--tall">
          <div v-if="recentStats.length" ref="mainChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无趋势数据" :image-size="88" />
        </div>
      </article>

      <article class="analytics-panel sales-panel sales-trend-side">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">判断</div>
            <h3 class="sales-panel__title">趋势判断</h3>
          </div>
          <div class="sales-panel__note">保留四个判断点。</div>
        </div>
        <div class="sales-trend-stack">
          <article v-for="item in trendFocusRows" :key="item.label" class="sales-trend-item">
            <span class="sales-trend-item__label">{{ item.label }}</span>
            <strong class="sales-trend-item__value">{{ item.value }}</strong>
            <p class="sales-trend-item__text">{{ item.note }}</p>
          </article>
        </div>
      </article>
    </section>

    <div v-else class="sales-category-grid">
      <section class="analytics-panel sales-panel">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">结构</div>
            <h3 class="sales-panel__title">品类销量分布</h3>
          </div>
          <div class="sales-panel__note">看占比和集中度。</div>
        </div>
        <div class="sales-category-stage">
          <div v-if="categoryRows.length" ref="categoryChartRef" class="h-full w-full"></div>
          <el-empty v-else description="暂无品类结构数据" :image-size="88" />
        </div>
      </section>

      <section class="analytics-panel sales-panel">
        <div class="sales-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">明细</div>
            <h3 class="sales-panel__title">贡献明细</h3>
          </div>
          <div class="sales-panel__note">图表看结构，表格补明细。</div>
        </div>
        <div class="sales-category-summary-grid">
          <article class="sales-summary-tile">
            <span>最高贡献类目</span>
            <strong>{{ bestCategory ? getCategoryName(bestCategory) : '待回流' }}</strong>
          </article>
          <article class="sales-summary-tile">
            <span>头部占比</span>
            <strong>{{ formatPercent(topCategoryShare) }}</strong>
          </article>
          <article class="sales-summary-tile sales-summary-tile--wide">
            <span>简短结论</span>
            <strong>{{ structureInsight }}</strong>
          </article>
        </div>
        <el-table
          :data="categoryRows"
          class="!mt-5 !bg-transparent"
          :header-cell-style="{ background: 'transparent', color: 'inherit' }"
          :row-style="{ background: 'transparent' }"
        >
          <el-table-column prop="name" label="分类" min-width="180" />
          <el-table-column prop="sales" label="销量" width="150" />
          <el-table-column prop="share" label="占比" width="140" />
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useRoute, useRouter } from 'vue-router'
import { getAdminSalesAnalytics } from '../../api/admin'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import PageSectionTabs from '../../components/PageSectionTabs.vue'
import { getAnalyticsChartTheme } from '../../utils/chartTheme'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const salesData = ref({})
const hotProducts = ref([])
const recentStats = ref([])
const categorySales = ref([])

const mainChartRef = ref(null)
const categoryChartRef = ref(null)

let charts = []
let themeObserver = null
let compactQuery = null

const compactMode = ref(false)
const syncCompactMode = () => {
  compactMode.value = compactQuery?.matches || false
}

const salesTabs = [
  { key: 'overview', label: '经营总览', hint: '趋势 + 爆品', description: '先看总量、趋势、热销商品和结构摘要。' },
  { key: 'trend', label: '趋势复盘', hint: '量价变化', description: '用营收、订单和客单价解释销售变化。' },
  { key: 'category', label: '品类结构', hint: '贡献拆解', description: '看分类销量占比和结构集中度。' },
]
const salesTabKeySet = new Set(salesTabs.map(item => item.key))

function normalizeSalesTab(value) {
  const tab = String(value || '').trim()
  return salesTabKeySet.has(tab) ? tab : salesTabs[0].key
}

const salesActiveTab = ref(normalizeSalesTab(route.query.tab))
const salesActiveTabInfo = computed(() => salesTabs.find(item => item.key === salesActiveTab.value) || salesTabs[0])

const totalRevenue = computed(() => Number(salesData.value.totalRevenue || 0))
const totalOrders = computed(() => {
  if (salesData.value.totalOrders != null) return Number(salesData.value.totalOrders || 0)
  return recentStats.value.reduce((sum, item) => sum + getCount(item), 0)
})
const topProduct = computed(() => hotProducts.value[0] || null)
const topProductName = computed(() => getHotProductName(topProduct.value) || '等待热销商品')
const topProductSales = computed(() => Number(topProduct.value?.salesCount || topProduct.value?.sales_count || 0))
const bestCategory = computed(() => {
  if (!categorySales.value.length) return null
  return [...categorySales.value].sort((left, right) => getCategoryValue(right) - getCategoryValue(left))[0]
})
const totalCategorySales = computed(() => categorySales.value.reduce((sum, item) => sum + getCategoryValue(item), 0))
const avgOrderValue = computed(() => {
  if (salesData.value.avgOrderValue != null) return Number(salesData.value.avgOrderValue || 0)
  return totalOrders.value ? totalRevenue.value / totalOrders.value : 0
})
const latestTrend = computed(() => recentStats.value[recentStats.value.length - 1] || null)
const firstTrend = computed(() => recentStats.value[0] || null)
const revenueGrowth = computed(() => {
  const start = getAmount(firstTrend.value)
  const end = getAmount(latestTrend.value)
  return start ? (end - start) / start : 0
})
const topCategoryShare = computed(() => {
  if (!bestCategory.value || !totalCategorySales.value) return 0
  return getCategoryValue(bestCategory.value) / totalCategorySales.value
})
const structureInsight = computed(() => {
  if (!bestCategory.value) return '等待分类数据'
  if (topCategoryShare.value >= 0.4) return '头部集中度偏高'
  if (topCategoryShare.value >= 0.26) return '头部贡献较明显'
  return '结构相对均衡'
})
const salesHeadMeta = computed(() => {
  if (!totalRevenue.value) {
    return '这里继续拆到趋势、拉动商品和品类占比，而不是只停留在销售总额。'
  }
  const productText = topProduct.value ? `${topProductName.value} 是当前主要拉动商品` : '当前热销商品还在回流'
  const categoryText = bestCategory.value ? `${getCategoryName(bestCategory.value)} 占比 ${formatPercent(topCategoryShare.value)}` : '品类结构继续观察'
  return `${productText}，${categoryText}。`
})
const salesHeroMeta = computed(() => {
  const productText = topProduct.value ? `爆品 ${topProductName.value}` : '等待爆品回流'
  const categoryText = bestCategory.value ? `头部类目 ${getCategoryName(bestCategory.value)} ${formatPercent(topCategoryShare.value)}` : '等待品类结构'
  return `${productText} · ${categoryText}`
})

const salesSummaryCards = computed(() => [
  {
    label: '总销售额',
    value: formatCurrency(totalRevenue.value),
    sub: '当前窗口营收',
  },
  {
    label: '近期订单数',
    value: formatNumber(totalOrders.value),
    sub: '配合趋势判断量变',
  },
  {
    label: '平均客单价',
    value: formatCurrency(avgOrderValue.value),
    sub: '区分量价贡献',
  },
  {
    label: '头部类目占比',
    value: formatPercent(topCategoryShare.value),
    sub: '结构集中度',
  },
])
const salesHeroHighlights = computed(() => [
  {
    label: '总销售额',
    value: formatCurrency(totalRevenue.value),
    note: '当前窗口营收',
    tone: totalRevenue.value > 0 ? 'success' : undefined,
  },
  {
    label: '近期订单数',
    value: formatNumber(totalOrders.value),
    note: recentStats.value.length ? `趋势窗口 ${recentStats.value.length} 天` : '等待趋势数据',
  },
  {
    label: '平均客单价',
    value: formatCurrency(avgOrderValue.value),
    note: topProduct.value ? `热销 ${topProductName.value}` : '等待热销商品数据',
  },
  {
    label: '头部类目占比',
    value: formatPercent(topCategoryShare.value),
    note: bestCategory.value ? `${getCategoryName(bestCategory.value)} 当前领先` : '等待品类结构回流',
  },
])

const hotProductRows = computed(() => hotProducts.value.slice(0, 4))
const visibleHotProductRows = computed(() => (compactMode.value ? hotProductRows.value.slice(0, 3) : hotProductRows.value))
const categoryRows = computed(() => categorySales.value.map(item => {
  const rawSales = getCategoryValue(item)
  const shareValue = totalCategorySales.value ? rawSales / totalCategorySales.value : 0
  return {
    name: getCategoryName(item),
    sales: formatNumber(rawSales),
    share: formatPercent(shareValue),
    shareValue,
  }
}))
const topCategoryRows = computed(() => categoryRows.value.slice(0, 4))

const salesFocusRows = computed(() => [
  {
    label: '传统盲区',
    value: '只看总额',
    note: '容易忽略爆品拉动、活动波动和类目集中度。',
  },
  {
    label: '当前爆品',
    value: topProductName.value,
    note: topProduct.value
      ? `销量 ${formatNumber(topProductSales.value)}，可以直接解释当前营收由谁拉动。`
      : '等待热销商品数据回流。',
  },
  {
    label: '趋势变化',
    value: formatPercent(revenueGrowth.value),
    note: recentStats.value.length
      ? `窗口从 ${formatCurrency(getAmount(firstTrend.value))} 到 ${formatCurrency(getAmount(latestTrend.value))}。`
      : '等待趋势数据回流。',
  },
  {
    label: '结构判断',
    value: structureInsight.value,
    note: bestCategory.value
      ? `${getCategoryName(bestCategory.value)} 当前占比 ${formatPercent(topCategoryShare.value)}。`
      : '等待品类贡献数据回流。',
  },
])

const trendFocusRows = computed(() => [
  {
    label: '窗口起点',
    value: formatCurrency(getAmount(firstTrend.value)),
    note: '先确认本轮变化的起始基线。',
  },
  {
    label: '窗口终点',
    value: formatCurrency(getAmount(latestTrend.value)),
    note: '与订单数一起判断涨幅来源。',
  },
  {
    label: '订单规模',
    value: formatNumber(totalOrders.value),
    note: '用于区分订单量和客单价对营收的影响。',
  },
  {
    label: '简短结论',
    value: structureInsight.value,
    note: salesHeadMeta.value,
  },
])

const trendNarrative = computed(() => {
  if (!recentStats.value.length) {
    return '暂无趋势数据。'
  }
  return `${formatCurrency(getAmount(firstTrend.value))} → ${formatCurrency(getAmount(latestTrend.value))} · ${formatPercent(revenueGrowth.value)}`
})

function formatNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '0'
}

function formatCurrency(value) {
  const number = Number(value || 0)
  return `¥${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value) {
  const number = Number(value || 0)
  return `${(number * 100).toFixed(number * 100 >= 10 ? 1 : 2)}%`
}

function getDate(item) {
  return item?.date || item?.orderDate || '--'
}

function getAmount(item) {
  return Number(item?.amount || item?.revenue || item?.totalRevenue || 0)
}

function getCount(item) {
  return Number(item?.count || item?.orders || item?.orderCount || 0)
}

function getCategoryName(item) {
  return item?.category_name || item?.categoryName || item?.name || '未命名分类'
}

function getCategoryValue(item) {
  return Number(item?.total_sales || item?.totalSales || item?.salesCount || item?.count || 0)
}

function getHotProductName(item) {
  return item?.name || item?.productName || item?.product_name || '未命名商品'
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getAdminSalesAnalytics()
    const data = res || {}
    salesData.value = data
    hotProducts.value = data.hotProducts || []
    recentStats.value = data.recentStats || []
    categorySales.value = data.categorySales || []
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

  if (mainChartRef.value && recentStats.value.length) {
    const chart = echarts.init(mainChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 0, data: ['营收', '订单数'], textStyle: { color: textColor } },
      grid: { left: '4%', right: '4%', bottom: 48, top: 44, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: recentStats.value.map(getDate),
        axisLabel: { color: textColor, margin: 14 },
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: { color: textColor },
      },
      series: [
        {
          name: '营收',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: palette.primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,130,246,0.24)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' },
            ]),
          },
          data: recentStats.value.map(getAmount),
        },
        {
          name: '订单数',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: { color: 'rgba(8,145,178,0.52)', borderRadius: [6, 6, 0, 0] },
          data: recentStats.value.map(getCount),
        },
      ],
    })
    charts.push(chart)
  }

  if (categoryChartRef.value && categorySales.value.length) {
    const chart = echarts.init(categoryChartRef.value)
    const colors = [palette.primary, palette.secondary, palette.success, palette.warning, '#38bdf8', '#0f766e', '#64748b']
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 8, type: 'scroll', textStyle: { color: textColor } },
      series: [{
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '42%'],
        itemStyle: { borderRadius: 10, borderColor: surfaceColor, borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: textColor } },
        data: categorySales.value.map((item, index) => ({
          value: getCategoryValue(item),
          name: getCategoryName(item),
          itemStyle: { color: colors[index % colors.length] },
        })),
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
    const nextTab = normalizeSalesTab(value)
    if (nextTab !== salesActiveTab.value) {
      salesActiveTab.value = nextTab
    }
  }
)

watch(salesActiveTab, value => {
  const nextTab = normalizeSalesTab(value)
  const currentTab = normalizeSalesTab(route.query.tab)
  if (nextTab !== currentTab) {
    router.replace({
      query: {
        ...route.query,
        tab: nextTab === salesTabs[0].key ? undefined : nextTab,
      },
    })
  }
  nextTick(() => renderCharts())
})

onMounted(async () => {
  compactQuery = window.matchMedia('(max-width: 768px)')
  compactQuery.addEventListener('change', syncCompactMode)
  syncCompactMode()
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
  if (compactQuery) {
    compactQuery.removeEventListener('change', syncCompactMode)
  }
  window.removeEventListener('resize', handleResize)
  themeObserver?.disconnect()
  charts.forEach(chart => chart?.dispose())
})
</script>

<style scoped>
.sales-compact-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 18px;
  align-items: end;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.sales-compact-head__kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2563eb;
}

.sales-compact-head__title {
  margin: 8px 0 0;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.12;
  color: #0f172a;
}

.sales-compact-head__summary {
  margin: 10px 0 0;
  max-width: 680px;
  font-size: 14px;
  line-height: 1.75;
  color: #475569;
}

.sales-compact-head__aside {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.96);
}

.sales-compact-head__tag {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
}

.sales-compact-head__aside p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
}

.sales-overview-grid,
.sales-trend-grid,
.sales-category-grid {
  display: grid;
  gap: 16px;
}

.sales-overview-grid {
  grid-template-columns: minmax(0, 1.16fr) minmax(320px, 0.84fr);
}

.sales-trend-grid,
.sales-category-grid {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
}

.sales-products-panel,
.sales-structure-panel {
  min-width: 0;
}

.sales-overview-grid .sales-products-panel,
.sales-overview-grid .sales-structure-panel {
  grid-column: span 1;
}

.sales-panel {
  padding: 20px 22px;
  min-width: 0;
}

.sales-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.sales-panel__title {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a;
}

.sales-panel__note {
  max-width: 240px;
  font-size: 13px;
  line-height: 1.7;
  text-align: right;
  color: #64748b;
}

.sales-chart-stage,
.sales-category-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 320px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
  overflow: hidden;
}

.sales-chart-stage--tall {
  height: 360px;
}

.sales-kpi-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.sales-kpi-chip,
.sales-focus-item,
.sales-trend-item,
.sales-category-highlight,
.sales-summary-tile {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.92);
}

.sales-kpi-chip {
  padding: 12px 14px;
}

.sales-kpi-chip span,
.sales-focus-item__label,
.sales-trend-item__label,
.sales-category-highlight span,
.sales-summary-tile span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.sales-kpi-chip strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  line-height: 1.35;
  color: #0f172a;
}

.sales-focus-list,
.sales-trend-stack,
.sales-product-list,
.sales-category-list {
  display: grid;
  gap: 12px;
}

.sales-focus-item,
.sales-trend-item {
  padding: 14px 16px;
}

.sales-focus-item__value,
.sales-trend-item__value,
.sales-category-highlight strong,
.sales-summary-tile strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  color: #0f172a;
}

.sales-focus-item__text,
.sales-trend-item__text,
.sales-category-highlight p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.75;
  color: #475569;
}

.sales-product-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.84);
}

.sales-product-row__rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  font-size: 15px;
  font-weight: 700;
}

.sales-product-row__body {
  min-width: 0;
}

.sales-product-row__name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.sales-product-row__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.sales-product-row__badge {
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 12px;
  color: #334155;
}

.sales-category-highlight {
  padding: 14px 16px;
  margin-bottom: 12px;
}

.sales-empty-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
}

.sales-category-row {
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.sales-category-row__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: #334155;
}

.sales-category-row__top strong {
  font-size: 14px;
  color: #0f172a;
}

.sales-category-row__track {
  height: 8px;
  margin-top: 10px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.8);
  overflow: hidden;
}

.sales-category-row__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb, #0ea5e9);
}

.sales-category-row__bottom {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}

.sales-category-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sales-summary-tile {
  padding: 14px 16px;
}

.sales-summary-tile--wide {
  grid-column: 1 / -1;
}

.dark .sales-compact-head {
  border-bottom-color: rgba(71, 85, 105, 0.46);
}

.dark .sales-compact-head__title,
.dark .sales-panel__title,
.dark .sales-kpi-chip strong,
.dark .sales-focus-item__value,
.dark .sales-trend-item__value,
.dark .sales-category-highlight strong,
.dark .sales-summary-tile strong,
.dark .sales-product-row__name,
.dark .sales-category-row__top strong {
  color: #f8fafc;
}

.dark .sales-compact-head__summary,
.dark .sales-compact-head__aside p,
.dark .sales-focus-item__text,
.dark .sales-trend-item__text,
.dark .sales-category-highlight p,
.dark .sales-product-row__meta,
.dark .sales-category-row__bottom {
  color: #cbd5e1;
}

.dark .sales-panel__note,
.dark .sales-kpi-chip span,
.dark .sales-focus-item__label,
.dark .sales-trend-item__label,
.dark .sales-category-highlight span,
.dark .sales-summary-tile span {
  color: #94a3b8;
}

.dark .sales-compact-head__aside,
.dark .sales-chart-stage,
.dark .sales-category-stage,
.dark .sales-kpi-chip,
.dark .sales-focus-item,
.dark .sales-trend-item,
.dark .sales-category-highlight,
.dark .sales-summary-tile,
.dark .sales-empty-shell,
.dark .sales-product-row,
.dark .sales-category-row {
  border-color: rgba(71, 85, 105, 0.52);
  background: rgba(15, 23, 42, 0.54);
}

.dark .sales-compact-head__tag,
.dark .sales-product-row__badge {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(71, 85, 105, 0.52);
  color: #cbd5e1;
}

.dark .sales-product-row__rank {
  background: rgba(37, 99, 235, 0.2);
  color: #bfdbfe;
}

.dark .sales-category-row__track {
  background: rgba(30, 41, 59, 0.84);
}

@media (max-width: 1180px) {
  .sales-compact-head,
  .sales-overview-grid,
  .sales-trend-grid,
  .sales-category-grid {
    grid-template-columns: 1fr;
  }

  .sales-panel__note {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 768px) {
  .sales-panel {
    padding: 16px;
  }

  .sales-compact-head__title {
    font-size: 28px;
  }

  .sales-kpi-row,
  .sales-category-summary-grid {
    grid-template-columns: 1fr;
  }

  .sales-chart-stage,
  .sales-category-stage,
  .sales-chart-stage--tall {
    height: 280px;
  }

  .sales-product-row {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .sales-product-row__badge {
    grid-column: 2;
    width: fit-content;
  }
}
</style>
