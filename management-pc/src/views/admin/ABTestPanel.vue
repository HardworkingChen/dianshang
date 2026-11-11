<template>
  <div v-loading="loading" class="space-y-6 analytics-ui-page ab-test-page">
    <section class="ab-compact-head">
      <div>
        <div class="ab-compact-head__kicker">实验验证</div>
        <h1 class="ab-compact-head__title">A/B 实验分析</h1>
        <p class="ab-compact-head__summary">
          同一批信号源下只调整权重，重点展示曝光、点击、购买和分层 Lift，不再展开浏览引导和流程讲解。
        </p>
      </div>
      <div class="ab-compact-head__aside">
        <span class="ab-compact-head__tag">传统电商常只看平均转化</span>
        <p>{{ abHeadMeta }}</p>
        <div class="ab-compact-head__actions">
          <el-button @click="fetchReport">刷新数据</el-button>
          <el-button type="danger" plain class="!border-rose-200 !bg-white !text-rose-600" @click="handleReset">重置实验</el-button>
        </div>
      </div>
    </section>

    <section class="analytics-metric-strip">
      <article v-for="item in abSummaryCards" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <PageSectionTabs
      v-model="abActiveTab"
      :tabs="abTabs"
      primary-label="管理端"
      page-label="A/B 实验"
      title="实验视图"
      description="总览、分层、验证。"
      :active-label="abActiveTabInfo.label"
    />

    <section v-if="abActiveTab === 'overview'" class="ab-test-summary-grid">
      <article
        v-for="item in abPlainSummaryCards"
        :key="item.title"
        class="panel-card ab-test-summary-card p-5"
      >
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{{ item.eyebrow }}</div>
        <h3 class="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{{ item.title }}</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ item.description }}</p>
        <div class="ab-test-summary-card__result mt-4">{{ item.result }}</div>
      </article>
    </section>

    <div v-if="abActiveTab === 'overview'" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div
        v-for="g in groups"
        :key="g.code"
        class="panel-card ab-test-group-card p-6 transition-all"
        :class="g.code === bestOverallGroup?.code ? 'ab-test-group-card--winner' : ''"
      >
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold" :class="groupColors[g.code]">
            {{ g.code === 'control' ? 'A' : g.code === 'hybrid' ? 'B' : 'C' }}
          </div>
          <div>
            <div class="font-bold text-gray-800 dark:text-gray-100">{{ g.description }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ g.code }}</div>
          </div>
          <el-tag class="ml-auto" size="small" effect="light">{{ g.dataSourceLabel }}</el-tag>
        </div>

        <div class="ab-test-strategy-box mb-4">
          <div class="font-semibold text-slate-900 dark:text-slate-100">权重方案：{{ groupStrategyMap[g.code]?.weights || '按后端返回策略' }}</div>
          <div class="mt-1">流量占比：{{ groupStrategyMap[g.code]?.split || '--' }} · 作用：{{ groupStrategyMap[g.code]?.role || '--' }}</div>
        </div>

        <div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div class="ab-test-metric-box">
            <div class="text-gray-500 dark:text-gray-400">独立用户</div>
            <div class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ formatNumber(g.uniqueUsers) }}</div>
          </div>
          <div class="ab-test-metric-box">
            <div class="text-gray-500 dark:text-gray-400">总曝光</div>
            <div class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ formatNumber(g.totalExposures) }}</div>
          </div>
          <div class="ab-test-metric-box">
            <div class="text-gray-500 dark:text-gray-400">总点击</div>
            <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{{ formatNumber(g.totalClicks) }}</div>
          </div>
          <div class="ab-test-metric-box">
            <div class="text-gray-500 dark:text-gray-400">总购买</div>
            <div class="text-xl font-bold text-green-600 dark:text-green-400">{{ formatNumber(g.totalPurchases) }}</div>
          </div>
        </div>

        <div class="mt-4 space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">CTR</span>
            <span class="font-bold" :class="highlightBest('ctr', g.ctr)">{{ formatPercent(g.ctr) }}</span>
          </div>
          <el-progress :percentage="toPercent(g.ctr)" :show-text="false" :stroke-width="8" :color="groupBarColors[g.code]" class="!rounded-full" />

          <div class="mt-3 flex justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">点击后转化率</span>
            <span class="font-bold" :class="highlightBest('conversionRate', g.conversionRate)">{{ formatPercent(g.conversionRate) }}</span>
          </div>
          <el-progress :percentage="toPercent(g.conversionRate)" :show-text="false" :stroke-width="8" :color="groupBarColors[g.code]" class="!rounded-full" />

          <div class="mt-3 flex justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">总体转化</span>
            <span class="font-bold" :class="highlightBest('overallConversion', g.overallConversion)">{{ formatPercent(g.overallConversion, 4) }}</span>
          </div>
        </div>
      </div>
    </div>

    <section v-if="abActiveTab === 'overview'" class="panel-card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">相对基线提升</h3>
        <el-tag type="info" effect="plain">A 组 = 传统热门榜</el-tag>
      </div>
      <div v-if="overviewLiftRows.length" class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article
          v-for="row in overviewLiftRows"
          :key="row.groupCode"
          class="ab-test-lift-card"
        >
          <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.groupLabel }}</div>
          <div class="mt-2 flex flex-wrap gap-2 text-xs">
            <el-tag :type="liftTagType(row.ctrLift)" effect="light">CTR {{ formatLift(row.ctrLift) }}</el-tag>
            <el-tag :type="liftTagType(row.conversionLift)" effect="light">转化率 {{ formatLift(row.conversionLift) }}</el-tag>
            <el-tag :type="liftTagType(row.purchaseLift)" effect="light">购买量 {{ formatLift(row.purchaseLift) }}</el-tag>
          </div>
          <p class="mt-2 text-xs leading-6 text-gray-500 dark:text-gray-400">
            基线: {{ row.baselineLabel }}
          </p>
        </article>
      </div>
      <el-empty v-else description="暂无可计算的对照差异" :image-size="90" />
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="panel-card p-6">
        <h3 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">各组指标对比</h3>
        <div v-if="groups.length" ref="barChartRef" class="h-96 w-full"></div>
        <div v-else class="h-96 flex items-center justify-center">
          <el-empty
            description="暂无可用于对比的实验组数据"
            :image-size="96"
          />
        </div>
      </div>
      <div class="panel-card p-6">
        <h3 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">漏斗转化分析</h3>
        <div v-if="groups.length" ref="funnelChartRef" class="h-96 w-full"></div>
        <div v-else class="h-96 flex items-center justify-center">
          <el-empty
            description="暂无漏斗数据，请先触发推荐曝光与行为事件"
            :image-size="96"
          />
        </div>
      </div>
    </div>

    <div
      v-if="abActiveTab === 'lift'"
      class="grid grid-cols-1 gap-6 xl:grid-cols-2"
    >
      <section class="panel-card p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">分层差异（新客 / 老客）</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">所有效果都对照基线组，不只看总体平均值。</p>
          </div>
          <el-tag type="success" effect="light">生命周期分层</el-tag>
        </div>
        <el-alert
          v-if="!stratifiedLifecycleRows.length"
          class="mt-4"
          type="warning"
          show-icon
          :closable="false"
          title="当前暂无分层数据"
          description="请优先使用 recommendation_exposure 事实数据源（mysql）进行对照验证。"
        />
        <el-table v-else :data="stratifiedLifecycleRows" stripe class="mt-4">
          <el-table-column prop="segmentLabel" label="人群层" min-width="120" />
          <el-table-column prop="groupLabel" label="实验组" min-width="120" />
          <el-table-column label="曝光" width="100" align="right">
            <template #default="{ row }">{{ formatNumber(row.totalExposures) }}</template>
          </el-table-column>
          <el-table-column label="总体转化" width="110" align="right">
            <template #default="{ row }">{{ formatPercent(row.overallConversion, 4) }}</template>
          </el-table-column>
          <el-table-column label="相对基线差异" width="130" align="right">
            <template #default="{ row }">
              <span :class="liftTextClass(row.liftVsControl)">{{ formatLift(row.liftVsControl) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="panel-card p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">分层差异（高客单 / 低客单）</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">重点观察高价值人群是否真正受益。</p>
          </div>
          <el-tag type="warning" effect="light">价值分层</el-tag>
        </div>
        <el-alert
          v-if="!stratifiedValueRows.length"
          class="mt-4"
          type="warning"
          show-icon
          :closable="false"
          title="当前暂无客单分层数据"
          description="建议补齐 ORDER 类型 recommendation_event 后查看高客单分层结果。"
        />
        <el-table v-else :data="stratifiedValueRows" stripe class="mt-4">
          <el-table-column prop="segmentLabel" label="价值层" min-width="120" />
          <el-table-column prop="groupLabel" label="实验组" min-width="120" />
          <el-table-column label="曝光" width="100" align="right">
            <template #default="{ row }">{{ formatNumber(row.totalExposures) }}</template>
          </el-table-column>
          <el-table-column label="总体转化" width="110" align="right">
            <template #default="{ row }">{{ formatPercent(row.overallConversion, 4) }}</template>
          </el-table-column>
          <el-table-column label="相对基线差异" width="130" align="right">
            <template #default="{ row }">
              <span :class="liftTextClass(row.liftVsControl)">{{ formatLift(row.liftVsControl) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <section
      v-if="abActiveTab === 'script'"
      class="panel-card p-6"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">验证与回滚流程</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">建议至少验证 1 条快反馈路径和 1 条风险回滚路径。</p>
        </div>
        <el-tag type="danger" effect="light">上线检查</el-tag>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="ab-test-script-card ab-test-script-card--rose">
          <div class="text-sm font-semibold text-rose-700 dark:text-rose-300">负反馈快路径（5-10 分钟）</div>
          <p class="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
            在用户侧触发“不感兴趣/短停留/跳出”后，立即刷新推荐预览，确认同类商品权重下降与结果多样化恢复。
          </p>
        </article>
        <article class="ab-test-script-card ab-test-script-card--amber">
          <div class="text-sm font-semibold text-amber-700 dark:text-amber-300">阈值触发自动回滚</div>
          <p class="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
            在测试环境触发退款率超阈值，确认策略能从新版本自动降级到上个稳定版本，并验证核心指标回稳。
          </p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getABTestReport, resetABTest } from '../../api/recommend'
import PageSectionTabs from '../../components/PageSectionTabs.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const abTabs = [
  { key: 'overview', label: '实验总览', hint: '指标', description: '核心结果与组间对比。' },
  { key: 'lift', label: '分群对比', hint: 'Lift', description: '新老客、高低客单分层差异。' },
  { key: 'script', label: '验证检查', hint: '回滚', description: '保留必要验证与回滚提示。' },
]
const abTabKeySet = new Set(abTabs.map(item => item.key))
const normalizeAbTab = (value) => {
  const tab = String(value || '').trim()
  return abTabKeySet.has(tab) ? tab : abTabs[0].key
}
const abActiveTab = ref(normalizeAbTab(route.query.tab))
const groups = ref([])
const barChartRef = ref(null)
const funnelChartRef = ref(null)
let charts = []
let themeObserver = null
let echartsModule = null

const groupColors = { control: 'bg-gray-500', hybrid: 'bg-blue-500', cf_heavy: 'bg-emerald-500' }
const groupBarColors = { control: '#6b7280', hybrid: '#3b82f6', cf_heavy: '#10b981' }
const groupOrder = ['control', 'hybrid', 'cf_heavy']
const lifecycleSegmentOrder = ['new_user', 'returning_user']
const valueSegmentOrder = ['high_aov', 'low_aov']
const lifecycleLabelMap = { new_user: '新客', returning_user: '老客' }
const valueLabelMap = { high_aov: '高客单', low_aov: '低客单' }
const groupLabelMap = { control: 'A 对照组', hybrid: 'B 标准混合组', cf_heavy: 'C 协同强化组' }
const dataSourceLabelMap = { mysql: '事实层', redis: '运行态', historical: '历史回补', degraded: '降级' }
const groupStrategyMap = {
  control: {
    split: '30%',
    weights: 'score = 1.00Hot',
    role: 'baseline',
  },
  hybrid: {
    split: '40%',
    weights: 'score = 0.40CF + 0.30CB + 0.30Hot',
    role: 'default hybrid',
  },
  cf_heavy: {
    split: '30%',
    weights: 'score = 0.55CF + 0.20CB + 0.25Hot',
    role: 'cf heavy',
  },
}
const controlGroup = computed(() => groups.value.find(g => g.code === 'control') || null)
const totalExposureCount = computed(() => groups.value.reduce((sum, item) => sum + numberVal(item.totalExposures), 0))

const numberVal = (value) => Number(value || 0)
const byOrder = (order, value) => {
  const index = order.indexOf(value)
  return index < 0 ? order.length + 1 : index
}

const toPercent = (ratio) => {
  const value = numberVal(ratio) * 100
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(value, 100))
}

const formatPercent = (ratio, digits = 2) => `${(numberVal(ratio) * 100).toFixed(digits)}%`
const formatNumber = (value) => Number(value || 0).toLocaleString()
const formatLift = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--'
  }
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

