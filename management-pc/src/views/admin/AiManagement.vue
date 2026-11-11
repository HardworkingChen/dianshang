<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getAiConfig,
  testAiConnection,
  getAiReviewSummary,
  askAiProductQA,
  getAiModuleSwitches,
  updateAiModuleSwitch,
  sendAiChat,
} from '../../api/ai'
import { getAdminRecommendAnalytics, getAdminKmeansSummary } from '../../api/admin'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import PageSectionTabs from '../../components/PageSectionTabs.vue'
import { demoAiChatResponse } from '../../utils/competitionDemoData'

const route = useRoute()
const router = useRouter()

const pageLoading = ref(false)
const chatLoading = ref(false)
const testLoading = ref(false)
const summaryLoading = ref(false)
const qaLoading = ref(false)
const chatBoxRef = ref(null)

const aiConfig = ref({})
const moduleSwitches = ref({
  'ai-chat': true,
  'ai-merchant-copilot': true,
  'ai-review-summary': true,
  'ai-product-qa': true,
})
const switchLoading = ref({})
const recommendAnalytics = ref({})
const kmeansSummary = ref({})
const testMessage = ref('请用一句话总结当前 AI 服务状态')
const testResult = ref(null)
const summaryProductId = ref('')
const summaryResult = ref('')
const qaProductId = ref('')
const qaQuestion = ref('')
const qaResult = ref('')
const chatInput = ref('')
const chatMessages = ref([])

const competitionMode = import.meta.env.VITE_COMPETITION_MODE !== 'false'
const competitionAssistantPreview = demoAiChatResponse('适合通勤与学习场景的高性价比商品')

const moduleList = [
  ['ai-chat', '用户导购对话', '识别需求并给出推荐结果'],
  ['ai-merchant-copilot', '商家运营助手', '输出卖点、文案和承接建议'],
  ['ai-review-summary', '评价智能摘要', '提炼优点、风险和适配人群'],
  ['ai-product-qa', '商品问答', '针对商品做追问解释'],
]

const sceneLabelMap = {
  HOME: '首页推荐',
  DETAIL: '商品详情',
  CART: '购物车',
  SEARCH: '搜索结果',
  personal: '主信号源',
  guess_you_like: '推荐信号源',
  hot: '热度信号源',
  similar: '内容信号源',
  collaborative_filtering: '协同信号源',
  search_keyword: '检索词信号源',
  search_category: '检索类目信号源',
  search_personalized: '检索补位信号源',
  search_hot: '检索热度信号源',
  order_completed: '转化后信号源',
}

const labelTextReplacements = [
  ['CF 协同过滤', '协同过滤'],
  ['cf 协同过滤', '协同过滤'],
  ['Hybrid 混合推荐', '混合推荐'],
  ['hybrid 混合推荐', '混合推荐'],
  ['Content 内容推荐', '内容推荐'],
  ['content 内容推荐', '内容推荐'],
  ['Hot 热门兜底', '热门兜底'],
  ['hot 热门兜底', '热门兜底'],
  ['HOME', '首页推荐'],
  ['DETAIL', '商品详情'],
  ['CART', '购物车'],
  ['SEARCH', '搜索结果'],
  ['Hybrid', '混合推荐'],
  ['hybrid', '混合推荐'],
  ['Collaborative', '协同过滤'],
  ['collaborative', '协同过滤'],
  ['Content', '内容推荐'],
  ['content', '内容推荐'],
  ['Hot', '热门兜底'],
  ['hot', '热门兜底'],
]

const allAiTabs = [
  { key: 'overview', label: '能力概览', hint: '总览', description: '状态、联动、结论。' },
  { key: 'copilot', label: '智能导购', hint: '对话', description: '对话、商品、依据。' },
  { key: 'modules', label: '模块配置', hint: '开关', description: '能力矩阵和状态。' },
  { key: 'tools', label: '工具验证', hint: '校验', description: '连通、摘要、问答。' },
]

const displayAiTabs = computed(() =>
  competitionMode
    ? allAiTabs.filter(item => item.key === 'overview' || item.key === 'copilot')
    : allAiTabs
)

const normalizeAiTab = value => {
  const target = String(value || '').trim()
  const allowed = new Set(displayAiTabs.value.map(item => item.key))
  if (allowed.has(target)) {
    return target
  }
  return displayAiTabs.value[0]?.key || 'overview'
}

const activeAiTab = ref('overview')
const activeAiTabInfo = computed(() => displayAiTabs.value.find(item => item.key === activeAiTab.value) || displayAiTabs.value[0])

