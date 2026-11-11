const app = getApp()
const request = require('../../utils/request')
const { resolveBannerImage } = require('../../utils/banner-image')
const { buildSafeWebviewUrl } = require('../../utils/webview')
const { resolveProductImage } = require('../../utils/image')
const recommendationTracker = require('../../utils/recommendation-tracker')
const { buildProductShareMessage } = require('../../utils/share')
const { filterOutSeckillProducts } = require('../../utils/seckill-filter')
const SECKILL_COUNTDOWN_WINDOW_MS = 12 * 60 * 60 * 1000
const DEFAULT_BANNERS = [
  {
    id: 'fallback-banner-71',
    image: 'https://cyy050722.oss-cn-beijing.aliyuncs.com/products/web-matched/2026/04/30/product-0071.jpg',
    title: '豫礼食养 · 道口烧鸡礼盒',
    subtitle: '先看馆内热卖礼盒，送礼和自留都更稳妥',
    linkType: 'none',
    linkValue: '',
  },
  {
    id: 'fallback-banner-75',
    image: 'https://cyy050722.oss-cn-beijing.aliyuncs.com/products/web-matched/2026/04/30/product-0075.jpg',
    title: '豫礼茶香 · 信阳毛尖礼盒',
    subtitle: '从茶礼到伴手礼，先挑两件更有代表性的河南好物',
    linkType: 'none',
    linkValue: '',
  },
]

const HENAN_INSPIRATIONS = [
  { id: 'xinyang-maojian', title: '信阳毛尖', keyword: '信阳毛尖', iconClass: 'icon-food', toneClass: 'tone-tea', iconImage: '/assets/local-goods/xinyang-maojian.png' },
  { id: 'daokou-chicken', title: '道口烧鸡', keyword: '道口烧鸡', iconClass: 'icon-food', toneClass: 'tone-food', iconImage: '/assets/local-goods/daokou-chicken.png' },
  { id: 'luoyang-peony', title: '洛阳牡丹', keyword: '洛阳牡丹', iconClass: 'icon-beauty', toneClass: 'tone-peony', iconImage: '/assets/local-goods/luoyang-peony.png' },
  { id: 'ruyao-junyao', title: '汝瓷钧瓷', keyword: '汝瓷', iconClass: 'icon-creative', toneClass: 'tone-porcelain', iconImage: '/assets/local-goods/ru-porcelain.png' },
  { id: 'nanyang-jade', title: '南阳玉雕', keyword: '南阳玉雕', iconClass: 'icon-creative', toneClass: 'tone-jade', iconImage: '/assets/local-goods/nanyang-jade.png' },
  { id: 'hulatang', title: '胡辣汤', keyword: '胡辣汤', iconClass: 'icon-food', toneClass: 'tone-soup', iconImage: '/assets/local-goods/hulatang.png' },
  { id: 'sweet-potato-noodle', title: '红薯粉条', keyword: '红薯粉条', iconClass: 'icon-food', toneClass: 'tone-grain', iconImage: '/assets/local-goods/sweet-potato-noodle.png' },
  { id: 'shaolin-culture', title: '少林文创', keyword: '少林', iconClass: 'icon-sport', toneClass: 'tone-shaolin', iconImage: '/assets/local-goods/shaolin-culture.png' },
]

const DEFAULT_INSPIRATIONS = HENAN_INSPIRATIONS

const CACHE_TTL = {
  STATIC: 30 * 60 * 1000,
  LIST: 3 * 60 * 1000,
  RECOMMEND: 2 * 60 * 1000,
  REALTIME: 20 * 1000
}

const RECOMMEND_ALGORITHM_TABS = [
  {
    key: 'hybrid',
    label: '猜你喜欢',
    badge: '为你',
    title: '猜你喜欢',
    explain: '结合你的浏览偏好和近期热卖实时更新',
    tag: '推荐逻辑',
  },
  {
    key: 'cf',
    label: '相似好物',
    badge: '相似',
    title: '逛过的人还买了',
    explain: '根据你最近浏览过的商品做相似推荐',
    tag: '推荐逻辑',
  },
  {
    key: 'hot',
    label: '大家都在买',
    badge: '热销',
    title: '热门畅销',
    explain: '近期成交和点击增长较快的商品都在这里',
    tag: '推荐逻辑',
  },
]

