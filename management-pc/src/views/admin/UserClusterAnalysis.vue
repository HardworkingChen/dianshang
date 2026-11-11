<template>
  <div v-loading="pageLoading" class="space-y-6 analytics-ui-page analytics-page-shell">
    <AnalyticsPageHero
      kicker="用户分群"
      title="分群与样本验证"
      summary="看分群依据、价值对比和样本。"
      :meta="`依据 · 对比 · 画像 · 样本 · 当前模式 ${clusterModeLabel}`"
      :chips="['分群依据', '价值对比', '用户样本', '画像标签']"
      :highlights="clusterHeroHighlights"
    />

    <section class="analytics-metric-strip">
      <article v-for="item in clusterSummaryCards" :key="item.label" class="analytics-metric-strip__item">
        <span class="analytics-metric-strip__label">{{ item.label }}</span>
        <strong class="analytics-metric-strip__value">{{ item.value }}</strong>
        <span class="analytics-metric-strip__sub">{{ item.sub }}</span>
      </article>
    </section>

    <section class="analytics-panel cluster-showcase">
      <div class="cluster-showcase__head">
        <div>
          <div class="analytics-panel__eyebrow">分群依据</div>
          <h2 class="cluster-showcase__title">分群依据</h2>
        </div>
        <div class="cluster-showcase__facts">
          <el-tag type="primary" effect="plain" round>{{ clusterModeLabel }}</el-tag>
          <el-tag type="success" effect="plain" round>实际 K {{ currentActualClusterCount }}</el-tag>
          <el-tag type="warning" effect="plain" round>轮廓 {{ silhouetteScoreText }}</el-tag>
        </div>
      </div>

      <div class="cluster-showcase__grid">
        <div class="cluster-showcase__rules">
          <article v-for="rule in segmentDecisionRows.slice(0, 4)" :key="rule.name" class="cluster-showcase__rule">
            <strong>{{ rule.name }}</strong>
            <span>{{ rule.description }}</span>
          </article>
        </div>
        <div class="cluster-showcase__stats">
          <div v-for="item in kmeansCurrentFacts" :key="item.label" class="cluster-showcase__stat">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="analytics-panel p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">分群用户分布</h3>
          <el-tag type="info" effect="plain">共 {{ segments.length }} 个分群</el-tag>
        </div>
        <div v-if="segments.length" ref="distributionChartRef" class="h-80 w-full"></div>
        <el-empty v-else description="暂无分群数据" />
      </div>

      <div class="analytics-panel p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">分群价值对比</h3>
          <el-tag type="success" effect="plain">按人数与客单价对照</el-tag>
        </div>
        <div v-if="segments.length" ref="valueChartRef" class="h-80 w-full"></div>
        <el-empty v-else description="暂无对比数据" />
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">分群画像</h3>
        <el-button @click="loadOverview">刷新分群结果</el-button>
      </div>

      <div v-if="segments.length" class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <button
          v-for="segment in segments"
          :key="segment.segmentCode"
          type="button"
          class="w-full text-left analytics-panel p-6 transition-colors duration-200"
          :class="segmentCardClass(segment)"
          @click="selectSegment(segment.segmentCode)"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="text-lg font-bold text-gray-800 dark:text-gray-100">{{ segment.segmentName || segment.segmentCode }}</h4>
                <el-tag size="small" effect="plain">{{ segment.segmentCode }}</el-tag>
                <el-tag v-if="summaryMetrics.bestSegmentCode === segment.segmentCode" size="small" type="success">最佳分群</el-tag>
                <el-tag v-if="selectedSegmentCode === segment.segmentCode" size="small" type="primary">查看中</el-tag>
              </div>
            </div>
            <div class="text-right min-w-0 sm:min-w-[96px]">
              <div class="text-2xl font-bold text-gray-800 dark:text-gray-100">{{ formatNumber(segment.userCount) }}</div>
              <div class="text-xs text-gray-500 mt-1">用户数 / {{ formatPercent(segment.percentage) }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <div class="text-xs text-gray-500">90天订单金额</div>
              <div class="mt-1 font-semibold text-blue-600">{{ formatCurrency(segment.avgOrderAmount90d) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <div class="text-xs text-gray-500">90天订单数</div>
              <div class="mt-1 font-semibold text-emerald-600">{{ formatDecimal(segment.avgOrderCount90d) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <div class="text-xs text-gray-500">30天行为数</div>
              <div class="mt-1 font-semibold text-amber-600">{{ formatDecimal(segment.avgBehaviorCount30d) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
              <div class="text-xs text-gray-500">最近下单距今天数</div>
              <div class="mt-1 font-semibold text-purple-600">{{ formatDecimal(segment.avgRecencyDays) }}</div>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">偏好品类</div>
              <div class="flex flex-wrap gap-2">
                <el-tag
                  v-for="item in segment.topCategories || []"
                  :key="`${segment.segmentCode}-category-${item}`"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  {{ item }}
                </el-tag>
                <span v-if="!(segment.topCategories || []).length" class="text-xs text-gray-400">暂无偏好品类</span>
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">偏好标签</div>
              <div class="flex flex-wrap gap-2">
                <el-tag
                  v-for="item in segment.topTags || []"
                  :key="`${segment.segmentCode}-tag-${item}`"
                  size="small"
                  type="success"
                  effect="plain"
                >
                  {{ item }}
                </el-tag>
                <span v-if="!(segment.topTags || []).length" class="text-xs text-gray-400">暂无偏好标签</span>
              </div>
            </div>
          </div>

          <div class="panel-card--muted mt-5 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">分群初始特征数据</div>
              <el-tag size="small" type="info" effect="plain">
                共 {{ segmentFeatureRows(segment).length }} 项
              </el-tag>
            </div>

            <div v-if="segmentFeatureRows(segment).length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="item in segmentFeatureRows(segment)"
                :key="`${segment.segmentCode}-feature-${item.key}`"
                class="panel-card--muted px-4 py-3"
              >
                <div class="text-xs text-gray-500">{{ item.label }}</div>
                <div class="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {{ formatSegmentFeatureValue(item.key, item.value) }}
                </div>
              </div>
            </div>

            <div v-else class="text-xs text-gray-400">暂无该分群的初始特征数据</div>
          </div>

          <div v-if="(segment.activationPlan?.actions || []).length" class="panel-card--muted mt-5 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">落地动作</div>
              </div>
              <el-tag :type="segment.activationPlan?.priority === 'high' ? 'danger' : 'warning'" effect="light">
                {{ segment.activationPlan?.priority === 'high' ? '优先落地' : '常规落地' }}
              </el-tag>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                v-for="action in segment.activationPlan.actions || []"
                :key="`${segment.segmentCode}-${action.type}`"
                class="panel-card--muted p-4"
              >
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ action.title }}</div>
                <div class="mt-3 text-xs text-gray-500">关注指标：{{ action.metric }}</div>
              </div>
            </div>
          </div>
        </button>
      </div>
      <div v-else class="analytics-panel p-6">
        <el-empty description="暂无分群数据" />
      </div>
    </div>

    <div class="analytics-panel overflow-hidden">
      <div class="p-6 pb-4 flex flex-wrap gap-4 items-center justify-between">
        <div class="flex flex-wrap gap-4 items-center">
          <el-select v-model="selectedSegmentCode" class="w-full sm:w-72" placeholder="选择分群" clearable @change="handleSegmentChange">
            <el-option label="全部分群" value="" />
            <el-option
              v-for="segment in segments"
              :key="segment.segmentCode"
              :label="`${segment.segmentName} (${segment.segmentCode})`"
              :value="segment.segmentCode"
            />
          </el-select>
          <el-button type="primary" @click="loadUsers(1)">刷新用户</el-button>
        </div>
        <div class="text-sm text-gray-500">
          样本 {{ formatNumber(pagination.total) }}
        </div>
      </div>

      <div v-if="currentSegment" class="panel-card--muted mx-6 mb-4 p-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex-1 min-w-0 sm:min-w-[280px]">
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-base font-semibold text-gray-800 dark:text-gray-100">{{ currentSegment.segmentName }}</div>
              <el-tag size="small" effect="plain">{{ currentSegment.segmentCode }}</el-tag>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <el-tag type="primary">人数 {{ formatNumber(currentSegment.userCount) }}</el-tag>
            <el-tag type="success">占比 {{ formatPercent(currentSegment.percentage) }}</el-tag>
            <el-tag type="warning">30天行为 {{ formatDecimal(currentSegment.avgBehaviorCount30d) }}</el-tag>
          </div>
        </div>
      </div>

      <el-table
        v-loading="tableLoading"
        :data="users"
        class="!bg-transparent custom-table"
        :header-cell-style="{ background: 'transparent', color: 'inherit' }"
        :row-style="{ background: 'transparent' }"
      >
        <el-table-column prop="userId" label="用户ID" width="90" />
        <el-table-column label="用户信息" min-width="220">
          <template #default="{ row }">
            <div class="flex items-center gap-3">
              <el-avatar :size="40" :src="row.avatar">
                {{ (row.nickname || row.username || '?').charAt(0) }}
              </el-avatar>
              <div class="min-w-0">
                <div class="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {{ row.nickname || row.username || `用户${row.userId}` }}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  @{{ row.username || '--' }} · {{ row.phone || '未绑定手机号' }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="所属分群" width="170">
          <template #default="{ row }">
            <div class="space-y-1">
              <el-tag size="small" :type="row.isColdStart ? 'warning' : 'primary'">{{ row.segmentName || row.segmentCode || '--' }}</el-tag>
              <div class="text-xs text-gray-400">{{ row.segmentCode || '--' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="置信度" width="160">
          <template #default="{ row }">
            <el-progress
              :percentage="toPercent(row.confidenceScore)"
              :status="row.isColdStart ? 'warning' : undefined"
              :stroke-width="8"
              :show-text="false"
            />
            <div class="text-xs text-gray-500 mt-1">{{ formatPercent(row.confidenceScore) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="90天订单金额" width="130" align="right">
          <template #default="{ row }">{{ formatCurrency(row.orderAmount90d) }}</template>
        </el-table-column>
        <el-table-column label="30天行为数" prop="behaviorCount30d" width="120" align="center" />
        <el-table-column label="最近行为距今天数" width="150" align="center">
          <template #default="{ row }">{{ formatRecencyDays(row.recencyBehaviorDays) }}</template>
        </el-table-column>
        <el-table-column label="画像摘要" min-width="280">
          <template #default="{ row }">
            <span class="text-sm text-gray-600 dark:text-gray-300">{{ row.personaSummary || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openUserDetail(row)">查看画像</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="p-4 border-t border-gray-200/50 dark:border-gray-700/50 flex justify-end">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          background
          layout="total, prev, pager, next"
          :total="pagination.total"
          @current-change="loadUsers"
        />
      </div>
    </div>

    <el-drawer v-model="detailVisible" title="用户分群详情" size="min(92vw, 640px)">
      <div v-loading="detailLoading" class="space-y-6">
        <div v-if="detail.userId" class="space-y-6">
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40">
            <el-avatar :size="64" :src="detail.avatar">
              {{ (detail.nickname || detail.username || '?').charAt(0) }}
            </el-avatar>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {{ detail.nickname || detail.username || `用户${detail.userId}` }}
                </h3>
                <el-tag size="small" :type="detail.isColdStart ? 'warning' : 'primary'">
                  {{ detail.segmentName || detail.segmentCode || '--' }}
                </el-tag>
                <el-tag v-if="detail.detailSource === 'derived'" size="small" type="warning" effect="light">
                  列表降级画像
                </el-tag>
              </div>
              <p class="text-sm text-gray-500 mt-1">
                @{{ detail.username || '--' }} · {{ detail.phone || '未绑定手机号' }}
              </p>
              <p class="text-sm text-gray-500 mt-1">
                注册时间 {{ formatDateTime(detail.userCreateTime) }}
              </p>
            </div>
          </div>

          <div class="rounded-2xl bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 p-4">
            <div class="text-sm font-semibold text-blue-700 dark:text-blue-300">为什么这个用户会被分到当前分群</div>
            <p v-if="Number(detail.isColdStart) === 1" class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              该用户满足冷启动规则：近90天订单数为 0，且近30天行为数小于 3，因此不会进入 KMeans 计算，而是直接归入 `COLD_START` 观察人群。
            </p>
            <p v-else class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              系统先对订单、行为和注册时长等特征做 `StandardScaler` 标准化，再计算用户与每个簇中心的距离，距离最小的簇就是当前分群。该用户当前距离中心
              {{ formatDecimal(detail.distanceToCenter, 6) }}，分群置信度 {{ formatPercent(detail.confidenceScore) }}。
            </p>
          </div>

          <div
            v-if="detail.detailSource === 'derived'"
            class="rounded-2xl bg-amber-50/90 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200"
          >
            用户画像明细接口当前返回异常，下面的数据已降级为“最新分群结果 + 当前样本列表”的真实快照，不再展示演示假数据。
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-center">
              <div class="text-xl font-bold text-blue-600">{{ formatPercent(detail.confidenceScore) }}</div>
              <div class="text-xs text-gray-500 mt-1">分群置信度</div>
            </div>
            <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-center">
              <div class="text-xl font-bold text-emerald-600">{{ formatCurrency(detail.orderAmount90d) }}</div>
              <div class="text-xs text-gray-500 mt-1">90天订单金额</div>
            </div>
            <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-center">
              <div class="text-xl font-bold text-amber-600">{{ formatDetailNumber(detail.behaviorCount30d) }}</div>
              <div class="text-xs text-gray-500 mt-1">30天行为数</div>
            </div>
            <div class="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-center">
              <div class="text-xl font-bold text-purple-600">{{ formatDetailNumber(detail.activeDays30d) }}</div>
              <div class="text-xs text-gray-500 mt-1">30天活跃天数</div>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">用户画像摘要</div>
            <p class="text-sm leading-6 text-gray-600 dark:text-gray-300">
              {{ detail.personaSummary || '暂无画像摘要' }}
            </p>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="90天订单数">{{ formatDetailNumber(detail.orderCount90d) }}</el-descriptions-item>
            <el-descriptions-item label="90天平均客单价">{{ formatCurrency(detail.avgOrderAmount90d) }}</el-descriptions-item>
            <el-descriptions-item label="90天品类数">{{ formatDetailNumber(detail.distinctCategoryCount90d) }}</el-descriptions-item>
            <el-descriptions-item label="30天浏览数">{{ formatDetailNumber(detail.viewCount30d) }}</el-descriptions-item>
            <el-descriptions-item label="30天加购数">{{ formatDetailNumber(detail.cartCount30d) }}</el-descriptions-item>
            <el-descriptions-item label="30天收藏数">{{ formatDetailNumber(detail.favoriteCount30d) }}</el-descriptions-item>
            <el-descriptions-item label="30天购买行为数">{{ formatDetailNumber(detail.purchaseBehaviorCount30d) }}</el-descriptions-item>
            <el-descriptions-item label="平均停留时长">{{ formatOptionalDecimal(detail.avgDuration30d) }}</el-descriptions-item>
            <el-descriptions-item label="最近下单距今天数">{{ formatDetailNumber(detail.recencyOrderDays) }}</el-descriptions-item>
            <el-descriptions-item label="最近行为距今天数">{{ formatRecencyDays(detail.recencyBehaviorDays) }}</el-descriptions-item>
            <el-descriptions-item label="注册时长">{{ formatDetailNumber(detail.tenureDays) }}</el-descriptions-item>
            <el-descriptions-item label="批次号">{{ detail.task?.batchNo || '--' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="detail.segment" class="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800/40">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <div class="text-sm font-semibold text-cyan-700 dark:text-cyan-300">所属分群策略</div>
              <el-tag size="small" type="info" effect="plain">{{ detail.segment.segmentCode }}</el-tag>
            </div>
            <p class="text-sm leading-6 text-gray-600 dark:text-gray-300">
              {{ detail.segment.operationSuggestion || detail.segment.segmentDescription || '暂无策略说明' }}
            </p>
          </div>

          <div v-if="detail.segment?.activationPlan?.actions?.length" class="rounded-2xl bg-slate-50/90 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700/60 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">该分群的落地动作</div>
                <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {{ detail.segment.activationPlan.summary }}
                </p>
              </div>
              <el-tag :type="detail.segment.activationPlan.priority === 'high' ? 'danger' : 'warning'" effect="light">
                {{ detail.segment.activationPlan.priority === 'high' ? '优先执行' : '常规执行' }}
              </el-tag>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div
                v-for="action in detail.segment.activationPlan.actions || []"
                :key="`detail-action-${action.type}`"
                class="rounded-2xl bg-white/90 dark:bg-gray-800/80 border border-white/70 dark:border-gray-700/60 p-4"
              >
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ action.title }}</div>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{{ action.description }}</p>
                <div class="mt-3 text-xs text-gray-500">关注指标：{{ action.metric }}</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200">
                原始特征
              </div>
              <el-table v-if="rawFeatureRows.length" :data="rawFeatureRows" size="small" max-height="280">
                <el-table-column prop="label" label="特征" min-width="160" />
                <el-table-column prop="value" label="值" min-width="120" align="right">
                  <template #default="{ row }">{{ formatLooseValue(row.value) }}</template>
                </el-table-column>
              </el-table>
              <div v-else class="px-4 py-6 text-sm text-gray-400">暂无原始特征数据</div>
            </div>

            <div class="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200">
                标准化特征
              </div>
              <el-table v-if="normalizedFeatureRows.length" :data="normalizedFeatureRows" size="small" max-height="280">
                <el-table-column prop="label" label="特征" min-width="160" />
                <el-table-column prop="value" label="值" min-width="120" align="right">
                  <template #default="{ row }">{{ formatLooseValue(row.value) }}</template>
                </el-table-column>
              </el-table>
              <div v-else class="px-4 py-6 text-sm text-gray-400">暂无标准化特征数据</div>
            </div>
          </div>
        </div>

        <el-empty v-else description="暂无用户画像数据" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import AnalyticsPageHero from '../../components/analytics/AnalyticsPageHero.vue'
import {
  getAdminKmeansLatestTask,
  getAdminKmeansSegments,
  getAdminKmeansSummary,
  getAdminKmeansUserDetail,
  getAdminKmeansUsers,
} from '../../api/admin'

const SEGMENT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4']
const FIELD_LABELS = {
  order_count_90d: '90天订单数',
  order_amount_90d: '90天订单金额',
  avg_order_amount_90d: '90天平均客单价',
  distinct_category_count_90d: '90天品类数',
  behavior_count_30d: '30天行为数',
  view_count_30d: '30天浏览数',
  cart_count_30d: '30天加购数',
  favorite_count_30d: '30天收藏数',
  purchase_behavior_count_30d: '30天购买行为数',
  active_days_30d: '30天活跃天数',
  avg_duration_30d: '30天平均停留时长',
  recency_order_days: '最近下单距今天数',
  recency_behavior_days: '最近行为距今天数',
  tenure_days: '注册时长',
}

const pageLoading = ref(false)
const tableLoading = ref(false)
const detailLoading = ref(false)
const latestTask = ref({})
const summary = ref({})
const segments = ref([])
const users = ref([])
const selectedSegmentCode = ref('')
const detailVisible = ref(false)
const detail = ref({})
const distributionChartRef = ref(null)
const valueChartRef = ref(null)

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0,
})

let distributionChart = null
let valueChart = null
let themeObserver = null
let echartsModule = null

const UNKNOWN_RECENCY_DAYS = 9999

const summaryMetrics = computed(() => summary.value.summary || {})
const segmentCount = computed(() => summary.value.segmentCount || latestTask.value.clusterCount || segments.value.length || 0)
const requestedClusterCount = computed(() => summaryMetrics.value.requestedClusterCount || segmentCount.value)
const currentActualClusterCount = computed(() =>
  Number(summaryMetrics.value.actualClusterCount || latestTask.value.clusterCount || segments.value.filter(item => item.segmentCode !== 'COLD_START').length || 0)
)
const sampleUserCount = computed(() => summaryMetrics.value.sampleUserCount || latestTask.value.sampleUserCount || 0)
const clusteredUserCount = computed(() => summaryMetrics.value.clusteredUserCount || latestTask.value.clusteredUserCount || 0)
const coldStartUserCount = computed(() => summaryMetrics.value.coldStartUserCount || latestTask.value.coldStartUserCount || 0)
const clusterSummaryCards = computed(() => [
  {
    label: '分群数量',
    value: formatNumber(segmentCount.value),
    sub: '人群簇',
  },
  {
    label: '样本用户数',
    value: formatNumber(sampleUserCount.value),
    sub: '建模样本',
  },
  {
    label: '进入聚类用户',
    value: formatNumber(clusteredUserCount.value),
    sub: 'KMeans 样本',
  },
  {
    label: '冷启动观察用户',
    value: formatNumber(coldStartUserCount.value),
    sub: '单独观察',
  },
])
const clusterHeroHighlights = computed(() => [
  {
    label: '分群数量',
    value: formatNumber(segmentCount.value),
    note: `当前实际 K ${formatNumber(currentActualClusterCount.value)}`,
  },
  {
    label: '样本用户',
    value: formatNumber(sampleUserCount.value),
    note: `${formatNumber(clusteredUserCount.value)} 人进入聚类`,
  },
  {
    label: '冷启动观察',
    value: formatNumber(coldStartUserCount.value),
    note: '低样本用户单独观察，不混入聚类结果。',
  },
  {
    label: '最佳分群',
    value: bestSegment.value ? `${bestSegment.value.segmentName} (${bestSegment.value.segmentCode})` : (summaryMetrics.value.bestSegmentCode || '--'),
    note: `轮廓 ${silhouetteScoreText.value} · 惯性 ${inertiaScoreText.value}`,
  },
])
const clusterSelection = computed(() => summaryMetrics.value.clusterSelection || {})
const clusterModeLabel = computed(() => clusterSelection.value.mode === 'auto_silhouette' ? '轮廓系数自动选 K' : '固定 K')
const silhouetteScoreText = computed(() => formatDecimal(latestTask.value?.silhouetteScore, 4))
const inertiaScoreText = computed(() => formatDecimal(latestTask.value?.inertiaScore, 6))
const bestSegment = computed(() =>
  segments.value.find(item => item.segmentCode === summaryMetrics.value.bestSegmentCode) || null
)
const currentSegment = computed(() =>
  segments.value.find(item => item.segmentCode === selectedSegmentCode.value) || null
)
const rawFeatureRows = computed(() => mapObjectRows(detail.value.rawFeatures))
const normalizedFeatureRows = computed(() => mapObjectRows(detail.value.normalizedFeatures))
const segmentDecisionRows = computed(() => {
  const rows = [
    {
      name: '冷启动观察用户',
      description: coldStartUserCount.value
        ? `近90天无订单且近30天行为较少，本轮共 ${formatNumber(coldStartUserCount.value)} 人单独观察。`
        : '近90天无订单且近30天行为较少，不进入本轮 KMeans 聚类。',
    },
  ]

  const liveSegments = [...segments.value]
    .filter(item => item.segmentCode !== 'COLD_START')
    .sort((left, right) => Number(right.userCount || 0) - Number(left.userCount || 0))
    .slice(0, 3)

  liveSegments.forEach(segment => {
    rows.push({
      name: segment.segmentName || segment.segmentCode,
      description: segment.segmentDescription
        || segment.operationSuggestion
        || `当前占比 ${formatPercent(segment.percentage)}，90天订单金额 ${formatCurrency(segment.avgOrderAmount90d)}。`,
    })
  })

  return rows
})
const kmeansCurrentFacts = computed(() => [
  {
    label: '聚类模式',
    value: clusterModeLabel.value,
    sub: clusterSelection.value.mode === 'auto_silhouette'
      ? '候选 K'
      : '固定 K',
  },
  {
    label: '请求 / 实际 K',
    value: `${formatNumber(requestedClusterCount.value)} / ${formatNumber(currentActualClusterCount.value)}`,
    sub: '任务参数',
  },
  {
    label: '轮廓系数 / 惯性',
    value: `${silhouetteScoreText.value} / ${inertiaScoreText.value}`,
    sub: '质量',
  },
  {
    label: '最佳分群',
    value: bestSegment.value ? `${bestSegment.value.segmentName} (${bestSegment.value.segmentCode})` : (summaryMetrics.value.bestSegmentCode || '--'),
    sub: '运营重点',
  },
])

function formatFieldLabel(key) {
  if (!key) return '--'
  if (FIELD_LABELS[key]) {
    return FIELD_LABELS[key]
  }
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, match => match.toUpperCase())
}

function formatNumber(value) {
  if (value == null || value === '') return '0'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toLocaleString('zh-CN')
}

function formatDetailNumber(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toLocaleString('zh-CN')
}

function formatDecimal(value, digits = 2) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toFixed(digits)
}

function formatOptionalDecimal(value, digits = 2) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toFixed(digits)
}

function formatPercent(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  if (Number.isNaN(number)) return '--'
  const percent = number > 1 ? number : number * 100
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`
}

function toPercent(value) {
  if (value == null || value === '') return 0
  const number = Number(value)
  if (Number.isNaN(number)) return 0
  return Math.max(0, Math.min(100, Math.round((number > 1 ? number : number * 100) * 100) / 100))
}

function formatCurrency(value) {
  if (value == null || value === '') return '¥0.00'
  const number = Number(value)
  if (Number.isNaN(number)) return '¥0.00'
  return `¥${number.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatRecencyDays(value) {
  if (value == null || value === '') return '--'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  if (number >= UNKNOWN_RECENCY_DAYS) return '长期未活跃'
  return number.toLocaleString('zh-CN')
}

function formatLooseValue(value) {
  if (value == null || value === '') return '--'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? formatNumber(value) : formatDecimal(value)
  }
  const number = Number(value)
  if (!Number.isNaN(number) && String(value).trim() !== '') {
    return Number.isInteger(number) ? formatNumber(number) : formatDecimal(number)
  }
  return String(value)
}

function normalizeObject(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }
  if (typeof value !== 'string') {
    return {}
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function mapObjectRows(source) {
  const object = normalizeObject(source)
  return Object.entries(object).map(([key, value]) => ({
    key,
    label: formatFieldLabel(key),
    value,
  }))
}

function segmentFeatureRows(segment) {
  return mapObjectRows(segment?.featureCenter)
}

function formatSegmentFeatureValue(key, value) {
  const normalizedKey = String(key || '').toLowerCase()
  if (normalizedKey.includes('amount') || normalizedKey.includes('price')) {
    return formatCurrency(value)
  }
  if (normalizedKey.includes('score') || normalizedKey.includes('ratio')) {
    return formatDecimal(value, 4)
  }
  return formatLooseValue(value)
}

function normalizeSegments(payload) {
  if (Array.isArray(payload)) {
    return payload
  }
  if (Array.isArray(payload?.records)) {
    return payload.records
  }
  return []
}

function getSegmentColor(segmentCode) {
  const index = segments.value.findIndex(item => item.segmentCode === segmentCode)
  return SEGMENT_COLORS[index >= 0 ? index % SEGMENT_COLORS.length : 0]
}

function segmentCardClass(segment) {
  if (selectedSegmentCode.value === segment.segmentCode) {
    return 'border-blue-400/70 dark:border-blue-500/60 ring-2 ring-blue-400/30'
  }
  return 'border-white/20 dark:border-gray-700/30'
}

function selectSegment(segmentCode) {
  selectedSegmentCode.value = segmentCode || ''
  loadUsers(1)
}

function findSegmentByCode(segmentCode) {
  return segments.value.find(item => item.segmentCode === segmentCode) || null
}

function buildFallbackRawFeatures(row) {
  return {
    order_count_90d: row?.orderCount90d ?? null,
    order_amount_90d: row?.orderAmount90d ?? null,
    avg_order_amount_90d: row?.avgOrderAmount90d ?? null,
    behavior_count_30d: row?.behaviorCount30d ?? null,
    active_days_30d: row?.activeDays30d ?? null,
    recency_order_days: row?.recencyOrderDays ?? null,
    recency_behavior_days: row?.recencyBehaviorDays ?? null,
  }
}

function buildUserDetailPayload(payload = {}, row = {}, detailSource = 'live') {
  const merged = {
    ...row,
    ...payload,
  }
  const fallbackTask = latestTask.value?.batchNo ? { batchNo: latestTask.value.batchNo } : null
  const segment = payload?.segment || findSegmentByCode(merged.segmentCode)

  return {
    ...merged,
    avgOrderAmount90d: merged.avgOrderAmount90d ?? (merged.orderCount90d ? Number(merged.orderAmount90d || 0) / Number(merged.orderCount90d) : null),
    detailSource,
    fallbackNotice: detailSource === 'derived',
    segment,
    task: payload?.task || fallbackTask,
    rawFeatures: detailSource === 'live'
      ? normalizeObject(payload?.rawFeatures)
      : buildFallbackRawFeatures(merged),
    normalizedFeatures: detailSource === 'live'
      ? normalizeObject(payload?.normalizedFeatures)
      : {},
  }
}

async function getEcharts() {
  if (!echartsModule) {
    echartsModule = await import('echarts')
  }
  return echartsModule
}

function disposeCharts() {
  distributionChart?.dispose()
  valueChart?.dispose()
  distributionChart = null
  valueChart = null
}

async function renderCharts() {
  if (!distributionChartRef.value || !valueChartRef.value || !segments.value.length) {
    disposeCharts()
    return
  }

  disposeCharts()

  const isDark = document.documentElement.classList.contains('dark')
  const textColor = isDark ? '#d1d5db' : '#4b5563'
  const splitLine = isDark ? '#374151' : '#e5e7eb'
  const echarts = await getEcharts()

  distributionChart = echarts.init(distributionChartRef.value)
  distributionChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: params => `${params.name}<br/>用户数: ${formatNumber(params.value)}<br/>占比: ${params.percent}%`,
    },
    legend: {
      bottom: 8,
      type: 'scroll',
      textStyle: { color: textColor },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '72%'],
      center: ['50%', '40%'],
      itemStyle: {
        borderRadius: 10,
        borderColor: isDark ? '#1f2937' : '#ffffff',
        borderWidth: 2,
      },
      label: { show: false },
      emphasis: { label: { show: true, color: textColor, formatter: '{b}\n{d}%' } },
      data: segments.value.map(segment => ({
        value: Number(segment.userCount || 0),
        name: segment.segmentName || segment.segmentCode,
        itemStyle: { color: getSegmentColor(segment.segmentCode) },
      })),
    }],
  })

  valueChart = echarts.init(valueChartRef.value)
  valueChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      data: ['用户数', '90天订单金额'],
      textStyle: { color: textColor },
    },
    grid: {
      left: '4%',
      right: '4%',
      top: 44,
      bottom: 72,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: segments.value.map(segment => segment.segmentName || segment.segmentCode),
      axisLabel: {
        color: textColor,
        interval: 0,
        rotate: segments.value.some(segment => String(segment.segmentName || segment.segmentCode || '').length > 6) ? 18 : 0,
        formatter: value => String(value || '').replace(/\s+/g, '\n'),
      },
      axisLine: { lineStyle: { color: splitLine } },
    },
    yAxis: [
      {
        type: 'value',
        name: '用户数',
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLine, type: 'dashed' } },
      },
      {
        type: 'value',
        name: '订单金额',
        axisLabel: {
          color: textColor,
          formatter: value => `¥${value}`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '用户数',
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: params => getSegmentColor(segments.value[params.dataIndex]?.segmentCode),
        },
        data: segments.value.map(segment => Number(segment.userCount || 0)),
      },
      {
        name: '90天订单金额',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: '#ef4444',
        },
        itemStyle: { color: '#ef4444' },
        data: segments.value.map(segment => Number(segment.avgOrderAmount90d || 0)),
      },
    ],
  })
}