const performanceSummary = computed(() => recommendAnalytics.value?.performance?.summary || {})
const sceneRows = computed(() =>
  (recommendAnalytics.value?.performance?.sceneMetrics || []).map(item => ({
    ...item,
    sceneLabel: formatSceneLabel(item.scene || item.sceneLabel || item.label),
  }))
)
const algorithmRows = computed(() =>
  (recommendAnalytics.value?.performance?.algorithmMetrics || []).map(item => ({
    ...item,
    algorithmLabel: formatAlgorithmLabel(item.algorithm || item.algorithmLabel || item.label),
  }))
)
const comparisonHighlights = computed(() =>
  (recommendAnalytics.value?.performance?.comparisonHighlights || []).map(item => ({
    ...item,
    winnerLabel: formatHighlightWinner(item),
    summary: normalizeInsightText(item.summary),
  }))
)
const bestAlgorithmSegment = computed(() => {
  const segment = recommendAnalytics.value?.performance?.bestAlgorithmSegment || {}
  return {
    ...segment,
    algorithmLabel: formatAlgorithmLabel(segment.algorithmLabel || segment.algorithm),
    summary: normalizeInsightText(segment.summary),
  }
})
const distributionQuality = computed(() => recommendAnalytics.value?.performance?.distributionQuality || {})
const clusterTask = computed(() => kmeansSummary.value?.task || {})
const clusterOverview = computed(() => kmeansSummary.value?.llmOverview || {})
const latestAssistant = computed(() => [...chatMessages.value].reverse().find(item => item.role === 'assistant') || null)
const displayedAssistant = computed(() => {
  if (latestAssistant.value) {
    return latestAssistant.value
  }
  if (!competitionMode) {
    return null
  }
  return {
    role: 'assistant',
    content: sanitizeReply(competitionAssistantPreview.reply),
    products: competitionAssistantPreview.products || [],
    shoppingBrief: competitionAssistantPreview.shoppingBrief || {},
    insightCards: competitionAssistantPreview.insightCards || [],
    nextActions: competitionAssistantPreview.nextActions || [],
    suggestedPrompts: competitionAssistantPreview.suggestedPrompts || [],
    strategyLabel: competitionAssistantPreview.strategyLabel || '',
    personaCard: competitionAssistantPreview.personaCard || {},
    needClarification: !!competitionAssistantPreview.needClarification,
    clarificationQuestion: competitionAssistantPreview.clarificationQuestion || '',
  }
})
const enabledModuleCount = computed(() => Object.values(moduleSwitches.value).filter(Boolean).length)
const aiServiceStatusLabel = computed(() => {
  const status = String(aiConfig.value.status || '').trim().toLowerCase()
  if (!status) return '待检测'
  if (['up', 'ok', 'online', 'enabled', 'success', 'connected', 'active', 'running', 'ready'].includes(status)) return '已连接'
  if (['down', 'error', 'failed', 'offline'].includes(status)) return '未连接'
  if (['missing', 'unconfigured', 'disabled'].includes(status)) return '未配置'
  return status.toUpperCase()
})
const aiModelLabel = computed(() => String(aiConfig.value.model || '').trim() || '未配置模型')
const aiApiUrlLabel = computed(() => String(aiConfig.value.apiUrl || '').trim() || '尚未配置 API 地址')
const aiSegmentCountLabel = computed(() => kmeansSummary.value?.segmentCount || clusterTask.value?.clusterCount || '待生成')

const aiSummaryCards = computed(() => [
  {
    label: '服务状态',
    value: aiServiceStatusLabel.value,
    sub: aiModelLabel.value,
  },
  {
    label: '推荐转化',
    value: formatPercent(performanceSummary.value.conversionRate),
    sub: `成功率 ${formatPercent(performanceSummary.value.recommendationSuccessRate)}`,
  },
  {
    label: '分群规模',
    value: `${aiSegmentCountLabel.value} 类`,
    sub: `${formatNumber(clusterTask.value.sampleUserCount)} 个样本用户`,
  },
  {
    label: '启用模块',
    value: `${enabledModuleCount.value}/${moduleList.length}`,
    sub: '导购、摘要、问答统一承接',
  },
])
const aiHeroHighlights = computed(() => [
  {
    label: '服务状态',
    value: aiServiceStatusLabel.value,
    note: aiModelLabel.value,
    tone: aiServiceStatusLabel.value === '已连接'
      ? 'success'
      : aiServiceStatusLabel.value === '未配置'
        ? 'warning'
        : aiServiceStatusLabel.value === '未连接'
          ? 'danger'
          : undefined,
  },
  {
    label: '推荐转化',
    value: formatPercent(performanceSummary.value.conversionRate),
    note: `成功率 ${formatPercent(performanceSummary.value.recommendationSuccessRate)}`,
  },
  {
    label: '分群规模',
    value: `${aiSegmentCountLabel.value} 类`,
    note: `${formatNumber(clusterTask.value.sampleUserCount)} 个样本用户`,
  },
  {
    label: '启用模块',
    value: `${enabledModuleCount.value}/${moduleList.length}`,
    note: '导购、摘要、问答统一承接',
  },
])

const headMeta = computed(() => {
  const best = bestAlgorithmSegment.value?.available
    ? `${bestAlgorithmSegment.value.segmentLabel} × ${bestAlgorithmSegment.value.algorithmLabel}`
    : '混合推荐承接'
  return `${aiModelLabel.value} · ${best}`
})

const overviewConclusionRows = computed(() => {
  const sceneWinner = comparisonHighlights.value.find(item => item.dimension === 'scene')
  const algorithmWinner = comparisonHighlights.value.find(item => item.dimension === 'algorithm')
  return [
    {
      label: '服务依据',
      value: `${aiServiceStatusLabel.value} · ${aiModelLabel.value}`,
      note: aiApiUrlLabel.value,
    },
    {
      label: '推荐联动',
      value: formatPercent(performanceSummary.value.conversionRate),
      note: distributionQuality.value.summary || '优先看推荐曝光、点击和成交的联动结果。',
    },
    {
      label: '分群结论',
      value: `${aiSegmentCountLabel.value} 类用户`,
      note: clusterOverview.value.overallSummary || '分群结果进入排序承接逻辑。',
    },
    {
      label: '场景 / 算法亮点',
      value: algorithmWinner?.winnerLabel || '混合推荐',
      note: sceneWinner?.summary || algorithmWinner?.summary || '用场景和算法两组对比解释 AI 导购结果。',
    },
  ]
})