const bestGroupBy = (field) => {
  const candidates = groups.value.filter(group => Number.isFinite(numberVal(group[field])))
  if (!candidates.length) {
    return null
  }
  return candidates.reduce((best, item) => (numberVal(item[field]) > numberVal(best[field]) ? item : best), candidates[0])
}

const calcLift = (current, baseline) => {
  const base = numberVal(baseline)
  if (base <= 0) {
    return null
  }
  return (numberVal(current) - base) / base
}

const liftTagType = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'info'
  }
  if (value > 0) {
    return 'success'
  }
  if (value < 0) {
    return 'danger'
  }
  return 'info'
}

const liftTextClass = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'text-gray-500 dark:text-gray-400'
  }
  if (value > 0) {
    return 'text-emerald-600 dark:text-emerald-400 font-semibold'
  }
  if (value < 0) {
    return 'text-rose-600 dark:text-rose-400 font-semibold'
  }
  return 'text-gray-700 dark:text-gray-200'
}

const highlightBest = (field, value) => {
  const vals = groups.value.map(g => numberVal(g[field]))
  const max = Math.max(...vals)
  return numberVal(value) === max && max > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'
}

const normalizeGroups = (report = {}) => {
  return Object.entries(report)
    .map(([key, value]) => {
      const code = value?.groupCode || key
      return {
        ...value,
        code,
        dataSourceLabel: dataSourceLabelMap[value?.dataSource] || '未知',
      }
    })
    .sort((a, b) => byOrder(groupOrder, a.code) - byOrder(groupOrder, b.code))
}