Page({
  data: {
    navColor: '#ffffff',
    isScrolled: false,
    unreadMessageCount: 0,
    currentBanner: 0,
    banners: [],
    inspirations: [],
    recommendAlgorithmTabs: RECOMMEND_ALGORITHM_TABS,
    activeRecommendAlgorithm: 'hybrid',
    recommendAlgorithmBadge: '为你',
    recommendTitle: '猜你喜欢',
    recommendExplain: '结合你的浏览偏好和近期热卖实时更新',
    recommendExplainTag: '推荐逻辑',
    products: [],
    latestProducts: [],
    seckillProducts: [],
    seckillHistoryMode: false,
    realtimeHotWindow: '1h',
    realtimeHotWindowLabel: '1小时',
    realtimeHotWindows: { '1m': [], '1h': [], '1d': [] },
    realtimeHotProducts: [],
    realtimeHotLastUpdate: '',
    realtimeHotLoading: false,
    belowFoldReady: false,
    loading: true,
    latestLoading: true,
    seckillLoading: true,
    interestSubmitting: false,
    loadingMore: false,
    hasMore: true,
    productPage: 1,
    showCouponPopup: false,
    unclaimedCount: 0,
    showInterestPopup: false,
    interestCategories: [],
    selectedInterestCount: 0,
    showRecommendEvidence: false,
    activeRecommendationEvidence: null
  },

  onLoad() {
    this._destroyed = false
    this.deferBelowFoldRender()
    this.loadHomeData()
  },

  clearHomeLocalCache() {
    return false
  },

  deferBelowFoldRender() {
    if (this._belowFoldTimer) {
      clearTimeout(this._belowFoldTimer)
    }
    this._belowFoldTimer = setTimeout(() => {
      this._belowFoldTimer = null
      this.safeSetData({ belowFoldReady: true })
    }, 260)
  },

  onShow() {
    this._destroyed = false
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
      app.applyMessageBadge()
    }
    this.safeSetData({ unreadMessageCount: app.getMessageUnreadCount() })
    Promise.allSettled([
      app.refreshMessageUnreadCount(),
      app.refreshCartCount(),
    ]).then((results) => {
      if (this.isPageInactive()) {
        return
      }
      const unreadResult = results[0]
      if (unreadResult && unreadResult.status === 'fulfilled') {
        this.safeSetData({ unreadMessageCount: unreadResult.value })
      }
    })
    this.handleEntryPopups()
  },

  onHide() {
    this._destroyed = true
    this.clearSeckillTicker()
  },

  onUnload() {
    this._destroyed = true
    if (this._belowFoldTimer) {
      clearTimeout(this._belowFoldTimer)
      this._belowFoldTimer = null
    }
    this.clearSeckillTicker()
  },

  isPageInactive() {
    return !!this._destroyed
  },

  safeSetData(nextData, callback) {
    if (this.isPageInactive() || !nextData) {
      return false
    }
    try {
      this.setData(nextData, callback)
      return true
    } catch (error) {
      return false
    }
  },

  checkInterestPopup() {
    if (!app.isLoggedIn()) return Promise.resolve(false)
    const today = this.getTodayKey()
    const shownState = wx.getStorageSync('interestPopupState')
    if (shownState && shownState.date === today) {
      return Promise.resolve(false)
    }

    return request.get('/recommendations/interest/status', {}, { showLoading: false })
      .then((statusRes) => {
        if (!statusRes || !statusRes.showInterestPopup) {
          return false
        }
        return request.get('/products/categories', {}, {
          showLoading: false,
          cacheTtl: CACHE_TTL.STATIC
        })
      })
      .then((categories) => {
        if (this.isPageInactive() || !Array.isArray(categories) || categories.length === 0) return false
        const items = categories.map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon || '',
          selected: false,
        }))
        this.safeSetData({ interestCategories: items, showInterestPopup: true })
        return true
      })
      .catch(() => false)
  },

  async handleEntryPopups() {
    const showedCouponPopup = await this.checkCouponPopup()
    if (!showedCouponPopup) {
      await this.checkInterestPopup()
      return
    }
    this.safeSetData({ showInterestPopup: false })
  },

  toggleInterest(e) {
    const idx = e.currentTarget.dataset.index
    const key = `interestCategories[${idx}].selected`
    const next = !this.data.interestCategories[idx].selected
    this.setData({ [key]: next })
    const count = this.data.interestCategories.filter(c => c.selected).length
    this.setData({ selectedInterestCount: count })
  },

  closeInterestPopup() {
    this.setData({ showInterestPopup: false })
    this.markPopupShown('interestPopupState')
  },

  async confirmInterest() {
    if (this.data.interestSubmitting) {
      return
    }
    const selected = this.data.interestCategories.filter(c => c.selected)
    if (selected.length === 0) return
    const categoryIds = selected
      .map(c => c.id)
      .filter(id => id !== null && id !== undefined && `${id}`.trim() !== '')
    try {
      this.setData({ interestSubmitting: true })
      await request.post('/recommendations/interest', {
        categoryIds,
      })
      wx.showToast({ title: '偏好已保存', icon: 'success' })
      this.markPopupShown('interestPopupState')
      this.closeInterestPopup()
      this.loadRecommendProducts(true)
    } catch (error) {
      const message = (error && (error.message || error.msg)) || '保存失败'
      wx.showToast({ title: message.slice(0, 12), icon: 'none' })
    } finally {
      this.setData({ interestSubmitting: false })
    }
  },

  async loadHomeData() {
    try {
      if (!this.data.banners.length || !this.data.inspirations.length) {
        this.safeSetData({
          banners: this.data.banners.length ? this.data.banners : DEFAULT_BANNERS,
          inspirations: this.data.inspirations.length ? this.data.inspirations : DEFAULT_INSPIRATIONS,
        })
      }

      // 先尝试从缓存加载数据
      const cachedBanners = this.getCachedData('cache_home_banners', 5 * 60 * 1000) // 5分钟有效期
      const cachedRecommendations = this.getCachedData('cache_home_recommendations', 5 * 60 * 1000)
      
      // 如果有缓存，先显示缓存数据
      if (cachedBanners || cachedRecommendations) {
        if (Array.isArray(cachedBanners) && cachedBanners.length) {
          const banners = cachedBanners.map(item => ({
            id: item.id,
            image: resolveBannerImage(item.title, item.image),
            title: item.title || '',
            subtitle: '',
            linkType: item.linkType || 'none',
            linkValue: item.linkValue || '',
          }))
          this.safeSetData({ banners })
        }

        const cachedRecommendRecords = Array.isArray(cachedRecommendations)
          ? cachedRecommendations
          : ((cachedRecommendations && cachedRecommendations.records) || [])

        if (cachedRecommendRecords.length) {
          const products = this.mapRecommendProducts(cachedRecommendRecords)
          this.safeSetData({
            products,
            loading: false
          })
        }
      }
      
      // 然后加载最新数据
      const [bannersRes] = await Promise.all([
        request.get('/products/banners', {}, {
          cacheTtl: CACHE_TTL.STATIC,
          forceRefresh: !!this._isPullRefreshing,
          showErrorToast: false
        }),
      ])

      const banners = (bannersRes || []).map(item => ({
        id: item.id,
        image: resolveBannerImage(item.title, item.image),
        title: item.title || '',
        subtitle: '',
        linkType: item.linkType || 'none',
        linkValue: item.linkValue || '',
      }))

      if (this.isPageInactive()) return
      this.safeSetData({
        banners: banners.length ? banners : DEFAULT_BANNERS,
        inspirations: DEFAULT_INSPIRATIONS,
      })
      this.setCachedData('cache_home_banners', banners.length ? bannersRes : DEFAULT_BANNERS)
      this._hasLoaded = true
      await Promise.allSettled([
        this.loadRecommendProducts(true),
        this.loadLatestProducts(),
        this.loadSeckillProducts(),
        this.loadRealtimeHotOverview(),
      ])
    } catch (error) {
      console.error('加载首页数据失败', error)
      if (this.isPageInactive()) return
      this.safeSetData({
        banners: this.data.banners.length ? this.data.banners : DEFAULT_BANNERS,
        inspirations: this.data.inspirations.length ? this.data.inspirations : DEFAULT_INSPIRATIONS,
        products: this.data.products || [],
        latestProducts: [],
        seckillProducts: [],
        seckillHistoryMode: false,
        realtimeHotWindows: { '1m': [], '1h': [], '1d': [] },
        realtimeHotProducts: [],
        realtimeHotLastUpdate: '',
        loading: false,
        latestLoading: false,
        seckillLoading: false,
        realtimeHotLoading: false,
      })
    }
  },

  // 获取缓存数据的辅助方法
  getCachedData(key, maxAge) {
    try {
      const cached = wx.getStorageSync(key)
      if (!cached || !cached.data || !cached.timestamp) {
        return null
      }
      
      const age = Date.now() - cached.timestamp
      if (age > maxAge) {
        // 缓存过期，删除
        wx.removeStorageSync(key)
        return null
      }
      
      return cached.data
    } catch (error) {
      return null
    }
  },

  setCachedData(key, data) {
    if (!key || data === undefined) return
    try {
      wx.setStorageSync(key, {
        data,
        timestamp: Date.now(),
      })
    } catch (error) {}
  },

  mapRecommendProducts(records) {
    if (!Array.isArray(records)) {
      return []
    }

    return this.diversifyProductList(filterOutSeckillProducts(records).map(item => {
      const normalizedId = item.id || item.productId || item.goodsId || null
      const seckillApplyId = Number(item.seckillApplyId || item.applyId || 0)
      const seckillStatus = Number(item.seckillStatus)
      const productImage = resolveProductImage(item)
      const reason = item.recommendReason || item.reason || '猜你喜欢'
      const reasonTags = this.normalizeReasonTags(item)
      const tag = Array.isArray(item.tags) && item.tags.length
        ? item.tags[0]
        : (reasonTags[0] || '猜你喜欢')

      return {
        id: normalizedId,
        image: productImage,
        title: this.compactProductTitle(item.name || item.title || ''),
        price: item.price,
        salesText: this.formatSalesText(item.salesCount || item.saleCount || item.sales || 0),
        categoryName: item.categoryName || item.category || '',
        extraInfo: this.buildProductInfoLine(item),
        tag,
        visualClass: this.resolveProductVisualTone({
          id: normalizedId,
          title: this.compactProductTitle(item.name || item.title || ''),
          image: productImage,
          tag,
        }),
        reason,
        reasonTags: reasonTags.length ? reasonTags : [tag],
        sourceLabel: this.resolveSourceLabel(item, '智能推荐'),
        recommendReasonText: this.buildRecommendReasonText({
          reason,
          reasonTags: reasonTags.length ? reasonTags : [tag],
          sourceLabel: this.resolveSourceLabel(item, '智能推荐')
        }),
        reasonType: item.reasonType || '',
        sourceType: item.sourceType || item.recommendationSourceType || '',
        model版本: item.modelVersion || item.model版本 || 'cache',
        dataFreshness: item.dataFreshness || '缓存',
        recommendationToken: item.recommendationToken || '',
        recommendationScene: item.recommendationScene || 'guess_you_like',
        isSeckillDirectBuy: seckillApplyId > 0 && seckillStatus === 1,
        seckillApplyId: seckillApplyId || null,
        seckillStatus: Number.isFinite(seckillStatus) ? seckillStatus : null,
      }
    }).filter(item => item.id), {
      limit: 20,
      maxPerSeries: 1,
      maxPerImage: 1,
    })
  },

  async loadRealtimeHotOverview() {
    this.safeSetData({ realtimeHotLoading: true })
    try {
      const res = await request.get('/recommendations/realtime-hot/overview', { limit: 12 }, {
        showLoading: false,
        cacheTtl: CACHE_TTL.REALTIME,
        forceRefresh: !!this._isPullRefreshing,
        showErrorToast: false
      })
      const windows = (res && typeof res === 'object' && res.windows) ? res.windows : {}
      const normalized = {
        '1m': this.mapRealtimeHotProducts(windows['1m']),
        '1h': this.mapRealtimeHotProducts(windows['1h']),
        '1d': this.mapRealtimeHotProducts(windows['1d']),
      }
      const activeWindow = this.normalizeHotWindow(this.data.realtimeHotWindow)
      if (this.isPageInactive()) return
      this.safeSetData({
        realtimeHotWindows: normalized,
        realtimeHotProducts: normalized[activeWindow] || [],
        realtimeHotWindowLabel: this.getHotWindowLabel(activeWindow),
        realtimeHotLastUpdate: res && res.lastUpdate ? res.lastUpdate : '',
        realtimeHotLoading: false,
      })
    } catch (error) {
      console.error('加载实时热榜失败', error)
      if (this.isPageInactive()) return
      this.safeSetData({
        realtimeHotWindows: { '1m': [], '1h': [], '1d': [] },
        realtimeHotProducts: [],
        realtimeHotLastUpdate: '',
        realtimeHotLoading: false,
      })
    }
  },

  mapRealtimeHotProducts(rows) {
    if (!Array.isArray(rows)) return []
    const mapped = filterOutSeckillProducts(rows)
      .map(item => {
        const priceValue = item.price == null || item.price === '' ? null : Number(item.price)
        const safePrice = Number.isFinite(priceValue) ? priceValue : null
        const salesCount = Number(item.salesCount || 0)
        const safeSalesCount = Number.isFinite(salesCount) ? Math.max(0, salesCount) : 0
        const score = Number(item.score || 0)
        const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0

        return {
          rank: Number(item.rank || 0),
          id: Number(item.productId || 0),
          image: resolveProductImage(item),
          title: this.compactProductTitle(item.productName || ''),
          categoryName: item.categoryName || '',
          categoryLabel: item.categoryName || '热门商品',
          toneClass: this.resolveProductVisualTone({
            id: Number(item.productId || 0),
            title: this.compactProductTitle(item.productName || ''),
            image: resolveProductImage(item),
            tag: item.categoryName || '',
          }),
          price: safePrice,
          priceText: this.formatPriceText(safePrice),
          salesCount: safeSalesCount,
          salesText: this.formatSalesText(safeSalesCount),
          score: safeScore,
          scoreText: this.formatHotScoreText(safeScore),
          window: this.normalizeHotWindow(item.window),
        }
      })
      .filter(item => item.id > 0)

    return this.diversifyProductList(mapped, {
      limit: 12,
      maxPerSeries: 1,
      maxPerImage: 1,
      resetRank: true,
    })
  },

  switchRealtimeHotWindow(e) {
    const window = this.normalizeHotWindow(e.currentTarget?.dataset?.window)
    const windows = this.data.realtimeHotWindows || {}
    this.safeSetData({
      realtimeHotWindow: window,
      realtimeHotWindowLabel: this.getHotWindowLabel(window),
      realtimeHotProducts: windows[window] || [],
    })
  },

  normalizeHotWindow(window) {
    const normalized = `${window || ''}`.trim().toLowerCase()
    if (normalized === '1m' || normalized === '1h' || normalized === '1d') {
      return normalized
    }
    return '1h'
  },

  getHotWindowLabel(window) {
    const normalized = this.normalizeHotWindow(window)
    if (normalized === '1m') return '1分钟'
    if (normalized === '1d') return '1天'
    return '1小时'
  },

  formatPriceText(price) {
    if (!Number.isFinite(price) || price < 0) {
      return '价格待定'
    }
    return `¥${Number(price).toFixed(2)}`
  },

  formatSalesText(salesCount) {
    const count = Number(salesCount || 0)
    if (!Number.isFinite(count) || count <= 0) {
      return '0'
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}w`
    }
    return `${Math.round(count)}`
  },

  buildProductInfoLine(item) {
    const category = item.categoryName || item.category || ''
    const salesText = this.formatSalesText(item.salesCount || item.saleCount || item.sales || 0)
    const parts = []
    if (category) parts.push(category)
    if (salesText && salesText !== '0') parts.push(`已售 ${salesText}`)
    return parts.join(' · ') || '精选商品'
  },

  normalizeReasonTags(item) {
    const raw = Array.isArray(item && item.matchedReasonTags)
      ? item.matchedReasonTags
      : []
    return raw
      .map(tag => String(tag || '').replace('：', ':').trim())
      .filter(Boolean)
      .map(tag => {
        const index = tag.indexOf(':')
        return index >= 0 ? tag.slice(index + 1).trim() : tag
      })
      .filter(Boolean)
      .filter((tag, index, list) => list.indexOf(tag) === index)
      .slice(0, 3)
  },

  normalizeReasonCompareText(value) {
    return String(value || '')
      .replace(/\s+/g, '')
      .replace(/[·|｜、,，。:：]/g, '')
      .trim()
      .toLowerCase()
  },

  buildRecommendReasonText(product = {}, fallback = '河南馆今日推荐') {
    const sourceLabel = String(product.sourceLabel || '').trim()
    const reason = String(product.reason || product.recommendReason || '').trim()
    const reasonTags = Array.isArray(product.reasonTags) ? product.reasonTags : []
    const reasonTag = String(reasonTags.find(Boolean) || '').trim()

    const normalizedSource = this.normalizeReasonCompareText(sourceLabel)
    const normalizedReason = this.normalizeReasonCompareText(reason)
    const normalizedTag = this.normalizeReasonCompareText(reasonTag)

    if (reason && normalizedReason !== normalizedSource && normalizedReason !== normalizedTag) {
      return reason
    }

    if (reasonTag && sourceLabel && normalizedTag !== normalizedSource) {
      return `${sourceLabel} · ${reasonTag}`
    }

    return reasonTag || sourceLabel || reason || fallback
  },

  resolveSourceLabel(item = {}, fallback = '为你推荐') {
    const raw = `${item.sourceLabel || item.recommendationSourceLabel || item.sourceType || item.recommendationSourceType || ''}`.toLowerCase()
    if (raw.includes('real') || raw.includes('behavior')) return '最近逛过'
    if (raw.includes('segment') || raw.includes('cluster') || raw.includes('group')) return '偏好相近'
    if (raw.includes('hot') || raw.includes('rank')) return '大家都在买'
    if (raw.includes('cf') || raw.includes('collaborative')) return '买过同类商品的人也在看'
    if (raw.includes('content') || raw.includes('similar')) return '相似好物'
    return fallback
  },

  buildRecommendationEvidence(product = {}) {
    const tags = Array.isArray(product.reasonTags) && product.reasonTags.length
      ? product.reasonTags
      : ['与你浏览过的商品相似', '同类用户高转化', '近期热销上升']
    const sourceLabel = product.sourceLabel || this.resolveSourceLabel(product, '为你推荐')
    const scene = product.recommendationScene || 'guess_you_like'
    const token = product.recommendationToken || ''
    return {
      title: product.title || product.name || '推荐商品',
      sourceLabel,
      reason: product.reason || '结合你最近浏览、加购和大家都在买的商品，为你挑出更值得先看的好物。',
      tags: tags.slice(0, 3),
      dimensions: [
        { label: '价格带', value: product.price ? `¥${product.price}` : '同价位偏好' },
        { label: '品类', value: product.categoryName || product.extraInfo || '相似品类' },
        { label: '最近关注', value: scene === 'hot' ? '近期热度更高' : '浏览、点击、加购较多' },
        { label: '推荐方向', value: sourceLabel === '大家都在买' ? '全站热销商品' : '偏好相近的人更常购买' },
      ],
      tokenText: token ? `编号 ${`${token}`.slice(0, 10)}` : '本次推荐',
    }
  },

  formatHotScoreText(score) {
    const value = Number(score || 0)
    if (!Number.isFinite(value) || value <= 0) {
      return ''
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}w`
    }
    return value >= 100 ? value.toFixed(0) : value.toFixed(1)
  },

  shouldRotateRecommendProducts(refresh) {
    return !!refresh && (!!this._isPullRefreshing || !!this._manualRecommendRefreshing)
  },

  getActiveRecommendAlgorithm() {
    const activeKey = this.data.activeRecommendAlgorithm || 'hybrid'
    return RECOMMEND_ALGORITHM_TABS.find(item => item.key === activeKey) || RECOMMEND_ALGORITHM_TABS[0]
  },

  switchRecommendAlgorithm(e) {
    const key = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.key : ''
    if (!key || key === this.data.activeRecommendAlgorithm) {
      return
    }
    const tab = RECOMMEND_ALGORITHM_TABS.find(item => item.key === key)
    if (!tab) {
      return
    }
    this.safeSetData({
      activeRecommendAlgorithm: tab.key,
      recommendAlgorithmBadge: tab.badge,
      recommendTitle: tab.title,
      recommendExplain: tab.explain,
      recommendExplainTag: tab.tag,
      products: [],
      loading: true,
      loadingMore: false,
      productPage: 1,
      hasMore: true,
    })
    this._forceRecommendRefreshOnce = true
    this.loadRecommendProducts(true)
  },

  async onRecommendRefreshTap() {
    if (this._manualRecommendRefreshing) {
      return
    }
    this._manualRecommendRefreshing = true
    try {
      await this.loadRecommendProducts(true)
      if (!this.isPageInactive()) {
        wx.showToast({ title: '已换一批', icon: 'success' })
      }
    } finally {
      this._manualRecommendRefreshing = false
    }
  },

  buildRefreshReorderedProducts(products) {
    if (!Array.isArray(products) || products.length < 4) {
      return products
    }

    const fixedCount = 0
    const rotateEnd = Math.min(products.length, fixedCount + 8)
    const fixed = products.slice(0, fixedCount)
    const rotating = products.slice(fixedCount, rotateEnd)
    const tail = products.slice(rotateEnd)

    if (rotating.length < 2) {
      return products
    }

    this._recommendRefreshRound = (this._recommendRefreshRound || 0) + 1
    const offsetBase = Math.max(rotating.length - 1, 1)
    const offset = ((this._recommendRefreshRound - 1) % offsetBase) + 1

    return fixed
      .concat(rotating.slice(offset))
      .concat(rotating.slice(0, offset))
      .concat(tail)
  },

  diversifyProductList(products, options = {}) {
    if (!Array.isArray(products) || products.length <= 1) {
      return Array.isArray(products) ? products : []
    }

    const limit = Number(options.limit || 0) > 0 ? Number(options.limit) : products.length
    const maxPerSeries = Number(options.maxPerSeries || 1) > 0 ? Number(options.maxPerSeries) : 1
    const maxPerImage = Number(options.maxPerImage || 1) > 0 ? Number(options.maxPerImage) : 1
    const resetRank = !!options.resetRank

    const result = []
    const usedIds = new Set()
    const seriesCounter = {}
    const imageCounter = {}

    const pushItem = (item, force) => {
      if (!item || usedIds.has(item.id) || result.length >= limit) {
        return false
      }

      const seriesKey = this.createProductSeriesKey(item)
      const imageKey = this.createProductImageKey(item.image)
      const nextSeriesCount = seriesKey ? (seriesCounter[seriesKey] || 0) + 1 : 0
      const nextImageCount = imageKey ? (imageCounter[imageKey] || 0) + 1 : 0

      if (!force) {
        if (seriesKey && nextSeriesCount > maxPerSeries) {
          return false
        }
        if (imageKey && nextImageCount > maxPerImage) {
          return false
        }
      }

      usedIds.add(item.id)
      if (seriesKey) {
        seriesCounter[seriesKey] = nextSeriesCount
      }
      if (imageKey) {
        imageCounter[imageKey] = nextImageCount
      }
      result.push(item)
      return true
    }

    products.forEach(item => pushItem(item, false))
    products.forEach(item => pushItem(item, true))

    if (!resetRank) {
      return result
    }

    return result.map((item, index) => ({
      ...item,
      rank: index + 1,
    }))
  },

  createProductImageKey(image) {
    if (!image) {
      return ''
    }
    return String(image)
      .trim()
      .toLowerCase()
      .replace(/[?#].*$/, '')
  },

  createProductSeriesKey(product) {
    const rawTitle = product && (product.title || product.name) ? String(product.title || product.name) : ''
    if (!rawTitle) {
      return ''
    }

    const normalized = rawTitle
      .toLowerCase()
      .replace(/[【】（）()［］\[\]{}<>]/g, ' ')
      .replace(/\d+(\.\d+)?\s*(gb|g|kg|ml|l|tb|寸|英寸|件|片|包|盒|支|只|双|套)/gi, ' ')
      .replace(/\b(pro|max|plus|ultra)\b/gi, ' ')
      .replace(/(新款|升级版|典藏版|旗舰版|标准版|入门版|高配版|官方标配|套餐版|组合装|礼盒装)/g, ' ')
      .replace(/(白色|黑色|银色|金色|灰色|蓝色|粉色|绿色|紫色|红色|黄色|棕色|橙色)/g, ' ')
      .replace(/(日常实用款|进阶精选款|高配精选)/g, ' ')  // 新增：过滤变体后缀
      .replace(/[0-9]+/g, ' ')
      .replace(/[^\u4e00-\u9fa5a-z]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!normalized) {
      return rawTitle.toLowerCase().replace(/\s+/g, '')
    }

    const tokens = normalized.split(' ').filter(Boolean)
    // 只取前3个词作为系列标识，使分组更宽松
    return tokens.slice(0, Math.min(tokens.length, 3)).join('|')
  },

  compactProductTitle(title) {
    const rawTitle = String(title || '').trim()
    if (!rawTitle) {
      return ''
    }

    let compact = rawTitle
      .replace(/[，,]\s*(围绕|主打|适合|用于|支持|搭载|采用).*/g, '')
      .replace(/\s+(官方标配|套餐版|组合装|礼盒装|典藏版|旗舰版|标准版|入门版|高配版)$/gi, '')
      .replace(/\s+(白色|黑色|银色|金色|灰色|蓝色|粉色|绿色|紫色|红色|黄色|棕色|橙色)$/g, '')
      .replace(/\s+\d+\s*(件|片|包|盒|支|只|双|套)$/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const memoryStorageMatch = rawTitle.match(/(\d+\s*gb\s*\+\s*\d+\s*(gb|tb))/i)
    const storageMatch = rawTitle.match(/(\d+\s*(gb|tb))/i)

    if (compact.length < 4) {
      compact = rawTitle
    }

    if (compact.length <= 12) {
      if (memoryStorageMatch && !compact.includes(memoryStorageMatch[1])) {
        compact = `${compact} ${memoryStorageMatch[1].replace(/\s+/g, '')}`.trim()
      } else if (storageMatch && !compact.includes(storageMatch[1])) {
        compact = `${compact} ${storageMatch[1].replace(/\s+/g, '')}`.trim()
      }
    }

    return compact.replace(/\s+/g, ' ').trim()
  },

  resolveProductVisualTone(product) {
    const seed = `${product && product.id ? product.id : ''}|${product && product.title ? product.title : ''}|${product && product.tag ? product.tag : ''}|${product && product.image ? product.image : ''}`
    const hash = this.hashString(seed)
    const tones = [
      'product-card-tone-sand',
      'product-card-tone-mist',
      'product-card-tone-peach',
      'product-card-tone-sage',
    ]
    return tones[Math.abs(hash) % tones.length]
  },

  hashString(text) {
    const value = String(text || '')
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i)
      hash |= 0
    }
    return hash
  },

  async loadRecommendProducts(refresh) {
    const algorithmTab = this.getActiveRecommendAlgorithm()
    const recommendTitle = algorithmTab.title
    const recommendExplain = algorithmTab.explain

    if (refresh) {
      this.safeSetData({
        recommendTitle,
        recommendExplain,
        recommendExplainTag: algorithmTab.tag,
        recommendAlgorithmBadge: algorithmTab.badge,
        productPage: 1,
        hasMore: true,
        loadingMore: false,
        loading: true,
      })
    } else {
      this.safeSetData({
        recommendTitle,
        recommendExplain,
        recommendExplainTag: algorithmTab.tag,
        recommendAlgorithmBadge: algorithmTab.badge,
      })
    }

    try {
      const recommendationScene = algorithmTab.key === 'cf'
        ? 'collaborative_filtering'
        : (algorithmTab.key === 'hot' ? 'hot' : 'guess_you_like')
      const forceRefresh = this.shouldRotateRecommendProducts(refresh) || !!this._forceRecommendRefreshOnce
      this._forceRecommendRefreshOnce = false
      const res = await request.get('/recommendations/algorithm', {
        algorithm: algorithmTab.key,
        limit: 20,
        visitorId: app.isLoggedIn() ? '' : app.getVisitorId(),
      }, {
        showLoading: false,
        cacheTtl: CACHE_TTL.RECOMMEND,
        cacheByUser: app.isLoggedIn(),
        forceRefresh,
        showErrorToast: false
      })

      const mapped = filterOutSeckillProducts(Array.isArray(res) ? res : []).map(item => {
        const normalizedId = item.id || item.productId || item.goodsId || null
        const seckillApplyId = Number(item.seckillApplyId || item.applyId || 0)
        const seckillStatus = Number(item.seckillStatus)
        let tag = ''
        const reason = item.recommendReason || ''
        if (reason.includes('相似')) {
          tag = '相似好物'
        } else if (reason.includes('喜欢') || reason.includes('偏好') || reason.includes('行为')) {
          tag = '猜你喜欢'
        } else if (reason.includes('热销') || reason.includes('爆款')) {
          tag = '爆款热卖'
        } else if (reason.includes('好评')) {
          tag = '口碑推荐'
        } else if (reason.includes('新人')) {
          tag = '新客优选'
        } else if (Array.isArray(item.tags) && item.tags.length) {
          tag = item.tags[0]
        } else {
          tag = algorithmTab.tag
        }

        const productImage = resolveProductImage(item)
        const reasonTags = this.normalizeReasonTags(item)
        return {
          id: normalizedId,
          image: productImage,
          title: this.compactProductTitle(item.name || ''),
          price: item.price,
          salesText: this.formatSalesText(item.salesCount || item.saleCount || item.sales || 0),
          categoryName: item.categoryName || item.category || '',
          extraInfo: this.buildProductInfoLine(item),
          tag,
          visualClass: this.resolveProductVisualTone({
            id: normalizedId,
            title: this.compactProductTitle(item.name || ''),
            image: productImage,
            tag,
          }),
          reason: reason || algorithmTab.explain,
          reasonTags: reasonTags.length ? reasonTags : [algorithmTab.label],
          sourceLabel: this.resolveSourceLabel(item, algorithmTab.label),
          recommendReasonText: this.buildRecommendReasonText({
            reason: reason || algorithmTab.explain,
            reasonTags: reasonTags.length ? reasonTags : [algorithmTab.label],
            sourceLabel: this.resolveSourceLabel(item, algorithmTab.label)
          }, algorithmTab.explain),
          reasonType: item.reasonType || '',
          sourceType: item.sourceType || item.recommendationSourceType || '',
          model版本: item.modelVersion || item.model版本 || algorithmTab.badge,
          dataFreshness: item.dataFreshness || '',
          recommendationToken: item.recommendationToken || '',
          recommendationScene: item.recommendationScene || recommendationScene,
          isSeckillDirectBuy: seckillApplyId > 0 && seckillStatus === 1,
          seckillApplyId: seckillApplyId || null,
          seckillStatus: Number.isFinite(seckillStatus) ? seckillStatus : null,
        }
      })

      const validImageCount = mapped.filter(item => !!item.image).length
      const hasEnoughImages = mapped.length === 0 || (validImageCount / mapped.length) >= 0.6
      if (!hasEnoughImages) {
        await this.loadRecommendProductsFallback(refresh)
        return
      }

      const reorderedProducts = this.shouldRotateRecommendProducts(refresh)
        ? this.buildRefreshReorderedProducts(mapped)
        : mapped
      const displayProducts = this.diversifyProductList(reorderedProducts, {
        limit: 20,
        maxPerSeries: 1,
        maxPerImage: 1,
      })

      if (displayProducts.length > 0) {
        if (this.isPageInactive()) return
        this.safeSetData({
          products: displayProducts,
          productPage: 2,
          hasMore: false,
          loading: false,
          loadingMore: false,
        })
        recommendationTracker.trackExposures(displayProducts, recommendationScene)
        return
      }

      await this.loadRecommendProductsFallback(refresh)
    } catch (error) {
      console.error('加载推荐商品失败', error)
      await this.loadRecommendProductsFallback(refresh)
    }
  },

  async loadLatestProducts() {
    this.safeSetData({ latestLoading: true })

    try {
      const res = await request.get('/products/list', {
        page: 1,
        size: 12,  // 增加请求数量以获得更多选择
        sortField: 'id',
        sortOrder: 'desc',
      }, {
        showLoading: false,
        cacheTtl: CACHE_TTL.LIST,
        forceRefresh: !!this._isPullRefreshing,
        showErrorToast: false
      })

      const records = filterOutSeckillProducts((res && res.records) || [])
      const latestProducts = this.diversifyProductList(records.map(item => {
        const normalizedId = item.id || item.productId || item.goodsId || null
        const seckillApplyId = Number(item.seckillApplyId || item.applyId || 0)
        const seckillStatus = Number(item.seckillStatus)
        const productImage = resolveProductImage(item)
        return {
          id: normalizedId,
          image: productImage,
          title: this.compactProductTitle(item.name || ''),
          price: item.price,
          salesText: this.formatSalesText(item.salesCount || item.saleCount || item.sales || 0),
          categoryName: item.categoryName || item.category || '',
          extraInfo: this.buildProductInfoLine(item),
          tag: '最新上架',
          visualClass: this.resolveProductVisualTone({
            id: normalizedId,
            title: this.compactProductTitle(item.name || ''),
            image: productImage,
            tag: '最新上架',
          }),
          reason: '新品优先',
          reasonTags: ['新品上架'],
          sourceLabel: '最新上架',
          recommendReasonText: this.buildRecommendReasonText({
            reason: '新品优先',
            reasonTags: ['新品上架'],
            sourceLabel: '最新上架'
          }, '最新上架'),
          recommendationToken: '',
          isSeckillDirectBuy: seckillApplyId > 0 && seckillStatus === 1,
          seckillApplyId: seckillApplyId || null,
          seckillStatus: Number.isFinite(seckillStatus) ? seckillStatus : null,
        }
      }), {
        limit: 6,
        maxPerSeries: 2,  // 允许同系列商品最多2个
        maxPerImage: 2,   // 允许相同图片最多2个
      })

      if (this.isPageInactive()) return
      this.safeSetData({
        latestProducts,
        latestLoading: false,
      })
    } catch (error) {
      console.error('加载最新商品失败', error)
      if (this.isPageInactive()) return
      this.safeSetData({
        latestProducts: [],
        latestLoading: false,
      })
    }
  },

  async loadSeckillProducts() {
    this.safeSetData({ seckillLoading: true })
    try {
      let historyMode = false
      let res = await request.get('/seckill/products', { limit: 8 }, {
        showLoading: false,
        cacheTtl: 30 * 1000,
        forceRefresh: !!this._isPullRefreshing,
        showErrorToast: false
      })
      let records = Array.isArray(res)
        ? res
        : ((res && (res.records || res.list || res.items)) || [])

      // 首页优先展示进行中/即将开始的场次；如果当前没有，则回退到会场可展示的往期封面，避免整块空白。
      if (!records.length) {
        historyMode = true
        res = await request.get('/seckill/products', { limit: 8, includeHistory: true }, {
          showLoading: false,
          cacheTtl: 60 * 1000,
          forceRefresh: !!this._isPullRefreshing,
          showErrorToast: false
        })
        records = Array.isArray(res)
          ? res
          : ((res && (res.records || res.list || res.items)) || [])
      }

      const seckillProducts = records.map((item) => {
        const originalPrice = Number(item.originalPrice != null ? item.originalPrice : (item.productPrice != null ? item.productPrice : item.price || 0))
        const seckillPrice = Number(item.seckillPrice != null ? item.seckillPrice : item.price || 0)
        const endTime = item.seckillEndTime || item.endTime || ''
        const startTime = item.seckillStartTime || item.startTime || ''
        const statusInfo = this.getSeckillStatusLabel(item.seckillStatus, startTime, endTime)
        const stock = Number(item.remainingStock != null ? item.remainingStock : (item.seckillStock != null ? item.seckillStock : item.stock || 0))
        const soldCount = Number(item.seckillSoldCount != null ? item.seckillSoldCount : item.soldCount || 0)

        return {
          id: Number(item.productId || item.id || 0),
          image: resolveProductImage(item),
          title: this.compactProductTitle(item.name || item.productName || ''),
          seckillPrice: Number.isFinite(seckillPrice) ? seckillPrice : 0,
          originalPrice: Number.isFinite(originalPrice) ? originalPrice : 0,
          seckillActivityId: item.seckillActivityId || item.activityId || null,
          seckillApplyId: item.seckillApplyId || item.applyId || null,
          seckillStartTime: startTime,
          seckillEndTime: endTime,
          seckillStatus: statusInfo.status,
          seckillStatusLabel: statusInfo.label,
          countdownText: statusInfo.countdownText,
          stock,
          soldCount,
          soldText: soldCount > 0 ? `已抢 ${soldCount}` : (stock > 0 ? `余量 ${stock}` : '库存告急'),
        }
      }).filter((item) => item.id > 0)

      if (this.isPageInactive()) return
      this.safeSetData({
        seckillProducts,
        seckillHistoryMode: historyMode && seckillProducts.length > 0,
        seckillLoading: false,
      })
      this.startSeckillTicker()
    } catch (error) {
      console.error('加载秒杀商品失败', error)
      if (this.isPageInactive()) return
      this.safeSetData({
        seckillProducts: [],
        seckillHistoryMode: false,
        seckillLoading: false,
      })
      this.clearSeckillTicker()
    }
  },

  getSeckillStatusLabel(rawStatus, startTime, endTime) {
    const now = Date.now()
    const startAt = startTime ? new Date(startTime.replace(/-/g, '/')).getTime() : 0
    const endAt = endTime ? new Date(endTime.replace(/-/g, '/')).getTime() : 0
    const normalizedStatus = Number(rawStatus)

    if (normalizedStatus === 1 || (startAt && endAt && now >= startAt && now < endAt)) {
      return {
        status: 1,
        label: '抢购中',
        countdownText: this.formatCountdownText(endAt, '距结束'),
      }
    }
    if (normalizedStatus === 0 || (startAt && now < startAt)) {
      const beforeStart = startAt ? (startAt - now) : 0
      const shouldShowCountdown = !!startAt && beforeStart > 0 && beforeStart <= SECKILL_COUNTDOWN_WINDOW_MS
      return {
        status: 0,
        label: '即将开始',
        countdownText: shouldShowCountdown
          ? this.formatCountdownText(startAt, '距开始')
          : (startAt ? '12小时后开启倒计时' : '即将开始'),
      }
    }
    return {
      status: 2,
      label: '已结束',
      countdownText: '活动已结束',
    }
  },

  formatCountdownText(targetAt, prefix) {
    if (!targetAt || Number.isNaN(targetAt)) {
      return ''
    }
    const gap = Math.max(0, targetAt - Date.now())
    const totalSeconds = Math.floor(gap / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (days > 0) {
      return `${prefix} ${days}天${hours}时`
    }
    return `${prefix} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  },

  refreshSeckillCountdowns() {
    if (this.isPageInactive()) {
      return false
    }
    const source = Array.isArray(this.data.seckillProducts) ? this.data.seckillProducts : []
    if (!source.length) {
      return false
    }
    const nextProducts = source.map(item => {
      const statusInfo = this.getSeckillStatusLabel(item.seckillStatus, item.seckillStartTime, item.seckillEndTime)
      return {
        ...item,
        seckillStatus: statusInfo.status,
        seckillStatusLabel: statusInfo.label,
        countdownText: statusInfo.countdownText,
      }
    })
    this.safeSetData({ seckillProducts: nextProducts })
    return nextProducts.some(item => item.seckillStatus === 0 || item.seckillStatus === 1)
  },

  startSeckillTicker() {
    this.clearSeckillTicker()
    const hasNeedRefresh = this.refreshSeckillCountdowns()
    if (!hasNeedRefresh) {
      return
    }
    const tick = () => {
      if (this.isPageInactive()) {
        this.clearSeckillTicker()
        return
      }
      const keepRunning = this.refreshSeckillCountdowns()
      if (!keepRunning) {
        this.clearSeckillTicker()
        return
      }
      this._seckillTicker = setTimeout(tick, 1000)
    }
    this._seckillTicker = setTimeout(tick, 1000)
  },

  clearSeckillTicker() {
    if (this._seckillTicker) {
      clearTimeout(this._seckillTicker)
      this._seckillTicker = null
    }
  },

  async loadRecommendProductsFallback(refresh) {
    const page = refresh ? 1 : this.data.productPage
    const isFirstPage = page === 1
    const isPersonalized = app.isLoggedIn()
    const recommendExplain = isPersonalized
      ? '优先展示近期更受欢迎的商品'
      : '优先展示销量更高的商品'

    this.safeSetData({
      recommendExplain,
      recommendExplainTag: '推荐依据',
    })

    if (!isFirstPage) {
      this.safeSetData({ loadingMore: true })
    }

    try {
      const res = await request.get('/products/list', {
        page,
        size: 20,
        sortField: 'salesCount',
        sortOrder: 'desc',
      }, {
        showLoading: false,
        cacheTtl: CACHE_TTL.LIST,
        forceRefresh: this.shouldRotateRecommendProducts(refresh),
        showErrorToast: false
      })

      const records = filterOutSeckillProducts((res && res.records) || [])
      const mapped = records.map(item => {
        const normalizedId = item.id || item.productId || item.goodsId || null
        const seckillApplyId = Number(item.seckillApplyId || item.applyId || 0)
        const seckillStatus = Number(item.seckillStatus)
        const tag = Array.isArray(item.tags) && item.tags.length ? item.tags[0] : '爆款推荐'
        const productImage = resolveProductImage(item)
        return {
          id: normalizedId,
          image: productImage,
          title: this.compactProductTitle(item.name || ''),
          price: item.price,
          salesText: this.formatSalesText(item.salesCount || item.saleCount || item.sales || 0),
          categoryName: item.categoryName || item.category || '',
          extraInfo: this.buildProductInfoLine(item),
          tag,
          visualClass: this.resolveProductVisualTone({
            id: normalizedId,
            title: this.compactProductTitle(item.name || ''),
            image: productImage,
            tag,
          }),
          reason: '热销补位',
          reasonTags: ['近期热销上升'],
          sourceLabel: '大家都在买',
          recommendReasonText: this.buildRecommendReasonText({
            reason: '热销补位',
            reasonTags: ['近期热销上升'],
            sourceLabel: '大家都在买'
          }, '近期热销上升'),
          reasonType: item.reasonType || 'GENERAL',
          sourceType: item.sourceType || 'fallback',
          model版本: item.model版本 || 'fallback-hot-v1',
          dataFreshness: item.dataFreshness || '近实时',
          recommendationToken: '',
          isSeckillDirectBuy: seckillApplyId > 0 && seckillStatus === 1,
          seckillApplyId: seckillApplyId || null,
          seckillStatus: Number.isFinite(seckillStatus) ? seckillStatus : null,
        }
      })

      let allProducts = isFirstPage ? mapped : [...this.data.products, ...mapped]
      if (isFirstPage && this.shouldRotateRecommendProducts(refresh)) {
        allProducts = this.buildRefreshReorderedProducts(allProducts)
      }
      allProducts = this.diversifyProductList(allProducts, {
        limit: allProducts.length,
        maxPerSeries: 1,
        maxPerImage: 1,
      })

      if (this.isPageInactive()) return
      this.safeSetData({
        products: allProducts,
        productPage: page + 1,
        hasMore: records.length >= 20,
        loading: false,
        loadingMore: false,
      })
    } catch (error) {
      console.error('加载商品失败', error)
      if (this.isPageInactive()) return
      this.safeSetData({ loading: false, loadingMore: false })
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.loading) {
      this.loadRecommendProducts(false)
    }
  },

  onPageScroll(e) {
    const scrollTop = e.scrollTop
    const threshold = 100

    if (scrollTop > threshold && !this.data.isScrolled) {
      this.setData({
        isScrolled: true,
        navColor: '#111111',
      })
    } else if (scrollTop <= threshold && this.data.isScrolled) {
      this.setData({
        isScrolled: false,
        navColor: '#ffffff',
      })
    }
  },

  async onPullDownRefresh() {
    this._isPullRefreshing = true
    try {
      await this.loadHomeData()
    } finally {
      this._isPullRefreshing = false
      wx.stopPullDownRefresh()
    }
  },

  onShareAppMessage(res) {
    return buildProductShareMessage(res)
  },

  onSwiperChange(e) {
    this.setData({
      currentBanner: e.detail.current,
    })
  },

  goToExplore() {
    app.navigateToPage('/pages/explore/index')
  },

  goToSearchEntry() {
    app.navigateToPage('/pages/explore/index')
  },

  goToSearchKeyword(e) {
    const keyword = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.keyword) || ''
    if (!keyword) {
      this.goToSearchEntry()
      return
    }
    app.navigateToPage(`/pages/search-result/index?keyword=${encodeURIComponent(keyword)}`)
  },

  goToDetail(e) {
    const id = e.detail?.id || e.currentTarget?.dataset?.id
    const recToken = e.detail?.recToken || e.currentTarget?.dataset?.recToken
    const product = (this.data.products || []).find(item => Number(item.id) === Number(id))
    const recScene = product && product.recommendationScene ? product.recommendationScene : 'guess_you_like'
    if (!id) {
      wx.showToast({ title: '商品信息异常', icon: 'none' })
      return
    }
    if (recToken) {
      recommendationTracker.trackClick(id, recToken, recScene)
    }
    app.navigateToPage(
      recToken
        ? `/pages/product-detail/index?id=${id}&recToken=${encodeURIComponent(recToken)}&recScene=${encodeURIComponent(recScene)}`
        : `/pages/product-detail/index?id=${id}`
    )
  },

  goToBanner(e) {
    const index = e.currentTarget.dataset.index
    const banner = this.data.banners[index]
    if (!banner) {
      wx.showToast({ title: '专题暂不可用', icon: 'none' })
      return
    }

    const { linkType, linkValue } = banner
    if (!linkType || !linkValue || linkType === 'none') {
      wx.showToast({ title: '专题暂不可用', icon: 'none' })
      return
    }

    if (linkType === 'product') {
      const productId = Number(linkValue)
      if (!Number.isFinite(productId) || productId <= 0) {
        wx.showToast({ title: '商品信息异常', icon: 'none' })
        return
      }
      app.navigateToPage(`/pages/product-detail/index?id=${productId}`)
    } else if (linkType === 'category') {
      const title = encodeURIComponent(banner.title || '')
      app.navigateToPage(`/pages/search-result/index?categoryId=${linkValue}&title=${title}`)
    } else if (linkType === 'url') {
      const safeUrl = buildSafeWebviewUrl(linkValue)
      if (!safeUrl) {
        wx.showToast({ title: '活动链接不可用', icon: 'none' })
        return
      }
      app.navigateToPage(`/pages/webview/index?url=${encodeURIComponent(safeUrl)}`)
    }
  },

  goToInspiration(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.inspirations[index]
    if (!item || (!item.keyword && !item.id)) {
      wx.showToast({ title: '入口不可用', icon: 'none' })
      return
    }
    const title = encodeURIComponent(item.title || '')
    if (item.keyword) {
      app.navigateToPage(`/pages/search-result/index?keyword=${encodeURIComponent(item.keyword)}&title=${title}`)
      return
    }
    app.navigateToPage(`/pages/search-result/index?categoryId=${item.id}&title=${title}`)
  },

  goToSeckillProduct(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({ title: '秒杀商品异常', icon: 'none' })
      return
    }
    app.navigateToPage(`/pages/product-detail/index?id=${id}`)
  },

  handleSeckillImageError(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) {
      return
    }
    this.safeSetData({
      [`seckillProducts[${index}].image`]: ''
    })
  },

  goToSeckillHall() {
    app.navigateToPage('/pages/seckill/index')
  },

  goToRealtimeHotProduct(e) {
    const topProduct = Array.isArray(this.data.realtimeHotProducts) ? this.data.realtimeHotProducts[0] : null
    const rawId = e.currentTarget?.dataset?.id || (topProduct && (topProduct.id || topProduct.productId))
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      wx.showToast({ title: '商品信息异常', icon: 'none' })
      return
    }
    app.navigateToPage(`/pages/product-detail/index?id=${id}`)
  },

  goToCouponsQuick() {
    if (!app.requireLogin('/pages/home/index')) {
      return
    }
    app.navigateToPage('/package-user/coupons/index')
  },

  goToMessages() {
    if (!app.requireLogin('/pages/home/index')) {
      return
    }
    app.navigateToPage('/package-user/messages/index')
  },

  resolveHomeFeedProduct(section, index, fallbackId) {
    const list = section === 'latestProducts'
      ? (this.data.latestProducts || [])
      : (this.data.products || [])
    const item = Number.isInteger(index) ? list[index] : null
    if (item && Number(item.id || item.productId) > 0) {
      return item
    }
    const targetId = Number(fallbackId)
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return null
    }
    return list.find(product => Number(product.id || product.productId) === targetId) || null
  },

  onFeedAddTap(e) {
    const dataset = e.currentTarget?.dataset || {}
    const product = this.resolveHomeFeedProduct(
      dataset.section,
      Number(dataset.index),
      dataset.id
    )
    const id = Number(dataset.id || (product && (product.id || product.productId)) || 0)
    if (!Number.isFinite(id) || id <= 0) {
      wx.showToast({ title: '商品异常', icon: 'none' })
      return
    }
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {}
    this.addToCart({
      detail: {
        id,
        recToken: dataset.recToken || (product && product.recommendationToken) || '',
        clientX: touch.clientX || touch.x || 200,
        clientY: touch.clientY || touch.y || 500
      },
      currentTarget: {
        dataset: {
          id,
          recToken: dataset.recToken || (product && product.recommendationToken) || ''
        }
      }
    })
  },

  async checkCouponPopup() {
    if (!app.isLoggedIn()) return false

    const today = this.getTodayKey()
    const shownState = wx.getStorageSync('couponPopupState')
    if (shownState && shownState.date === today) return false

    try {
      const res = await request.get('/coupons/has-unclaimed', {}, { showLoading: false })
      if (res && res.hasUnclaimed && res.count > 0) {
        this.safeSetData({
          showCouponPopup: true,
          unclaimedCount: res.count,
        })
        return true
      }
    } catch (error) {
      console.error('检查优惠券失败', error)
    }
    return false
  },

  closeCouponPopup() {
    this.setData({ showCouponPopup: false })
    this.markPopupShown('couponPopupState', { count: this.data.unclaimedCount || 0 })
  },

  goToCouponsFromPopup() {
    this.setData({ showCouponPopup: false })
    this.markPopupShown('couponPopupState', { count: this.data.unclaimedCount || 0 })
    app.navigateToPage('/package-user/coupons/index')
  },

  getTodayKey() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  markPopupShown(storageKey, extra = {}) {
    if (!storageKey) return
    wx.setStorageSync(storageKey, {
      date: this.getTodayKey(),
      ...extra,
    })
  },

  onFabTap() {
    this.openAiAssistantFromRecommend()
  },

  openAiAssistantFromRecommend(e) {
    if (!app.requireLogin('/pages/home/index')) {
      return
    }

    const prompt = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.prompt || ''
      : ''

    app.navigateToPage(
      prompt
        ? `/pages/ai-assistant/index?prompt=${encodeURIComponent(prompt)}`
        : '/pages/ai-assistant/index'
    )
  },

  async addToCart(e) {
    const rawId = e.detail?.id || e.detail?.productId || e.currentTarget?.dataset?.id
    const id = Number(rawId)
    const recToken = e.detail?.recToken || e.currentTarget?.dataset?.recToken
    const productPool = [...(this.data.products || []), ...(this.data.latestProducts || [])]
    const recProduct = productPool.find(item => Number(item.id || item.productId) === id)
    const recScene = recProduct && recProduct.recommendationScene ? recProduct.recommendationScene : 'guess_you_like'
    if (!Number.isFinite(id) || id <= 0) {
      wx.showToast({ title: '商品异常', icon: 'none' })
      return
    }
    if (!app.requireLogin('/pages/home/index')) {
      return
    }

    try {
      await request.post(
        '/cart',
        {
          productId: Number(id),
          quantity: 1,
        },
        { showLoading: false },
      )
      if (typeof app.refreshCartCount === 'function') {
        app.refreshCartCount({ forceRefresh: true }).catch(() => {})
      }

      const clientX = e.detail?.clientX || 200
      const clientY = e.detail?.clientY || 500
      const product = productPool.find(p => Number(p.id || p.productId) === id)
      const cartParabola = this.selectComponent('#cartParabola')
      if (cartParabola && product) {
        cartParabola.animate({
          startX: clientX,
          startY: clientY,
          image: resolveProductImage(product),
        })
      }
      wx.showToast({ title: recToken ? '偏好已更新' : '已加入购物车', icon: 'success' })

      if (recToken) {
        recommendationTracker.trackAddCart(id, recToken, recScene)
      } else {
        request.post('/recommendations/behavior', {
          productId: id,
          behaviorType: 'cart',
          recommendationToken: '',
        }, { showLoading: false }).catch(() => {})
      }
    } catch (error) {
      console.error('加入购物车失败', error)
      const message = (error && (error.message || error.errMsg || error.msg)) || ''
      if (message.includes('秒杀商品请直接使用秒杀购买')) {
        wx.showToast({ title: '请走秒杀', icon: 'none' })
        setTimeout(() => {
          app.navigateToPage(`/pages/product-detail/index?id=${id}`)
        }, 120)
      } else if (message) {
        wx.showToast({ title: message.slice(0, 30), icon: 'none' })
      } else {
        wx.showToast({ title: '加入失败', icon: 'none' })
      }
    }
  },
})