const sceneProgressRows = computed(() =>
  sceneRows.value.slice(0, 4).map(item => ({
    label: item.sceneLabel,
    primary: formatNumber(item.exposureCount),
    secondary: `${formatPercent(item.conversionRate)} 转化`,
    width: `${Math.max(Math.min(Number(item.successRate || 0), 100), 6)}%`,
  }))
)

const algorithmProgressRows = computed(() =>
  algorithmRows.value.slice(0, 4).map(item => ({
    label: item.algorithmLabel,
    primary: formatPercent(item.clickThroughRate),
    secondary: `${formatPercent(item.conversionRate)} 转化`,
    width: `${Math.max(Math.min(Number(item.successRate || 0), 100), 6)}%`,
  }))
)

const assistantInsightCards = computed(() => displayedAssistant.value?.insightCards || [])
const assistantProducts = computed(() => displayedAssistant.value?.products || [])
const assistantNextActions = computed(() => displayedAssistant.value?.nextActions || [])
const assistantPrompts = computed(() => displayedAssistant.value?.suggestedPrompts || [])
const assistantBrief = computed(() => displayedAssistant.value?.shoppingBrief || {})
const assistantPersona = computed(() => displayedAssistant.value?.personaCard || {})

const moduleStatusRows = computed(() =>
  moduleList.map(([key, title, desc]) => ({
    key,
    title,
    desc,
    enabled: !!moduleSwitches.value[key],
  }))
)

async function loadAll() {
  pageLoading.value = true
  try {
    const [configRes, switchRes, recommendRes, kmeansRes] = await Promise.allSettled([
      getAiConfig(),
      getAiModuleSwitches(),
      getAdminRecommendAnalytics(30),
      getAdminKmeansSummary(),
    ])
    aiConfig.value = configRes.status === 'fulfilled' ? (configRes.value || {}) : {}
    if (aiConfig.value.modules) {
      moduleSwitches.value = { ...moduleSwitches.value, ...aiConfig.value.modules }
    }
    if (switchRes.status === 'fulfilled' && switchRes.value) {
      const nextState = { ...moduleSwitches.value }
      Object.keys(nextState).forEach(key => {
        if (typeof switchRes.value[key]?.enabled === 'boolean') {
          nextState[key] = switchRes.value[key].enabled
        }
      })
      moduleSwitches.value = nextState
    }
    recommendAnalytics.value = recommendRes.status === 'fulfilled' ? (recommendRes.value || {}) : {}
    kmeansSummary.value = kmeansRes.status === 'fulfilled' ? (kmeansRes.value || {}) : {}
  } finally {
    pageLoading.value = false
  }
}

async function handleSwitch(module, value) {
  switchLoading.value = { ...switchLoading.value, [module]: true }
  try {
    await updateAiModuleSwitch(module, value)
    ElMessage.success(`${module} 已${value ? '开启' : '关闭'}`)
  } catch {
    moduleSwitches.value = { ...moduleSwitches.value, [module]: !value }
    ElMessage.error('模块状态更新失败')
  } finally {
    switchLoading.value = { ...switchLoading.value, [module]: false }
  }
}

async function handleTest() {
  if (!testMessage.value.trim()) return ElMessage.warning('请输入检查消息')
  testLoading.value = true
  try {
    testResult.value = await testAiConnection(testMessage.value.trim())
  } catch (error) {
    testResult.value = { status: 'error', error: error.message || '请求失败' }
  } finally {
    testLoading.value = false
  }
}

async function handleSummary() {
  if (!summaryProductId.value) return ElMessage.warning('请输入商品 ID')
  summaryLoading.value = true
  try {
    summaryResult.value = await getAiReviewSummary(summaryProductId.value)
  } finally {
    summaryLoading.value = false
  }
}

async function handleQA() {
  if (!qaProductId.value || !qaQuestion.value.trim()) return ElMessage.warning('请输入商品 ID 和问题')
  qaLoading.value = true
  try {
    qaResult.value = await askAiProductQA(qaProductId.value, qaQuestion.value.trim())
  } finally {
    qaLoading.value = false
  }
}

async function submitChat(prompt) {
  const text = typeof prompt === 'string' ? prompt.trim() : chatInput.value.trim()
  if (!text || chatLoading.value) return
  const history = chatMessages.value.slice(-10).map(item => ({ role: item.role, content: item.content }))
  chatMessages.value.push({ role: 'user', content: text })
  chatInput.value = ''
  chatLoading.value = true
  try {
    const res = await sendAiChat(text, history)
    chatMessages.value.push({
      role: 'assistant',
      content: sanitizeReply(res?.reply),
      products: Array.isArray(res?.products) ? res.products : [],
      shoppingBrief: res?.shoppingBrief || {},
      insightCards: Array.isArray(res?.insightCards) ? res.insightCards : [],
      nextActions: Array.isArray(res?.nextActions) ? res.nextActions : [],
      suggestedPrompts: Array.isArray(res?.suggestedPrompts) ? res.suggestedPrompts : [],
      strategyLabel: res?.strategyLabel || '',
      personaCard: res?.personaCard || {},
      needClarification: !!res?.needClarification,
      clarificationQuestion: res?.clarificationQuestion || '',
    })
    await nextTick()
    if (chatBoxRef.value) chatBoxRef.value.scrollTop = chatBoxRef.value.scrollHeight
  } catch {
    chatMessages.value.push({
      role: 'assistant',
      content: '请求失败，请稍后重试。',
      products: [],
      shoppingBrief: {},
      insightCards: [],
      nextActions: [],
      suggestedPrompts: [],
    })
  } finally {
    chatLoading.value = false
  }
}

