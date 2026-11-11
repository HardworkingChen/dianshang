<template>
  <div class="space-y-6 analytics-ui-page analytics-page-shell tech-compact-page">
    <AnalyticsPageHero
      kicker="技术依据"
      title="技术总览"
      summary="看入口、排序、实时回流和兜底。"
      :meta="headMeta"
      :chips="['交互入口', '推荐排序', '实时回流', '稳定性兜底']"
      :highlights="techHeroHighlights"
    />

    <section class="analytics-metric-strip">
      <article v-for="item in techSummaryCards" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <PageSectionTabs
      v-model="activeTab"
      :tabs="tabs"
      primary-label="管理端"
      page-label="技术总览"
      title="技术视图"
      description=""
      :active-label="activeTabInfo.label"
    />

    <div v-if="activeTab === 'stack'" class="tech-stack-grid">
      <section class="analytics-panel tech-panel tech-panel--wide">
        <div class="tech-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">版图</div>
            <h3 class="tech-panel__title">核心技术版图</h3>
          </div>
          <div class="tech-panel__note">入口、排序、实时、治理。</div>
        </div>

        <div class="tech-domain-grid">
          <article v-for="group in techDomains" :key="group.title" class="tech-domain-card">
            <div class="tech-domain-card__top">
              <div>
                <div class="tech-domain-card__eyebrow">{{ group.eyebrow }}</div>
                <div class="tech-domain-card__title">{{ group.title }}</div>
              </div>
              <span class="tech-chip tech-chip--goal">{{ group.goal }}</span>
            </div>
            <p class="tech-domain-card__summary">{{ group.summary }}</p>
            <div class="tech-domain-card__chips">
              <span v-for="item in group.stack" :key="item" class="tech-chip">{{ item }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="analytics-panel tech-panel">
        <div class="tech-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">输出</div>
            <h3 class="tech-panel__title">输出与稳定性</h3>
          </div>
          <div class="tech-panel__note">保留四个关键点。</div>
        </div>

        <div class="tech-snapshot-list">
          <article v-for="item in techSnapshotCards" :key="item.label" class="tech-snapshot-card">
            <span class="tech-snapshot-card__label">{{ item.label }}</span>
            <strong class="tech-snapshot-card__value">{{ item.value }}</strong>
            <p class="tech-snapshot-card__text">{{ item.note }}</p>
          </article>
        </div>

        <div class="tech-link-mini-list">
          <button
            v-for="item in implementationPages.slice(0, 4)"
            :key="item.route"
            type="button"
            class="tech-link-mini"
            @click="goTo(item.route)"
          >
            <span>{{ item.label }}</span>
            <strong>进入</strong>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="activeTab === 'architecture'" class="tech-architecture-grid">
      <section class="analytics-panel tech-panel tech-panel--wide">
        <div class="tech-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">分层</div>
            <h3 class="tech-panel__title">架构分层与职责</h3>
          </div>
          <div class="tech-panel__note">每层只说职责、技术和承接页面。</div>
        </div>

        <div class="tech-layer-list">
          <article v-for="(layer, index) in architectureLayers" :key="layer.title" class="tech-layer-row">
            <div class="tech-layer-row__index">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="tech-layer-row__main">
              <div class="tech-layer-row__top">
                <div class="tech-layer-row__title">{{ layer.title }}</div>
                <span class="tech-chip tech-chip--goal">{{ layer.role }}</span>
              </div>
              <div class="tech-layer-row__text">{{ layer.pageLabel }}</div>
              <div class="tech-layer-row__chips">
                <span v-for="item in layer.stack" :key="item" class="tech-chip">{{ item }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="analytics-panel tech-panel">
        <div class="tech-panel__head">
          <div>
            <div class="analytics-panel__eyebrow">结论</div>
            <h3 class="tech-panel__title">简短判断</h3>
          </div>
          <div class="tech-panel__note">只保留结论。</div>
        </div>

        <div class="tech-snapshot-list">
          <article v-for="item in architectureConclusionCards" :key="item.label" class="tech-snapshot-card">
            <span class="tech-snapshot-card__label">{{ item.label }}</span>
            <strong class="tech-snapshot-card__value">{{ item.value }}</strong>
            <p class="tech-snapshot-card__text">{{ item.note }}</p>
          </article>
        </div>
      </section>
    </div>

    <section v-else class="analytics-panel tech-panel">
      <div class="tech-panel__head">
        <div>
          <div class="analytics-panel__eyebrow">入口</div>
          <h3 class="tech-panel__title">实现入口导航</h3>
        </div>
        <div class="tech-panel__note">专题页继续看数据，治理页继续看动作。</div>
      </div>

      <div class="tech-entry-groups">
        <article v-for="group in entryGroups" :key="group.title" class="tech-entry-group">
          <div class="tech-entry-group__head">
            <div class="tech-entry-group__title">{{ group.title }}</div>
            <div class="tech-entry-group__text">{{ group.note }}</div>
          </div>
          <div class="tech-entry-group__grid">
            <button
              v-for="item in group.items"
              :key="item.route"
              type="button"
              class="tech-entry-button"
              @click="goTo(item.route)"
            >
              <span>{{ item.label }}</span>
              <strong>进入页面</strong>
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import PageSectionTabs from '../../components/PageSectionTabs.vue'

const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'stack', label: '技术版图', hint: '技术栈', description: '' },
  { key: 'architecture', label: '架构分层', hint: '职责', description: '' },
  { key: 'entry', label: '实现入口', hint: '页面', description: '' },
]