const createStratifiedRows = (metricKey, segmentOrder, segmentLabelMapTarget) => {
  const controlGroup = groups.value.find(g => g.code === 'control')
  const controlMap = controlGroup?.[metricKey] || {}
  const rows = []

  groups.value.forEach(group => {
    const rawSegments = group?.[metricKey] || {}
    Object.values(rawSegments).forEach((segmentRow) => {
      const segmentCode = segmentRow?.segment || ''
      const controlSegment = controlMap?.[segmentCode]
      const currentOverall = numberVal(segmentRow?.overallConversion)
      const controlOverall = numberVal(controlSegment?.overallConversion)
      const liftVsControl = group.code === 'control'
        ? 0
        : controlOverall > 0
          ? (currentOverall - controlOverall) / controlOverall
          : null

      rows.push({
        ...segmentRow,
        segmentCode,
        segmentLabel: segmentLabelMapTarget[segmentCode] || segmentCode,
        groupCode: group.code,
        groupLabel: groupLabelMap[group.code] || group.code,
        overallConversion: currentOverall,
        liftVsControl,
      })
    })
  })

  return rows.sort((a, b) => {
    const segDiff = byOrder(segmentOrder, a.segmentCode) - byOrder(segmentOrder, b.segmentCode)
    if (segDiff !== 0) {
      return segDiff
    }
    return byOrder(groupOrder, a.groupCode) - byOrder(groupOrder, b.groupCode)
  })
}