function handleAction(action) {
  if (!action) return
  if (action.type === 'view_product' && action.productId) {
    qaProductId.value = String(action.productId)
    ElMessage.success(`已将商品 ${action.productId} 带入问答区`)
    return
  }
  if (action.prompt) submitChat(action.prompt)
}

function sanitizeReply(reply) {
  return (reply || '暂无 AI 回复').replace(/\[([^\]]+)\]\(product:\d+\)/g, '$1')
}

function formatNumber(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN') : '0'
}

function formatPercent(value) {
  const raw = Number(value || 0)
  const n = Math.abs(raw) > 0 && Math.abs(raw) <= 1 ? raw * 100 : raw
  return `${n.toFixed(2)}%`
}

function formatPrice(value) {
  const n = Number(value || 0)
  return Number.isFinite(n)
    ? n.toLocaleString('zh-CN', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
    : '--'
}

function joinList(value) {
  return Array.isArray(value) && value.length ? value.join(' / ') : '--'
}

function normalizeInsightText(value) {
  return labelTextReplacements.reduce(
    (text, [from, to]) => text.replaceAll(from, to),
    String(value || '').trim()
  )
}

function formatSceneLabel(scene) {
  const value = String(scene || '').trim()
  if (!value) return '未知场景'
  return sceneLabelMap[value] || sceneLabelMap[value.toUpperCase()] || sceneLabelMap[value.toLowerCase()] || value
}

function formatAlgorithmLabel(algorithm) {
  const value = String(algorithm || '').trim()
  const normalized = value.toLowerCase()
  if (!value) return '未知算法'
  if (value.includes('协同过滤') || normalized.startsWith('cf ') || normalized === 'cf') return '协同过滤'
  if (value.includes('混合推荐') || normalized.startsWith('hybrid ')) return '混合推荐'
  if (value.includes('内容推荐') || normalized.startsWith('content ')) return '内容推荐'
  if (value.includes('热门候选')) return '热门候选'
  if (value.includes('热门兜底') || normalized.startsWith('hot ')) return '热门兜底'
  if (normalized.includes('hybrid')) return '混合推荐'
  if (normalized === 'cf' || normalized.includes('_cf') || normalized.includes('collaborative')) return '协同过滤'
  if (normalized === 'cb' || normalized.includes('content')) return '内容推荐'
  if (normalized.includes('hot') || normalized.includes('popular') || normalized.includes('snapshot')) return '热门兜底'
  if (normalized.includes('control')) return '对照策略'
  return value
}

function formatHighlightWinner(item) {
  const dimension = String(item?.dimension || '').trim().toLowerCase()
  const rawValue = item?.winnerLabel || item?.winner || item?.label || ''
  if (dimension === 'scene') {
    return formatSceneLabel(rawValue)
  }
  if (dimension === 'algorithm') {
    return formatAlgorithmLabel(rawValue)
  }
  return normalizeInsightText(rawValue)
}

watch(
  [() => route.query.tab, displayAiTabs],
  () => {
    const next = normalizeAiTab(route.query.tab)
    if (next !== activeAiTab.value) {
      activeAiTab.value = next
    }
  },
  { immediate: true }
)

watch(activeAiTab, value => {
  const next = normalizeAiTab(value)
  const current = normalizeAiTab(route.query.tab)
  if (next === current) {
    return
  }
  router.replace({
    query: {
      ...route.query,
      tab: next === displayAiTabs.value[0]?.key ? undefined : next,
    },
  })
})

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div v-loading="pageLoading" class="space-y-6 analytics-ui-page analytics-page-shell ai-compact-page">
    <AnalyticsPageHero
      kicker="AI 能力"
      title="智能助手"
      summary="看状态、导购、分群和问答结果。"
      :meta="headMeta"
      :chips="['状态', '导购', '分群', '问答']"
      :highlights="aiHeroHighlights"
    />

    <section class="analytics-metric-strip">
      <article v-for="item in aiSummaryCards" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <PageSectionTabs
      v-model="activeAiTab"
      primary-label="管理端"
      page-label="智能助手"
      title="AI 视图"
      description=""
      :tabs="displayAiTabs"
      :active-label="activeAiTabInfo.label"
    />

    <div v-if="activeAiTab === 'overview'" class="ai-overview-grid">
      <section class="analytics-panel ai-panel ai-panel--wide">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">概览</div>
            <h3 class="ai-panel__title">服务与推荐联动</h3>
          </div>
          <div class="ai-panel__note">状态、场景、算法。</div>
        </div>

        <div class="ai-bar-section">
          <div class="ai-bar-card">
            <div class="ai-bar-card__head">
              <span>场景承接</span>
              <strong>{{ formatNumber(performanceSummary.exposureCount) }} 曝光</strong>
            </div>
            <div class="ai-bar-list">
              <article v-for="item in sceneProgressRows" :key="item.label" class="ai-bar-row">
                <div class="ai-bar-row__top">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.secondary }}</strong>
                </div>
                <div class="ai-bar-row__track">
                  <div class="ai-bar-row__fill" :style="{ width: item.width }"></div>
                </div>
                <div class="ai-bar-row__meta">{{ item.primary }}</div>
              </article>
            </div>
          </div>

          <div class="ai-bar-card">
            <div class="ai-bar-card__head">
              <span>算法承接</span>
              <strong>{{ comparisonHighlights[1]?.winnerLabel || '混合推荐' }}</strong>
            </div>
            <div class="ai-bar-list">
              <article v-for="item in algorithmProgressRows" :key="item.label" class="ai-bar-row">
                <div class="ai-bar-row__top">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.secondary }}</strong>
                </div>
                <div class="ai-bar-row__track">
                  <div class="ai-bar-row__fill ai-bar-row__fill--cyan" :style="{ width: item.width }"></div>
                </div>
                <div class="ai-bar-row__meta">{{ item.primary }}</div>
              </article>
            </div>
          </div>
        </div>

        <div class="ai-highlight-grid">
          <article v-for="item in comparisonHighlights" :key="item.title" class="ai-highlight-card">
            <span class="ai-highlight-card__label">{{ item.title }}</span>
            <strong class="ai-highlight-card__value">{{ item.winnerLabel }}</strong>
            <p class="ai-highlight-card__text">{{ item.summary }}</p>
          </article>
          <article class="ai-highlight-card ai-highlight-card--accent">
            <span class="ai-highlight-card__label">最佳分群</span>
            <strong class="ai-highlight-card__value">
              {{ bestAlgorithmSegment.available ? bestAlgorithmSegment.segmentLabel : '等待分群数据' }}
            </strong>
            <p class="ai-highlight-card__text">
              {{ bestAlgorithmSegment.available ? bestAlgorithmSegment.summary : '分群结果会进入导购与推荐承接。' }}
            </p>
          </article>
        </div>
      </section>

      <section class="analytics-panel ai-panel">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">结论</div>
            <h3 class="ai-panel__title">当前判断</h3>
          </div>
          <div class="ai-panel__note">只保留关键结论。</div>
        </div>

        <div class="ai-focus-list">
          <article v-for="item in overviewConclusionRows" :key="item.label" class="ai-focus-item">
            <span class="ai-focus-item__label">{{ item.label }}</span>
            <strong class="ai-focus-item__value">{{ item.value }}</strong>
            <p class="ai-focus-item__text">{{ item.note }}</p>
          </article>
        </div>

        <div class="ai-module-summary">
          <div class="ai-module-summary__title">模块状态</div>
          <div class="ai-module-summary__grid">
            <span
              v-for="item in moduleStatusRows"
              :key="item.key"
              class="ai-module-summary__chip"
              :class="item.enabled ? 'ai-module-summary__chip--on' : ''"
            >
              {{ item.title }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="displayedAssistant" class="analytics-panel ai-panel ai-overview-preview">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">示例</div>
            <h3 class="ai-panel__title">导购输出示例</h3>
          </div>
          <div class="ai-panel__note">展示一轮导购结果。</div>
        </div>

        <div class="ai-preview-grid">
          <article class="ai-preview-card">
            <span class="ai-preview-card__label">需求摘要</span>
            <strong class="ai-preview-card__value">{{ assistantBrief.summary || '等待导购输入' }}</strong>
            <p class="ai-preview-card__text">
              {{ assistantBrief.category || '--' }} / {{ assistantBrief.budget || '未指定预算' }}
            </p>
          </article>
          <article class="ai-preview-card">
            <span class="ai-preview-card__label">画像承接</span>
            <strong class="ai-preview-card__value">{{ assistantPersona.segmentName || '当前兴趣画像' }}</strong>
            <p class="ai-preview-card__text">{{ assistantPersona.summary || '画像结果会影响推荐权重。' }}</p>
          </article>
          <article class="ai-preview-card ai-preview-card--wide">
            <span class="ai-preview-card__label">AI 结论</span>
            <strong class="ai-preview-card__value">{{ displayedAssistant.content }}</strong>
          </article>
        </div>
      </section>
    </div>

    <div v-else-if="activeAiTab === 'copilot'" class="ai-copilot-grid">
      <section class="analytics-panel ai-panel ai-panel--wide">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">导购工作台</div>
            <h3 class="ai-panel__title">AI 导购工作台</h3>
          </div>
          <div class="ai-panel__note">对话、结果、依据。</div>
        </div>

        <div ref="chatBoxRef" class="ai-chat-stage">
          <div v-if="chatMessages.length === 0" class="ai-chat-placeholder">
            <div class="ai-chat-placeholder__title">快捷提问</div>
            <div class="ai-chat-placeholder__list">
              <span>500 元以内蓝牙耳机</span>
              <span>适合通勤的护眼台灯</span>
              <span>高销量送礼候选</span>
            </div>
            <p>直接返回商品和简短依据。</p>
          </div>

          <div v-for="(msg, index) in chatMessages" :key="`${msg.role}-${index}`" class="ai-chat-message">
            <div class="ai-chat-message__role">{{ msg.role === 'user' ? '用户' : 'AI' }}</div>
            <div class="ai-chat-message__bubble" :class="msg.role === 'user' ? 'ai-chat-message__bubble--user' : ''">
              {{ msg.content }}
            </div>
          </div>

          <div v-if="chatLoading" class="ai-chat-loading">AI 正在生成导购结果...</div>
        </div>

        <div class="ai-chat-composer">
          <el-input
            v-model="chatInput"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="例如：帮我找适合送礼、预算 400 元以内的蓝牙耳机"
            @keyup.enter.exact.prevent="submitChat()"
          />
          <el-button type="primary" class="self-end !px-4" :loading="chatLoading" @click="submitChat()">发送</el-button>
        </div>
      </section>

      <div class="ai-copilot-side">
        <section class="analytics-panel ai-panel">
          <div class="ai-panel__head">
            <div>
              <div class="analytics-panel__eyebrow">依据</div>
              <h3 class="ai-panel__title">当前承接依据</h3>
            </div>
            <div class="ai-panel__note">需求、画像、策略。</div>
          </div>

          <div v-if="displayedAssistant" class="ai-evidence-stack">
            <article class="ai-evidence-card">
              <span>需求摘要</span>
              <strong>{{ assistantBrief.summary || '--' }}</strong>
              <p>{{ assistantBrief.category || '--' }} / {{ assistantBrief.budget || '未指定预算' }}</p>
            </article>
            <article class="ai-evidence-card">
              <span>画像线索</span>
              <strong>{{ assistantPersona.segmentName || '当前兴趣画像' }}</strong>
              <p>{{ assistantPersona.summary || '画像结果进入推荐解释。' }}</p>
            </article>
            <article
              v-for="card in assistantInsightCards"
              :key="card.title"
              class="ai-evidence-card ai-evidence-card--soft"
            >
              <span>{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.description }}</p>
            </article>
          </div>
          <el-empty v-else description="等待导购输出" :image-size="82" />
        </section>

        <section class="analytics-panel ai-panel">
          <div class="ai-panel__head">
            <div>
              <div class="analytics-panel__eyebrow">商品</div>
              <h3 class="ai-panel__title">候选商品</h3>
            </div>
            <div class="ai-panel__note">只看价格和原因。</div>
          </div>

          <div v-if="assistantProducts.length" class="ai-product-list">
            <article v-for="product in assistantProducts.slice(0, 3)" :key="product.id" class="ai-product-row">
              <div class="ai-product-row__main">
                <strong>{{ product.name }}</strong>
                <p>{{ product.recommendReason || '已进入候选池' }}</p>
              </div>
              <span class="ai-product-row__price">¥{{ formatPrice(product.price) }}</span>
            </article>
          </div>
          <el-empty v-else description="暂无候选商品" :image-size="82" />

          <div v-if="assistantNextActions.length" class="ai-action-grid">
            <button
              v-for="action in assistantNextActions"
              :key="action.key"
              type="button"
              class="ai-action-button"
              @click="handleAction(action)"
            >
              <span>{{ action.label }}</span>
              <p>{{ action.description }}</p>
            </button>
          </div>

          <div v-if="assistantPrompts.length" class="ai-prompt-row">
            <el-button v-for="prompt in assistantPrompts" :key="prompt" size="small" round @click="submitChat(prompt)">
              {{ prompt }}
            </el-button>
          </div>
        </section>
      </div>
    </div>

    <div v-else-if="activeAiTab === 'modules'" class="ai-module-grid">
      <section class="analytics-panel ai-panel ai-panel--wide">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">模块</div>
            <h3 class="ai-panel__title">能力矩阵</h3>
          </div>
          <div class="ai-panel__note">开关、状态、用途。</div>
        </div>

        <div class="ai-module-list">
          <article v-for="item in moduleStatusRows" :key="item.key" class="ai-module-row">
            <div>
              <div class="ai-module-row__title">{{ item.title }}</div>
              <div class="ai-module-row__text">{{ item.desc }}</div>
            </div>
            <el-switch :model-value="item.enabled" :loading="switchLoading[item.key]" @change="value => handleSwitch(item.key, value)" />
          </article>
        </div>
      </section>

      <section class="analytics-panel ai-panel">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">状态</div>
            <h3 class="ai-panel__title">配置摘要</h3>
          </div>
          <div class="ai-panel__note">模型、地址、占比。</div>
        </div>

        <div class="ai-focus-list">
          <article class="ai-focus-item">
            <span class="ai-focus-item__label">模型服务</span>
            <strong class="ai-focus-item__value">{{ aiModelLabel }}</strong>
            <p class="ai-focus-item__text">{{ aiApiUrlLabel }}</p>
          </article>
          <article class="ai-focus-item">
            <span class="ai-focus-item__label">启用模块</span>
            <strong class="ai-focus-item__value">{{ enabledModuleCount }}/{{ moduleList.length }}</strong>
            <p class="ai-focus-item__text">已连接推荐联动与分群摘要。</p>
          </article>
          <article class="ai-focus-item">
            <span class="ai-focus-item__label">分群摘要</span>
            <strong class="ai-focus-item__value">{{ aiSegmentCountLabel }} 类</strong>
            <p class="ai-focus-item__text">{{ clusterOverview.overallSummary || '分群结果进入导购承接。' }}</p>
          </article>
        </div>
      </section>
    </div>

    <div v-else class="ai-tool-grid">
      <section class="analytics-panel ai-panel ai-panel--wide">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">工具</div>
            <h3 class="ai-panel__title">工具验证</h3>
          </div>
          <div class="ai-panel__note">连通、摘要、问答。</div>
        </div>

        <div class="ai-tool-stack">
          <article class="ai-tool-card">
            <span class="ai-tool-card__label">连通检查</span>
            <div class="ai-tool-card__row">
              <el-input v-model="testMessage" placeholder="输入检查消息" @keyup.enter="handleTest" />
              <el-button type="primary" :loading="testLoading" @click="handleTest">执行</el-button>
            </div>
            <div
              v-if="testResult"
              class="ai-tool-card__result"
              :class="testResult.status === 'success' ? 'ai-tool-card__result--success' : 'ai-tool-card__result--danger'"
            >
              {{ testResult.status === 'success' ? testResult.reply : testResult.error }}
            </div>
          </article>

          <article class="ai-tool-card">
            <span class="ai-tool-card__label">评价摘要</span>
            <div class="ai-tool-card__row">
              <el-input v-model="summaryProductId" placeholder="商品 ID" />
              <el-button type="success" :loading="summaryLoading" @click="handleSummary">生成</el-button>
            </div>
            <div v-if="summaryResult" class="ai-tool-card__result">{{ summaryResult }}</div>
          </article>

          <article class="ai-tool-card">
            <span class="ai-tool-card__label">商品问答</span>
            <div class="ai-tool-card__stack">
              <el-input v-model="qaProductId" placeholder="商品 ID" />
              <el-input v-model="qaQuestion" type="textarea" :rows="3" resize="none" placeholder="例如：这款更适合通勤还是送礼？" />
              <el-button type="warning" :loading="qaLoading" @click="handleQA">提问</el-button>
            </div>
            <div v-if="qaResult" class="ai-tool-card__result">{{ qaResult }}</div>
          </article>
        </div>
      </section>

      <section class="analytics-panel ai-panel">
        <div class="ai-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">最近结果</div>
            <h3 class="ai-panel__title">最近一轮结果</h3>
          </div>
          <div class="ai-panel__note">无真实对话时展示示例。</div>
        </div>

        <div v-if="displayedAssistant" class="ai-focus-list">
          <article class="ai-focus-item">
            <span class="ai-focus-item__label">回复摘要</span>
            <strong class="ai-focus-item__value">{{ displayedAssistant.content }}</strong>
          </article>
          <article class="ai-focus-item">
            <span class="ai-focus-item__label">推荐商品数</span>
            <strong class="ai-focus-item__value">{{ assistantProducts.length }}</strong>
            <p class="ai-focus-item__text">{{ assistantPersona.segmentName || '待识别用户画像' }}</p>
          </article>
        </div>
        <el-empty v-else description="等待工具输出" :image-size="82" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.ai-compact-head {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(280px, 0.82fr);
  gap: 20px;
  align-items: start;
}