const tabKeySet = new Set(tabs.map(item => item.key))
const normalizeTab = value => {
  const next = String(value || '').trim()
  return tabKeySet.has(next) ? next : tabs[0].key
}

const activeTab = ref(normalizeTab(route.query.tab))
const activeTabInfo = computed(() => tabs.find(item => item.key === activeTab.value) || tabs[0])

const techDomains = [
  {
    eyebrow: '交互',
    title: '交互载体',
    goal: '承接行为信号',
    summary: '统一接收浏览、搜索、加购、负反馈等行为，为推荐和画像回流提供入口。',
    stack: ['微信交互载体', '行为采集', '推荐反馈', '曝光归因'],
  },
  {
    eyebrow: '推荐',
    title: '推荐与个性化',
    goal: '提升点击与转化',
    summary: '把协同过滤、内容相似和热榜兜底压成一套可解释的排序结果。',
    stack: ['user-item 矩阵', '余弦相似度', 'Hybrid', 'Top-N', 'Precision@K', 'Recall@K'],
  },
  {
    eyebrow: '实时',
    title: '实时计算与指标回流',
    goal: '保持结果新鲜',
    summary: '分钟级更新热门商品、用户快照和推荐结果，让演示页始终有可读数据。',
    stack: ['Kafka', 'Flink CDC', 'Flink SQL', 'DWD / DWS', 'Redis Sink', 'ECharts'],
  },
  {
    eyebrow: '治理',
    title: '交易与服务治理',
    goal: '保证稳定可用',
    summary: '异常时回退热榜、限流和缓存兜底，保证接口与页面都能继续展示。',
    stack: ['Spring Boot', 'MySQL', 'Redis', 'JWT', '事务控制', '限流'],
  },
]

const architectureLayers = [
  {
    title: '交互层（管理端 / 用户端）',
    role: '信号回流',
    stack: ['交互载体', '推荐预览', '实时快照', '图表展示'],
    pageLabel: '承接查询、行为和反馈，输出可视化结果。',
  },
  {
    title: '业务服务层（后端 API）',
    role: '业务编排',
    stack: ['Spring Boot', 'Spring Security', 'MyBatis', 'JWT', 'Redis'],
    pageLabel: '统一管理商品、订单、推荐、实验和风控接口。',
  },
  {
    title: '分析计算层（离线 + 实时）',
    role: '画像与排序',
    stack: ['协同过滤', '内容相似', 'Hybrid', 'Kafka', 'Flink', '指标回流'],
    pageLabel: '负责分群、召回、排序和效果评估。',
  },
  {
    title: '存储缓存层',
    role: '持久化与加速',
    stack: ['MySQL', 'Redis', '本地文件 / OSS'],
    pageLabel: '保存商品、行为、画像、推荐结果和实验快照。',
  },
]