const stratifiedLifecycleRows = computed(() => createStratifiedRows('stratifiedLifecycle', lifecycleSegmentOrder, lifecycleLabelMap))
const stratifiedValueRows = computed(() => createStratifiedRows('stratifiedValue', valueSegmentOrder, valueLabelMap))
const overviewLiftRows = computed(() => {
  const control = controlGroup.value
  if (!control) {
    return []
  }
  return groups.value
    .filter(group => group.code !== 'control')
    .map(group => ({
      groupCode: group.code,
      groupLabel: groupLabelMap[group.code] || group.code,
      baselineLabel: `${groupLabelMap.control} · CTR ${formatPercent(control.ctr)} · 转化率 ${formatPercent(control.conversionRate)}`,
      ctrLift: calcLift(group.ctr, control.ctr),
      conversionLift: calcLift(group.conversionRate, control.conversionRate),
      purchaseLift: calcLift(group.totalPurchases, control.totalPurchases),
    }))
})
const bestOverallGroup = computed(() => bestGroupBy('overallConversion'))
const bestOverallLift = computed(() => {
  const control = controlGroup.value
  const best = bestOverallGroup.value
  if (!control || !best) {
    return '等待有效样本'
  }
  if (best.code === control.code) {
    return '基线组暂时领先'
  }
  return `相对 A 组 ${formatLift(calcLift(best.overallConversion, control.overallConversion))}`
})
const abHeadMeta = computed(() => {
  const winner = bestOverallGroup.value
    ? `${groupLabelMap[bestOverallGroup.value.code] || bestOverallGroup.value.description} 当前领先`
    : '当前还在等待有效样本'
  return `${winner}，${bestOverallLift.value}，说明同信号源下调整权重已经能拉开结果差异。`
})
const abSummaryCards = computed(() => [
  {
    label: '累计曝光',
    value: formatNumber(totalExposureCount.value),
    sub: 'sample = total exposure',
  },
  {
    label: '当前领先',
    value: bestOverallGroup.value ? (groupLabelMap[bestOverallGroup.value.code] || bestOverallGroup.value.description) : '等待实验结果',
    sub: bestOverallGroup.value
      ? `overall_cvr = ${formatPercent(bestOverallGroup.value.overallConversion, 4)}`
      : 'sample not enough',
  },
  {
    label: '基线策略',
    value: controlGroup.value ? 'A 对照组' : '等待对照数据',
    sub: groupStrategyMap.control.weights,
  },
  {
    label: '领先幅度',
    value: bestOverallLift.value,
    sub: '统一比较 CTR / CVR / Purchase',
  },
])
const abPlainSummaryCards = computed(() => {
  const control = controlGroup.value
  const bestOverall = bestOverallGroup.value
  const bestCtr = bestGroupBy('ctr')
  const bestPurchase = bestGroupBy('totalPurchases')
  const bestLift = control && bestOverall
    ? calcLift(bestOverall.overallConversion, control.overallConversion)
    : null

  return [
    {
      eyebrow: '参数策略',
      title: '只改 score，不改信号链路',
      description: 'A = 1.00Hot；B = 0.40CF + 0.30CB + 0.30Hot；C = 0.55CF + 0.20CB + 0.25Hot。',
      result: 'same signal / same rule / different score',
    },
    {
      eyebrow: '评估口径',
      title: '指标 = CTR / CVR / overall_cvr / purchase',
      description: 'CTR = click / exposure；CVR = purchase / click；overall_cvr = purchase / exposure。',
      result: `sample = ${formatNumber(totalExposureCount.value)} exposure`,
    },
    {
      eyebrow: '当前结论',
      title: bestOverall ? `${groupLabelMap[bestOverall.code] || bestOverall.description} 当前领先` : '等待实验数据',
      description: bestOverall
        ? `overall_cvr = ${formatPercent(bestOverall.overallConversion, 4)}；vs A = ${formatLift(bestLift)}；best_ctr = ${bestCtr?.description || '--'}；best_purchase = ${bestPurchase?.description || '--'}。`
        : '样本不足。',
      result: bestOverall ? `${groupLabelMap[bestOverall.code] || bestOverall.description} is leading` : 'waiting sample',
    },
  ]
})