function handleResize() {
  distributionChart?.resize()
  valueChart?.resize()
}

async function loadOverview() {
  pageLoading.value = true
  try {
    const [taskResult, summaryResult, segmentResult] = await Promise.allSettled([
      getAdminKmeansLatestTask(),
      getAdminKmeansSummary(),
      getAdminKmeansSegments(),
    ])

    latestTask.value = taskResult.status === 'fulfilled' ? taskResult.value || {} : {}
    summary.value = summaryResult.status === 'fulfilled' ? summaryResult.value || {} : {}
    segments.value = segmentResult.status === 'fulfilled'
      ? normalizeSegments(segmentResult.value)
      : []

    const segmentCodes = segments.value.map(item => item.segmentCode)
    if (selectedSegmentCode.value && !segmentCodes.includes(selectedSegmentCode.value)) {
      selectedSegmentCode.value = ''
    }
    if (!selectedSegmentCode.value && summaryMetrics.value.bestSegmentCode && segmentCodes.includes(summaryMetrics.value.bestSegmentCode)) {
      selectedSegmentCode.value = summaryMetrics.value.bestSegmentCode
    }
    if (!selectedSegmentCode.value && segmentCodes.length) {
      selectedSegmentCode.value = segmentCodes[0]
    }

    await nextTick()
    await renderCharts()
  } finally {
    pageLoading.value = false
  }
}