const implementationPages = [
  { label: '推荐效果分析', route: '/admin/analytics/recommend' },
  { label: '用户分群画像', route: '/admin/analytics/user-clusters' },
  { label: '实时流式看板', route: '/admin/analytics/realtime-stream' },
  { label: '推荐预览', route: '/admin/recommend/preview' },
  { label: 'A/B 实验', route: '/admin/recommend/abtest' },
  { label: '经营诊断', route: '/admin/analytics/bigdata' },
]

const entryGroups = [
  {
    title: '数据与推荐专题',
    note: '继续看效果、分群和实时变化。',
    items: implementationPages.slice(0, 3),
  },
  {
    title: '推荐验证入口',
    note: '继续看用户命中、算法差异和实验结果。',
    items: implementationPages.slice(3, 5),
  },
  {
    title: '经营承接入口',
    note: '继续看业务结果和转化承接。',
    items: implementationPages.slice(5),
  },
]

const techSummaryCards = computed(() => [
  { label: '交互入口', value: '行为 + 查询', sub: '前端统一承接回流信号' },
  { label: '排序策略', value: 'Hybrid / Top-N', sub: '协同、内容、热度混合计算' },
  { label: '实时链路', value: 'Kafka + Flink + Redis', sub: '分钟级快照更新结果' },
  { label: '技术分层', value: `${architectureLayers.length} 层`, sub: `${implementationPages.length} 个专题入口可联查` },
])
const techHeroHighlights = computed(() => [
  {
    label: '交互入口',
    value: '行为 + 查询',
    note: '统一承接浏览、搜索、加购、下单和后台查询。',
  },
  {
    label: '排序策略',
    value: 'Hybrid / Top-N',
    note: '协同过滤、内容相似和热度兜底混合排序。',
  },
  {
    label: '实时链路',
    value: 'Kafka + Flink + Redis',
    note: '分钟级更新热榜、画像和推荐快照。',
  },
  {
    label: '专题入口',
    value: `${implementationPages.length} 个`,
    note: `${architectureLayers.length} 层结构都能落到具体页面验证。`,
  },
])

const techSnapshotCards = computed(() => [
  { label: '主解释方式', value: '依据 + 数据 + 结论', note: '每块都能直接说明为什么这样推荐。' },
  { label: '结果输出', value: 'Top-N + 指标 + 解释', note: '能同时看到推荐结果、点击转化和简短依据。' },
  { label: '数据时效', value: '分钟级快照', note: '热门商品、用户画像和实验结果可快速刷新。' },
  { label: '异常兜底', value: '热榜回退', note: '服务波动时优先保证页面继续有可读结果。' },
])

const architectureConclusionCards = computed(() => [
  { label: '前台承接', value: '交互载体 + 管理端', note: '用户行为和管理员查询都能被统一解释。' },
  { label: '核心计算', value: '画像 + 排序 + 分群', note: '不是只看热榜，而是按用户差异做推荐。' },
  { label: '运行保障', value: '缓存 + 限流 + 事务', note: '优先保证一致性和可用性。' },
  { label: '讲解重点', value: '数据怎么进、结果怎么出', note: '把复杂链路压缩为可展示的四层结构。' },
])

const headMeta = computed(() => {
  const routeText = `${implementationPages.length} 个入口页可以直接联查`
  return `这页重点不是堆框架名，而是说明“交互、排序、回流、稳定性”四块怎么配合，${routeText}。`
})

function goTo(path) {
  router.push(path)
}

watch(
  () => route.query.tab,
  value => {
    const next = normalizeTab(value)
    if (next !== activeTab.value) {
      activeTab.value = next
    }
  }
)

watch(activeTab, value => {
  const next = normalizeTab(value)
  const current = normalizeTab(route.query.tab)
  if (next === current) {
    return
  }
  router.replace({
    query: {
      ...route.query,
      tab: next === tabs[0].key ? undefined : next,
    },
  })
})
</script>

<style scoped>
.tech-compact-head {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(280px, 0.82fr);
  gap: 20px;
  align-items: start;
}

.tech-compact-head__kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #0f766e;
}

.tech-compact-head__title {
  margin-top: 8px;
  font-size: 40px;
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #020617;
}

.tech-compact-head__summary,
.tech-compact-head__aside p {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.8;
  color: #64748b;
}

.tech-compact-head__aside {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  padding: 18px 18px 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 0.86));
}