const getEcharts = async () => {
  if (!echartsModule) {
    echartsModule = await import('echarts')
  }
  return echartsModule
}
const abActiveTabInfo = computed(() => abTabs.find(item => item.key === abActiveTab.value) || abTabs[0])

watch(
  () => route.query.tab,
  value => {
    const nextTab = normalizeAbTab(value)
    if (nextTab !== abActiveTab.value) {
      abActiveTab.value = nextTab
    }
  }
)

watch(abActiveTab, value => {
  const nextTab = normalizeAbTab(value)
  const currentTab = normalizeAbTab(route.query.tab)
  if (nextTab !== currentTab) {
    router.replace({
      query: {
        ...route.query,
        tab: nextTab === abTabs[0].key ? undefined : nextTab,
      },
    })
  }
  nextTick(() => {
    void initCharts()
  })
})

const fetchReport = async () => {
  loading.value = true
  try {
    const res = await getABTestReport()
    groups.value = normalizeGroups(res || {})
    await nextTick()
    await initCharts()
  } finally {
    loading.value = false
  }
}

const handleReset = async () => {
  try {
    await ElMessageBox.confirm('重置将清除所有 A/B 实验数据，确定继续？', '重置确认', { type: 'warning' })
    await resetABTest()
    ElMessage.success('实验数据已重置')
    await fetchReport()
  } catch {}
}