.ai-compact-head__kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #0369a1;
}

.ai-compact-head__title {
  margin-top: 8px;
  font-size: 40px;
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #020617;
}

.ai-compact-head__summary,
.ai-compact-head__aside p {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.8;
  color: #64748b;
}

.ai-compact-head__aside {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  padding: 18px 18px 16px;
  background: rgba(248, 250, 252, 0.96);
}

.ai-compact-head__tag,
.ai-module-summary__chip {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.88);
  color: #475569;
}

.ai-compact-head__tag {
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
}

.ai-overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
  gap: 20px;
  align-items: start;
}

.ai-overview-preview {
  grid-column: 1 / -1;
}

.ai-copilot-grid,
.ai-module-grid,
.ai-tool-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
  gap: 20px;
  align-items: start;
}

.ai-copilot-side {
  display: grid;
  gap: 20px;
}

.ai-panel {
  padding: 22px;
}

.ai-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-panel__title {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.ai-panel__note {
  max-width: 240px;
  font-size: 12px;
  line-height: 1.7;
  text-align: right;
  color: #64748b;
}

.ai-bar-section,
.ai-highlight-grid,
.ai-preview-grid {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.ai-bar-section,
.ai-highlight-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-preview-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ai-bar-card,
.ai-highlight-card,
.ai-preview-card,
.ai-focus-item,
.ai-evidence-card,
.ai-product-row,
.ai-action-button,
.ai-module-row,
.ai-tool-card {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.92);
}

.ai-bar-card,
.ai-highlight-card,
.ai-preview-card,
.ai-focus-item,
.ai-evidence-card,
.ai-module-row,
.ai-tool-card {
  padding: 16px;
}

.ai-bar-card__head,
.ai-bar-row__top,
.ai-module-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-bar-card__head span,
.ai-highlight-card__label,
.ai-preview-card__label,
.ai-focus-item__label,
.ai-tool-card__label,
.ai-evidence-card span {
  font-size: 12px;
  color: #64748b;
}

.ai-bar-card__head strong,
.ai-highlight-card__value,
.ai-preview-card__value,
.ai-focus-item__value,
.ai-evidence-card strong,
.ai-module-row__title {
  color: #0f172a;
}

.ai-bar-card__head strong,
.ai-highlight-card__value,
.ai-preview-card__value,
.ai-focus-item__value,
.ai-evidence-card strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.45;
}