.tech-compact-head__tag,
.tech-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.86);
  color: #475569;
}

.tech-compact-head__tag {
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
}

.tech-stack-grid,
.tech-architecture-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.22fr) minmax(320px, 0.78fr);
  gap: 20px;
  align-items: start;
}

.tech-panel {
  padding: 22px;
}

.tech-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tech-panel__title {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.tech-panel__note {
  max-width: 240px;
  font-size: 12px;
  line-height: 1.7;
  text-align: right;
  color: #64748b;
}

.tech-domain-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.tech-domain-card,
.tech-snapshot-card,
.tech-entry-group {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  background: rgba(248, 250, 252, 0.82);
}

.tech-domain-card {
  padding: 18px;
}

.tech-domain-card__top,
.tech-layer-row__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tech-domain-card__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #94a3b8;
}

.tech-domain-card__title,
.tech-entry-group__title {
  margin-top: 6px;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
}

.tech-domain-card__summary,
.tech-entry-group__text,
.tech-layer-row__text,
.tech-snapshot-card__text {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.75;
  color: #64748b;
}

.tech-domain-card__chips,
.tech-layer-row__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.tech-chip {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
}

.tech-chip--goal {
  font-weight: 700;
  color: #0f766e;
}

.tech-snapshot-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.tech-snapshot-card {
  padding: 16px;
}

.tech-snapshot-card__label {
  font-size: 12px;
  color: #64748b;
}

.tech-snapshot-card__value {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}

.tech-link-mini-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.tech-link-mini,
.tech-entry-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  padding: 12px 14px;
  text-align: left;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.tech-link-mini:hover,
.tech-entry-button:hover {
  border-color: rgba(14, 165, 233, 0.34);
  transform: translateY(-1px);
}

.tech-link-mini span,
.tech-entry-button span {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.tech-link-mini strong,
.tech-entry-button strong {
  font-size: 12px;
  color: #0f766e;
}

.tech-layer-list {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.tech-layer-row {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  padding: 18px;
  background: rgba(248, 250, 252, 0.8);
}

.tech-layer-row__index {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  border-radius: 14px;
  background: rgba(14, 165, 233, 0.1);
  font-size: 14px;
  font-weight: 800;
  color: #0369a1;
}

.tech-layer-row__title {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.tech-entry-groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.tech-entry-group {
  padding: 18px;
}

.tech-entry-group__grid {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.dark .tech-compact-head__kicker {
  color: #67e8f9;
}

.dark .tech-compact-head__title,
.dark .tech-panel__title,
.dark .tech-domain-card__title,
.dark .tech-entry-group__title,
.dark .tech-layer-row__title,
.dark .tech-snapshot-card__value,
.dark .tech-link-mini span,
.dark .tech-entry-button span {
  color: #f8fafc;
}

.dark .tech-compact-head__summary,
.dark .tech-compact-head__aside p,
.dark .tech-panel__note,
.dark .tech-domain-card__summary,
.dark .tech-entry-group__text,
.dark .tech-layer-row__text,
.dark .tech-snapshot-card__text,
.dark .tech-snapshot-card__label {
  color: #94a3b8;
}

.dark .tech-compact-head__aside,
.dark .tech-domain-card,
.dark .tech-snapshot-card,
.dark .tech-entry-group,
.dark .tech-layer-row {
  border-color: rgba(71, 85, 105, 0.5);
  background: rgba(15, 23, 42, 0.48);
}

.dark .tech-compact-head__tag,
.dark .tech-chip,
.dark .tech-link-mini,
.dark .tech-entry-button {
  border-color: rgba(71, 85, 105, 0.48);
  background: rgba(15, 23, 42, 0.62);
  color: #cbd5e1;
}

.dark .tech-chip--goal,
.dark .tech-link-mini strong,
.dark .tech-entry-button strong {
  color: #67e8f9;
}

.dark .tech-layer-row__index {
  background: rgba(8, 145, 178, 0.18);
  color: #67e8f9;
}

@media (max-width: 1280px) {
  .tech-stack-grid,
  .tech-architecture-grid,
  .tech-entry-groups,
  .tech-compact-head {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .tech-domain-grid {
    grid-template-columns: 1fr;
  }
}
</style>