async function loadUsers(page = pagination.page) {
  tableLoading.value = true
  pagination.page = page
  try {
    const res = await getAdminKmeansUsers({
      page,
      size: pagination.size,
      segmentCode: selectedSegmentCode.value || undefined,
    })
    users.value = res?.records || []
    pagination.total = Number(res?.total || 0)
    pagination.page = Number(res?.current || page)
  } finally {
    tableLoading.value = false
  }
}

function handleSegmentChange(value) {
  selectedSegmentCode.value = value || ''
  loadUsers(1)
}

async function openUserDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = {}
  try {
    const res = await getAdminKmeansUserDetail(row.userId)
    detail.value = buildUserDetailPayload(res, row, 'live')
  } catch {
    detail.value = buildUserDetailPayload({}, row, 'derived')
  } finally {
    detailLoading.value = false
  }
}

onMounted(async () => {
  await loadOverview()
  await loadUsers(1)
  window.addEventListener('resize', handleResize)
  themeObserver = new MutationObserver(mutations => {
    if (mutations.some(item => item.attributeName === 'class')) {
      nextTick(() => {
        void renderCharts()
      })
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  themeObserver?.disconnect()
  disposeCharts()
})
</script>

<style scoped>
.cluster-page-header__summary {
  margin-top: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
}

.cluster-showcase {
  padding: 18px 20px 16px;
}

.cluster-showcase__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.cluster-showcase__title {
  margin-top: 6px;
  color: #0f172a;
  font-size: 22px;
  font-weight: 850;
}

.cluster-showcase__facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.cluster-showcase__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.95fr);
  gap: 14px;
  margin-top: 14px;
}

.cluster-showcase__rules,
.cluster-showcase__stats {
  display: grid;
  gap: 10px;
}

.cluster-showcase__rules {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.cluster-showcase__stats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.cluster-showcase__rule,
.cluster-showcase__stat {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.82);
  padding: 11px 12px;
}

.cluster-showcase__rule strong,
.cluster-showcase__stat strong {
  display: block;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
}

.cluster-showcase__rule span,
.cluster-showcase__stat span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.dark .cluster-showcase__title,
.dark .cluster-showcase__rule strong,
.dark .cluster-showcase__stat strong {
  color: #f8fafc;
}

.dark .cluster-showcase__rule,
.dark .cluster-showcase__stat {
  border-color: rgba(71, 85, 105, 0.58);
  background: rgba(15, 23, 42, 0.5);
}

.dark .cluster-showcase__rule span,
.dark .cluster-showcase__stat span {
  color: #cbd5e1;
}

.dark .cluster-page-header__summary {
  color: #cbd5e1;
}

@media (max-width: 960px) {
  .cluster-showcase__head,
  .cluster-showcase__grid {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .cluster-showcase__facts {
    justify-content: flex-start;
  }

  .cluster-showcase__rules {
    grid-template-columns: 1fr;
  }

  .cluster-showcase__stats {
    grid-template-columns: 1fr;
  }
}
</style>