.ai-bar-list,
.ai-focus-list,
.ai-evidence-stack,
.ai-tool-stack {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.ai-bar-row__track {
  height: 8px;
  margin-top: 8px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
  overflow: hidden;
}

.ai-bar-row__fill {
  height: 100%;
  border-radius: inherit;
  background: #409eff;
}

.ai-bar-row__fill--cyan {
  background: #67c23a;
}

.ai-bar-row__meta,
.ai-highlight-card__text,
.ai-preview-card__text,
.ai-focus-item__text,
.ai-module-row__text,
.ai-evidence-card p,
.ai-product-row p,
.ai-action-button p,
.ai-tool-card__result {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.75;
  color: #64748b;
}

.ai-highlight-card--accent {
  border-color: rgba(64, 158, 255, 0.26);
  background: rgba(236, 245, 255, 0.96);
}

.ai-preview-card--wide {
  grid-column: 1 / -1;
}

.ai-module-summary {
  margin-top: 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  padding-top: 16px;
}

.ai-module-summary__title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.ai-module-summary__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.ai-module-summary__chip {
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 600;
}

.ai-module-summary__chip--on {
  border-color: rgba(14, 165, 233, 0.24);
  color: #0369a1;
}

.ai-chat-stage {
  display: grid;
  gap: 12px;
  max-height: 520px;
  overflow-y: auto;
  margin-top: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.92);
  padding: 14px;
}