const initCharts = async () => {
  charts.forEach(c => c?.dispose())
  charts = []
  const isDark = document.documentElement.classList.contains('dark')
  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const splitLineColor = isDark ? '#374151' : '#e5e7eb'
  const echarts = await getEcharts()

  if (barChartRef.value && groups.value.length) {
    const chart = echarts.init(barChartRef.value)
    const names = groups.value.map(g => g.description || g.code)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: {
        top: 0,
        textStyle: { color: textColor },
      },
      grid: { left: '4%', right: '4%', bottom: 72, top: 52, containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          color: textColor,
          interval: 0,
          lineHeight: 16,
          margin: 14,
          formatter: value => String(value || '').replace(/\s+/g, '\n'),
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textColor, formatter: v => `${v}` },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
      },
      series: [
        { name: '曝光', type: 'bar', data: groups.value.map(g => numberVal(g.totalExposures)), itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] } },
        { name: '点击', type: 'bar', data: groups.value.map(g => numberVal(g.totalClicks)), itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } },
        { name: '加购', type: 'bar', data: groups.value.map(g => numberVal(g.totalAddToCarts)), itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } },
        { name: '购买', type: 'bar', data: groups.value.map(g => numberVal(g.totalPurchases)), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
      ],
    })
    charts.push(chart)
  }

  if (funnelChartRef.value && groups.value.length) {
    const best = groups.value.reduce((a, b) => (numberVal(b.totalExposures) > numberVal(a.totalExposures) ? b : a), groups.value[0])
    const chart = echarts.init(funnelChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      series: [{
        type: 'funnel',
        left: '8%',
        right: '14%',
        top: 24,
        bottom: 24,
        width: '72%',
        min: 0,
        max: numberVal(best.totalExposures) || 100,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'right',
          color: textColor,
          fontSize: 12,
          formatter: params => `${params.name}  ${params.value}`,
        },
        labelLine: {
          show: true,
          length: 12,
          lineStyle: { color: splitLineColor },
        },
        itemStyle: { borderColor: isDark ? '#1f2937' : '#fff', borderWidth: 1 },
        data: [
          { value: numberVal(best.totalExposures), name: '曝光', itemStyle: { color: '#8b5cf6' } },
          { value: numberVal(best.totalClicks), name: '点击', itemStyle: { color: '#3b82f6' } },
          { value: numberVal(best.totalAddToCarts), name: '加购', itemStyle: { color: '#f59e0b' } },
          { value: numberVal(best.totalPurchases), name: '购买', itemStyle: { color: '#10b981' } },
        ],
      }],
    })
    charts.push(chart)
  }
}