.ai-chat-placeholder,
.ai-chat-message__bubble,
.ai-chat-loading {
  border-radius: 8px;
  padding: 14px;
}

.ai-chat-placeholder {
  border: 1px dashed rgba(148, 163, 184, 0.34);
  background: rgba(255, 255, 255, 0.88);
}

.ai-chat-placeholder__title,
.ai-chat-message__role {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #94a3b8;
}

.ai-chat-placeholder__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.ai-chat-placeholder__list span {
  border-radius: 4px;
  background: rgba(64, 158, 255, 0.12);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
}

.ai-chat-placeholder p {
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.75;
  color: #64748b;
}

.ai-chat-message__bubble {
  margin-top: 8px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
}

.ai-chat-message__bubble--user {
  border-color: rgba(64, 158, 255, 0.3);
  background: #409eff;
  color: #fff;
}

.ai-chat-loading {
  border: 1px dashed rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  color: #64748b;
}

.ai-chat-composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.ai-product-list,
.ai-action-grid {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.ai-product-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
}

.ai-product-row__main strong,
.ai-product-row__price {
  color: #0f172a;
}

.ai-product-row__main strong,
.ai-product-row__price {
  font-size: 15px;
  font-weight: 700;
}

.ai-product-row__price {
  border-radius: 4px;
  background: #303133;
  padding: 7px 10px;
  color: #fff;
}

.ai-action-button {
  width: 100%;
  text-align: left;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.ai-action-button:hover {
  border-color: rgba(64, 158, 255, 0.34);
  transform: none;
}

.ai-action-button span {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.ai-prompt-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.ai-module-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.ai-tool-card__row {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.ai-tool-card__stack {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.ai-tool-card__result {
  border-radius: 6px;
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.ai-tool-card__result--success {
  border: 1px solid rgba(16, 185, 129, 0.2);
  background: rgba(236, 253, 245, 0.86);
  color: #047857;
}

.ai-tool-card__result--danger {
  border: 1px solid rgba(244, 63, 94, 0.2);
  background: rgba(255, 241, 242, 0.86);
  color: #be123c;
}

.dark .ai-compact-head__kicker {
  color: #67e8f9;
}

.dark .ai-compact-head__title,
.dark .ai-panel__title,
.dark .ai-bar-card__head strong,
.dark .ai-highlight-card__value,
.dark .ai-preview-card__value,
.dark .ai-focus-item__value,
.dark .ai-module-summary__title,
.dark .ai-evidence-card strong,
.dark .ai-module-row__title,
.dark .ai-product-row__main strong,
.dark .ai-action-button span {
  color: #f8fafc;
}

.dark .ai-compact-head__summary,
.dark .ai-compact-head__aside p,
.dark .ai-panel__note,
.dark .ai-bar-row__meta,
.dark .ai-highlight-card__text,
.dark .ai-preview-card__text,
.dark .ai-focus-item__text,
.dark .ai-module-row__text,
.dark .ai-tool-card__result,
.dark .ai-evidence-card p,
.dark .ai-product-row p,
.dark .ai-action-button p,
.dark .ai-bar-card__head span,
.dark .ai-highlight-card__label,
.dark .ai-preview-card__label,
.dark .ai-focus-item__label,
.dark .ai-tool-card__label,
.dark .ai-evidence-card span {
  color: #94a3b8;
}

.dark .ai-compact-head__aside,
.dark .ai-bar-card,
.dark .ai-highlight-card,
.dark .ai-preview-card,
.dark .ai-focus-item,
.dark .ai-evidence-card,
.dark .ai-product-row,
.dark .ai-action-button,
.dark .ai-module-row,
.dark .ai-tool-card,
.dark .ai-chat-stage {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.48);
}

.dark .ai-compact-head__tag,
.dark .ai-module-summary__chip,
.dark .ai-chat-placeholder,
.dark .ai-chat-message__bubble,
.dark .ai-chat-loading,
.dark .ai-tool-card__result {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.62);
  color: #cbd5e1;
}

.dark .ai-chat-placeholder__list span {
  background: rgba(8, 145, 178, 0.18);
  color: #67e8f9;
}

.dark .ai-chat-message__bubble--user {
  border-color: rgba(51, 65, 85, 0.7);
  background: rgba(2, 6, 23, 0.92);
  color: #fff;
}

.dark .ai-bar-row__track,
.dark .ai-module-summary {
  border-top-color: rgba(71, 85, 105, 0.48);
  background: rgba(30, 41, 59, 0.72);
}

.dark .ai-highlight-card--accent {
  background: rgba(15, 23, 42, 0.62);
}

.dark .ai-module-summary__chip--on {
  color: #67e8f9;
}

.dark .ai-product-row__price {
  background: rgba(2, 6, 23, 0.92);
}

@media (max-width: 1280px) {
  .ai-compact-head,
  .ai-overview-grid,
  .ai-copilot-grid,
  .ai-module-grid,
  .ai-tool-grid,
  .ai-preview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .ai-bar-section,
  .ai-highlight-grid {
    grid-template-columns: 1fr;
  }

  .ai-chat-composer,
  .ai-tool-card__row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