const handleResize = () => charts.forEach(c => c?.resize())

onMounted(async () => {
  await fetchReport()
  window.addEventListener('resize', handleResize)
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        void initCharts()
      }
    })
  })
  themeObserver.observe(document.documentElement, { attributes: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  themeObserver?.disconnect()
  charts.forEach(c => c?.dispose())
})
</script>

<style scoped>
.ab-compact-head {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) minmax(300px, 0.84fr);
  gap: 20px;
  align-items: start;
}

.ab-compact-head__kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #0369a1;
}

.ab-compact-head__title {
  margin-top: 8px;
  font-size: 40px;
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #020617;
}

.ab-compact-head__summary,
.ab-compact-head__aside p {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.8;
  color: #64748b;
}

.ab-compact-head__aside {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  padding: 18px 18px 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 0.86));
}

.ab-compact-head__tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.88);
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}

.ab-compact-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.ab-test-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.ab-test-summary-card,
.ab-test-group-card,
.ab-test-lift-card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.92);
}

.ab-test-focus-row,
.ab-test-metric-box,
.ab-test-strategy-box,
.ab-test-summary-card__result {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.ab-test-focus-row,
.ab-test-metric-box {
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.82);
}

.ab-test-focus-row span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.ab-test-focus-row strong {
  display: block;
  margin-top: 6px;
  font-size: 15px;
  line-height: 1.6;
  color: #0f172a;
}

.ab-test-group-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.ab-test-group-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
}

.ab-test-group-card--winner {
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow: 0 18px 32px rgba(59, 130, 246, 0.12);
}

.ab-test-strategy-box {
  padding: 12px 14px;
  background: rgba(241, 245, 249, 0.9);
  color: #475569;
  font-size: 12px;
  line-height: 1.7;
}

.ab-test-metric-box {
  background: rgba(255, 255, 255, 0.72);
}

.ab-test-summary-card__result {
  background: #0f172a;
  color: #fff;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.7;
}

.ab-test-lift-card {
  border-radius: var(--radius-md);
  padding: 16px;
}

.ab-test-script-card {
  border-radius: var(--radius-md);
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.ab-test-script-card--rose {
  background: rgba(255, 241, 242, 0.82);
  border-color: rgba(244, 63, 94, 0.18);
}

.ab-test-script-card--amber {
  background: rgba(255, 247, 237, 0.82);
  border-color: rgba(245, 158, 11, 0.2);
}

.dark .ab-test-summary-card,
.dark .ab-test-group-card,
.dark .ab-test-lift-card {
  border-color: rgba(71, 85, 105, 0.58);
  background: rgba(15, 23, 42, 0.46);
}

.dark .ab-compact-head__title {
  color: #f8fafc;
}

.dark .ab-compact-head__kicker {
  color: #67e8f9;
}

.dark .ab-compact-head__summary,
.dark .ab-compact-head__aside p,
.dark .ab-test-focus-row span {
  color: #94a3b8;
}

.dark .ab-compact-head__aside {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.48);
}

.dark .ab-compact-head__tag {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.62);
  color: #cbd5e1;
}

.dark .ab-test-focus-row,
.dark .ab-test-metric-box {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.62);
}

.dark .ab-test-focus-row strong {
  color: #e2e8f0;
}

.dark .ab-test-group-card--winner {
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow: 0 18px 32px rgba(2, 6, 23, 0.32);
}

.dark .ab-test-strategy-box {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.62);
  color: #cbd5e1;
}

.dark .ab-test-summary-card__result {
  border-color: rgba(51, 65, 85, 0.7);
  background: rgba(15, 23, 42, 0.88);
}

.dark .ab-test-script-card--rose {
  background: rgba(76, 5, 25, 0.28);
  border-color: rgba(244, 63, 94, 0.22);
}

.dark .ab-test-script-card--amber {
  background: rgba(69, 26, 3, 0.28);
  border-color: rgba(245, 158, 11, 0.24);
}

@media (max-width: 1024px) {
  .ab-compact-head,
  .ab-test-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
