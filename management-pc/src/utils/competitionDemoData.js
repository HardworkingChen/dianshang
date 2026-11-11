export const competitionMode = import.meta.env.VITE_COMPETITION_MODE !== 'false'

export const demoToken = 'competition-demo-token'

export const demoAdminUser = {
  id: 900001,
  username: 'ops-sample',
  nickname: '运营体验账号',
  avatar: '',
  role: 'admin',
  status: 1,
}

const now = new Date()
const dayMs = 24 * 60 * 60 * 1000
const pad = value => String(value).padStart(2, '0')
const dateText = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const dateTimeText = date => `${dateText(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
const daysAgo = days => new Date(now.getTime() - days * dayMs)
const daysAfter = days => new Date(now.getTime() + days * dayMs)

const cloneData = data => {
  if (typeof data === 'function') {
    return cloneData(data())
  }
  if (data == null) {
    return data
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data)
    } catch {
      return data
    }
  }
  try {
    return JSON.parse(JSON.stringify(data))
  } catch {
    return data
  }
}

const hasContent = value => {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value !== 'object') return true
  if (Array.isArray(value.records)) return value.records.length > 0 || Number(value.total || 0) > 0
  if (value.available === false) return false
  return Object.keys(value).length > 0
}

export const isCompetitionDemoToken = () => {
  if (typeof window === 'undefined') return false
  return String(window.localStorage.getItem('token') || '').startsWith(demoToken)
}

export const competitionRequestConfig = (config = {}) => ({
  ...config,
  skipErrorNotify: competitionMode ? true : config.skipErrorNotify,
})

export const withCompetitionFallback = (task, fallback) => {
  const executeTask = () => (typeof task === 'function' ? task() : task)
  const resolveFallback = () => cloneData(typeof fallback === 'function' ? fallback() : fallback)

  if (!competitionMode) {
    return executeTask()
  }
  if (isCompetitionDemoToken()) {
    return Promise.resolve(resolveFallback())
  }
  return Promise.resolve()
    .then(executeTask)
    .then(result => (hasContent(result) ? result : resolveFallback()))
    .catch(() => resolveFallback())
}

export const demoAnalysisSummary = {
  totalUsers: 12860,
  activeUsers: 8430,
  totalActiveUsers: 8430,
  paidUserCount: 2168,
  orderCount: 3842,
  totalPaidOrders: 3219,
  totalBehaviorRecords: 428630,
  refundCount: 96,
  gmv: 935680.5,
  overallConversionRate: 6.12,
  recommendationConversionRate: 6.12,
  bestSegmentCode: 'S1',
}

const demoExperimentMeta = {
  control: {
    label: '热门对照组',
    weights: { collaborative: 0, content: 0, popularity: 1 },
  },
  hybrid: {
    label: '标准混合组',
    weights: { collaborative: 0.4, content: 0.3, popularity: 0.3 },
  },
  cf_heavy: {
    label: 'CF 强化组',
    weights: { collaborative: 0.55, content: 0.2, popularity: 0.25 },
  },
}

const demoRecommendProducts = [
  { id: 401, name: '降噪蓝牙耳机 Pro', price: 399, salesCount: 2380, mainImage: '', categoryName: '数码', tags: ['耳机', '蓝牙', '通勤'] },
  { id: 402, name: '护眼学习台灯 Max', price: 259, salesCount: 1842, mainImage: '', categoryName: '学习', tags: ['台灯', '宿舍', '学习'] },
  { id: 403, name: '便携充电宝 20000mAh', price: 169, salesCount: 3120, mainImage: '', categoryName: '数码', tags: ['续航', '外出', '刚需'] },
  { id: 404, name: '机械键盘 87 键', price: 329, salesCount: 968, mainImage: '', categoryName: '办公', tags: ['键盘', '效率', '桌搭'] },
  { id: 405, name: '智能手环 S', price: 219, salesCount: 2764, mainImage: '', categoryName: '穿戴', tags: ['手环', '运动', '健康'] },
  { id: 406, name: '运动水杯 1L', price: 59, salesCount: 4206, mainImage: '', categoryName: '运动', tags: ['补水', '跑步', '户外'] },
  { id: 407, name: '胶囊咖啡机 Mini', price: 599, salesCount: 1360, mainImage: '', categoryName: '家居', tags: ['咖啡', '居家', '品质'] },
  { id: 408, name: '折叠收纳箱 60L', price: 89, salesCount: 2950, mainImage: '', categoryName: '家居', tags: ['收纳', '家庭', '整理'] },
  { id: 409, name: '雾感口红礼盒', price: 239, salesCount: 1886, mainImage: '', categoryName: '美妆', tags: ['口红', '礼盒', '高颜值'] },
  { id: 410, name: '氨基酸洁面套装', price: 129, salesCount: 2540, mainImage: '', categoryName: '个护', tags: ['洁面', '敏感肌', '日常'] },
  { id: 411, name: '儿童绘本启蒙礼盒', price: 199, salesCount: 1124, mainImage: '', categoryName: '图书', tags: ['绘本', '亲子', '启蒙'] },
  { id: 412, name: '麦饭石不粘锅 32cm', price: 179, salesCount: 2075, mainImage: '', categoryName: '厨房', tags: ['锅具', '厨房', '家用'] },
  { id: 413, name: '瑜伽垫进阶款', price: 149, salesCount: 1640, mainImage: '', categoryName: '运动', tags: ['瑜伽', '拉伸', '居家健身'] },
  { id: 414, name: '轻奢床品四件套', price: 329, salesCount: 980, mainImage: '', categoryName: '家居', tags: ['床品', '卧室', '送礼'] },
  { id: 415, name: '便携投影仪 Air', price: 899, salesCount: 760, mainImage: '', categoryName: '数码', tags: ['投影', '宿舍', '观影'] },
  { id: 416, name: '香氛护手礼盒', price: 159, salesCount: 1736, mainImage: '', categoryName: '美妆', tags: ['香氛', '护手', '礼赠'] },
  { id: 417, name: '通勤托特包', price: 269, salesCount: 842, mainImage: '', categoryName: '配饰', tags: ['通勤', '穿搭', '轻奢'] },
]

const demoProductMap = new Map(demoRecommendProducts.map(item => [item.id, item]))

const pickDemoProducts = productIds => productIds.map(id => demoProductMap.get(id)).filter(Boolean)

const demoPersonaTemplates = {
  digital: {
    label: '数码通勤型',
    experimentGroup: 'hybrid',
    interactedProducts: 27,
    userTags: ['数码偏好', '高意向', '耳机', '通勤场景', '价格敏感'],
    categoryWeights: { 数码: 0.92, 配件: 0.74, 办公: 0.43, 家居: 0.18 },
    behaviorStats: [
      { behaviorType: 'view', count: 18 },
      { behaviorType: 'search', count: 7 },
      { behaviorType: 'cart', count: 5 },
      { behaviorType: 'favorite', count: 4 },
      { behaviorType: 'purchase', count: 2 },
    ],
    searchCategoryPreferences: { 数码: 0.93, 配件: 0.71, 办公: 0.46 },
    portraitLayers: [
      { title: '短期意图', description: '最近 7 天连续搜索蓝牙耳机、降噪与投影类商品。' },
      { title: '长期偏好', description: '近 90 天数码与配件浏览、成交权重最高。' },
      { title: '分群标签', description: '属于高意向待转化用户，适合用限时券快速承接。' },
    ],
    segment: {
      segmentCode: 'S2',
      segmentName: '高意向待转化用户',
      confidenceScore: 0.86,
      personaSummary: '搜索和加购都高，对数码品类反应最快。',
      operationSuggestion: '限时券 + 加购提醒',
      featureHighlights: ['search 高', 'cart 高', '数码偏好'],
      topCategories: ['数码', '配件'],
      topTags: ['耳机', '蓝牙', '通勤'],
    },
    recommendation: {
      productIds: [401, 403, 415, 404, 405],
      explanations: [
        { primaryReason: 'COLLABORATIVE', reasonText: '通勤数码用户对耳机点击和成交都更高。' },
        { primaryReason: 'HOT_SELLING', reasonText: '外出续航需求强，便携刚需商品承接稳定。' },
        { primaryReason: 'CONTENT_TAG', reasonText: '命中“宿舍观影 / 轻便数码”内容标签。' },
        { primaryReason: 'CONTENT_CATEGORY', reasonText: '办公桌搭与配件类目权重持续靠前。' },
        { primaryReason: 'COLD_START', reasonText: '穿戴类做探索补位，避免全是同类耳机。' },
      ],
      compareOrders: {
        online: [401, 403, 415, 404, 405],
        hybrid: [401, 403, 415, 404, 405],
        cf: [401, 404, 403, 405],
        cb: [415, 403, 401, 404],
        hot: [403, 401, 405, 415],
      },
      quality: {
        topCategoryHitRate: '82.50',
        topPreferenceCategories: ['数码', '配件'],
        status: 'PASS',
        tagComparisons: [
          { rank: 1, productId: 401, productName: '降噪蓝牙耳机 Pro', matchedTags: ['耳机', '蓝牙'], basis: 'CF 与内容标签同时命中。' },
          { rank: 2, productId: 415, productName: '便携投影仪 Air', matchedTags: ['宿舍', '观影'], basis: '内容相似度与场景词同步命中。' },
        ],
      },
      beforeAfterQuality: {
        baselineName: '热榜对照',
        optimizedName: '数码混排',
        baseline: { topCategoryHitRate: '66.20', tagMatchRate: '48.30' },
        optimized: { topCategoryHitRate: '82.50', tagMatchRate: '71.10' },
        hitRateLift: '16.30',
        tagMatchLift: '22.80',
        negativeFeedback: {
          productHitReduction: 2,
          categoryHitReduction: 1,
          conclusion: '降低重复耳机曝光后，数码兴趣仍能命中，同时结果更丰富。',
        },
      },
    },
  },
  study: {
    label: '学习效率型',
    experimentGroup: 'cf_heavy',
    interactedProducts: 24,
    userTags: ['学习装备', '夜间活跃', '护眼', '宿舍场景', '效率型'],
    categoryWeights: { 学习: 0.91, 图书: 0.74, 家居: 0.52, 数码: 0.38 },
    behaviorStats: [
      { behaviorType: 'view', count: 15 },
      { behaviorType: 'search', count: 9 },
      { behaviorType: 'cart', count: 4 },
      { behaviorType: 'favorite', count: 6 },
      { behaviorType: 'purchase', count: 1 },
    ],
    searchCategoryPreferences: { 学习: 0.96, 图书: 0.72, 家居: 0.48 },
    portraitLayers: [
      { title: '短期意图', description: '最近集中搜索台灯、键盘和宿舍收纳，场景很明确。' },
      { title: '长期偏好', description: '学习和图书类商品浏览停留更久，收藏率也更高。' },
      { title: '分群标签', description: '更适合学习场景套装推荐，而不是只推单品热卖。' },
    ],
    segment: {
      segmentCode: 'S2',
      segmentName: '高意向待转化用户',
      confidenceScore: 0.82,
      personaSummary: '夜间行为活跃，愿意先收藏再下单，场景词很集中。',
      operationSuggestion: '场景套装 + 满减券',
      featureHighlights: ['夜间活跃', 'favorite 高', '学习场景'],
      topCategories: ['学习', '图书'],
      topTags: ['台灯', '宿舍', '效率'],
    },
    recommendation: {
      productIds: [402, 411, 404, 415, 408],
      explanations: [
        { primaryReason: 'CONTENT_TAG', reasonText: '护眼、宿舍、学习标签强命中。' },
        { primaryReason: 'CONTENT_CATEGORY', reasonText: '图书与启蒙类商品和当前兴趣词相关。' },
        { primaryReason: 'COLLABORATIVE', reasonText: '同类学习用户对键盘和桌面效率商品偏好更高。' },
        { primaryReason: 'HOT_SELLING', reasonText: '投影在宿舍场景中转化稳定，适合做补位。' },
        { primaryReason: 'COLD_START', reasonText: '收纳类做场景拓展，避免只围绕灯具单点推荐。' },
      ],
      compareOrders: {
        online: [402, 411, 404, 415, 408],
        hybrid: [402, 404, 411, 415, 408],
        cf: [404, 402, 415, 411],
        cb: [402, 411, 408, 415],
        hot: [402, 404, 408, 411],
      },
      quality: {
        topCategoryHitRate: '79.30',
        topPreferenceCategories: ['学习', '图书'],
        status: 'PASS',
        tagComparisons: [
          { rank: 1, productId: 402, productName: '护眼学习台灯 Max', matchedTags: ['台灯', '学习'], basis: '内容标签与场景词共同命中。' },
          { rank: 2, productId: 411, productName: '儿童绘本启蒙礼盒', matchedTags: ['图书'], basis: '学习人群存在图书延伸偏好。' },
        ],
      },
      beforeAfterQuality: {
        baselineName: '热榜对照',
        optimizedName: '学习场景混排',
        baseline: { topCategoryHitRate: '61.40', tagMatchRate: '44.60' },
        optimized: { topCategoryHitRate: '79.30', tagMatchRate: '68.40' },
        hitRateLift: '17.90',
        tagMatchLift: '23.80',
        negativeFeedback: {
          productHitReduction: 1,
          categoryHitReduction: 0,
          conclusion: '通过加入收纳和效率商品，学习场景更完整，结果不再只剩台灯。',
        },
      },
    },
  },
  sports: {
    label: '运动健康型',
    experimentGroup: 'hybrid',
    interactedProducts: 29,
    userTags: ['运动恢复', '健康监测', '晨跑', '补水习惯', '穿戴偏好'],
    categoryWeights: { 运动: 0.95, 穿戴: 0.81, 健康: 0.63, 个护: 0.34 },
    behaviorStats: [
      { behaviorType: 'view', count: 17 },
      { behaviorType: 'search', count: 6 },
      { behaviorType: 'cart', count: 5 },
      { behaviorType: 'favorite', count: 4 },
      { behaviorType: 'purchase', count: 3 },
    ],
    searchCategoryPreferences: { 运动: 0.94, 穿戴: 0.76, 健康: 0.55 },
    portraitLayers: [
      { title: '短期意图', description: '最近关注手环、瑜伽垫和补水装备，晨间访问频繁。' },
      { title: '长期偏好', description: '运动和健康类商品复购更稳定，客单也更高。' },
      { title: '分群标签', description: '属于高价值活跃用户，适合做组合购和会员权益承接。' },
    ],
    segment: {
      segmentCode: 'S1',
      segmentName: '高价值活跃用户',
      confidenceScore: 0.88,
      personaSummary: '购买和复购都不低，对运动穿戴类商品接受度最好。',
      operationSuggestion: '组合购 + 会员权益',
      featureHighlights: ['purchase 高', '运动偏好', '晨间活跃'],
      topCategories: ['运动', '穿戴'],
      topTags: ['手环', '跑步', '补水'],
    },
    recommendation: {
      productIds: [405, 413, 406, 410, 403],
      explanations: [
        { primaryReason: 'COLLABORATIVE', reasonText: '运动穿戴用户对手环成交最稳定。' },
        { primaryReason: 'CONTENT_TAG', reasonText: '瑜伽、拉伸和居家健身标签强相关。' },
        { primaryReason: 'HOT_SELLING', reasonText: '补水装备属于高频运动场景刚需。' },
        { primaryReason: 'CONTENT_CATEGORY', reasonText: '个护清洁和健康类商品适合延伸承接。' },
        { primaryReason: 'COLD_START', reasonText: '数码配件做探索补位，承接户外出行场景。' },
      ],
      compareOrders: {
        online: [405, 413, 406, 410, 403],
        hybrid: [405, 413, 406, 410, 403],
        cf: [405, 406, 413, 410],
        cb: [413, 405, 410, 406],
        hot: [406, 405, 403, 413],
      },
      quality: {
        topCategoryHitRate: '84.10',
        topPreferenceCategories: ['运动', '穿戴'],
        status: 'PASS',
        tagComparisons: [
          { rank: 1, productId: 405, productName: '智能手环 S', matchedTags: ['手环', '健康'], basis: 'CF 用户相似度与穿戴权重同时命中。' },
          { rank: 2, productId: 413, productName: '瑜伽垫进阶款', matchedTags: ['瑜伽', '拉伸'], basis: '内容标签高度相关。' },
        ],
      },
      beforeAfterQuality: {
        baselineName: '热榜对照',
        optimizedName: '运动画像混排',
        baseline: { topCategoryHitRate: '63.80', tagMatchRate: '46.10' },
        optimized: { topCategoryHitRate: '84.10', tagMatchRate: '73.50' },
        hitRateLift: '20.30',
        tagMatchLift: '27.40',
        negativeFeedback: {
          productHitReduction: 1,
          categoryHitReduction: 1,
          conclusion: '增加运动恢复和健康补位后，结果更像一个完整运动场景清单。',
        },
      },
    },
  },
  home: {
    label: '居家生活型',
    experimentGroup: 'control',
    interactedProducts: 22,
    userTags: ['居家收纳', '厨房效率', '家庭采购', '品质家居', '复购稳定'],
    categoryWeights: { 家居: 0.93, 厨房: 0.72, 日用: 0.58, 图书: 0.21 },
    behaviorStats: [
      { behaviorType: 'view', count: 14 },
      { behaviorType: 'search', count: 5 },
      { behaviorType: 'cart', count: 6 },
      { behaviorType: 'favorite', count: 3 },
      { behaviorType: 'purchase', count: 4 },
    ],
    searchCategoryPreferences: { 家居: 0.91, 厨房: 0.74, 日用: 0.49 },
    portraitLayers: [
      { title: '短期意图', description: '最近连续浏览收纳、锅具和床品，偏家庭场景采购。' },
      { title: '长期偏好', description: '家居与厨房类复购更稳定，偏向实用型消费。' },
      { title: '分群标签', description: '更适合稳定复购承接，不需要过强的探索式推荐。' },
    ],
    segment: {
      segmentCode: 'S3',
      segmentName: '稳定消费用户',
      confidenceScore: 0.8,
      personaSummary: '家庭采购路径清晰，复购型商品优先级更高。',
      operationSuggestion: '满减组合 + 套装复购',
      featureHighlights: ['cart 高', '家庭场景', '复购稳定'],
      topCategories: ['家居', '厨房'],
      topTags: ['收纳', '锅具', '家庭'],
    },
    recommendation: {
      productIds: [407, 412, 408, 414, 411],
      explanations: [
        { primaryReason: 'HOT_SELLING', reasonText: '居家品质型商品在家庭场景里成交更稳。' },
        { primaryReason: 'CONTENT_CATEGORY', reasonText: '厨房效率类目权重较高，锅具命中明显。' },
        { primaryReason: 'CONTENT_TAG', reasonText: '收纳整理标签与近期浏览内容高度一致。' },
        { primaryReason: 'COLLABORATIVE', reasonText: '同类家庭采购用户会连带浏览床品。' },
        { primaryReason: 'COLD_START', reasonText: '亲子图书用于扩展家庭场景，不只局限厨房收纳。' },
      ],
      compareOrders: {
        online: [407, 412, 408, 414, 411],
        hybrid: [412, 407, 408, 414, 411],
        cf: [407, 414, 412, 408],
        cb: [412, 408, 414, 407],
        hot: [408, 412, 407, 414],
      },
      quality: {
        topCategoryHitRate: '76.40',
        topPreferenceCategories: ['家居', '厨房'],
        status: 'PASS',
        tagComparisons: [
          { rank: 1, productId: 412, productName: '麦饭石不粘锅 32cm', matchedTags: ['锅具', '厨房'], basis: '厨房类目权重与近期搜索词重合。' },
          { rank: 2, productId: 408, productName: '折叠收纳箱 60L', matchedTags: ['收纳', '家庭'], basis: '家庭场景与内容标签同步命中。' },
        ],
      },
      beforeAfterQuality: {
        baselineName: '热门对照',
        optimizedName: '居家场景混排',
        baseline: { topCategoryHitRate: '58.90', tagMatchRate: '41.70' },
        optimized: { topCategoryHitRate: '76.40', tagMatchRate: '64.80' },
        hitRateLift: '17.50',
        tagMatchLift: '23.10',
        negativeFeedback: {
          productHitReduction: 1,
          categoryHitReduction: 1,
          conclusion: '加入床品和亲子类补位后，家庭画像更完整，不再全是厨房单品。',
        },
      },
    },
  },
  beauty: {
    label: '礼赠美妆型',
    experimentGroup: 'cf_heavy',
    interactedProducts: 26,
    userTags: ['礼赠需求', '美妆偏好', '内容种草', '高颜值', '节日送礼'],
    categoryWeights: { 美妆: 0.94, 个护: 0.76, 配饰: 0.48, 家居: 0.22 },
    behaviorStats: [
      { behaviorType: 'view', count: 16 },
      { behaviorType: 'search', count: 8 },
      { behaviorType: 'cart', count: 4 },
      { behaviorType: 'favorite', count: 7 },
      { behaviorType: 'purchase', count: 2 },
    ],
    searchCategoryPreferences: { 美妆: 0.95, 个护: 0.68, 配饰: 0.46 },
    portraitLayers: [
      { title: '短期意图', description: '最近集中浏览礼盒、口红和香氛，明显偏礼赠内容。' },
      { title: '长期偏好', description: '美妆和个护的收藏率更高，偏内容种草成交。' },
      { title: '分群标签', description: '适合用高颜值组合和送礼理由做承接。' },
    ],
    segment: {
      segmentCode: 'S2',
      segmentName: '高意向待转化用户',
      confidenceScore: 0.84,
      personaSummary: '收藏和内容浏览明显偏高，礼赠理由比价格更重要。',
      operationSuggestion: '礼盒组合 + 节日话术',
      featureHighlights: ['favorite 高', '礼赠意图', '晚间浏览'],
      topCategories: ['美妆', '个护'],
      topTags: ['口红', '香氛', '送礼'],
    },
    recommendation: {
      productIds: [409, 416, 410, 417, 414],
      explanations: [
        { primaryReason: 'CONTENT_TAG', reasonText: '礼盒、送礼和高颜值标签同时命中。' },
        { primaryReason: 'COLLABORATIVE', reasonText: '同类礼赠用户对香氛护手组合点击更高。' },
        { primaryReason: 'CONTENT_CATEGORY', reasonText: '个护清洁属于高频补充品类，适合延伸。' },
        { primaryReason: 'HOT_SELLING', reasonText: '通勤穿搭商品适合做送礼搭配补位。' },
        { primaryReason: 'COLD_START', reasonText: '卧室氛围类做场景扩展，增强礼赠联想。' },
      ],
      compareOrders: {
        online: [409, 416, 410, 417, 414],
        hybrid: [409, 416, 417, 410, 414],
        cf: [416, 409, 417, 410],
        cb: [409, 410, 416, 414],
        hot: [409, 410, 416, 417],
      },
      quality: {
        topCategoryHitRate: '80.60',
        topPreferenceCategories: ['美妆', '个护'],
        status: 'PASS',
        tagComparisons: [
          { rank: 1, productId: 409, productName: '雾感口红礼盒', matchedTags: ['口红', '礼盒'], basis: '内容标签与送礼意图同步命中。' },
          { rank: 2, productId: 416, productName: '香氛护手礼盒', matchedTags: ['香氛', '礼赠'], basis: '同类礼赠用户协同相似度更高。' },
        ],
      },
      beforeAfterQuality: {
        baselineName: '热榜对照',
        optimizedName: '礼赠场景混排',
        baseline: { topCategoryHitRate: '60.80', tagMatchRate: '43.20' },
        optimized: { topCategoryHitRate: '80.60', tagMatchRate: '69.40' },
        hitRateLift: '19.80',
        tagMatchLift: '26.20',
        negativeFeedback: {
          productHitReduction: 1,
          categoryHitReduction: 0,
          conclusion: '加入配饰和卧室氛围补位后，礼赠场景更完整，不再只是一排口红。',
        },
      },
    },
  },
}

const demoPersonaBindings = new Map([
  [4, 'digital'],
  [7, 'study'],
  [12, 'sports'],
  [18, 'home'],
  [23, 'beauty'],
])

const demoPersonaSequence = ['digital', 'study', 'sports', 'home', 'beauty']

const cloneObjectRows = rows => (rows || []).map(item => ({ ...item }))

const cloneList = list =>
  Array.isArray(list)
    ? list.map(item => (item && typeof item === 'object' ? { ...item } : item))
    : []

const cloneRecord = record => ({ ...(record || {}) })

const resolveDemoPersona = (userId = 4) => {
  const numericUserId = Math.max(1, Number(userId) || 4)
  const explicitKey = demoPersonaBindings.get(numericUserId)
  if (explicitKey && demoPersonaTemplates[explicitKey]) {
    return demoPersonaTemplates[explicitKey]
  }
  const sequenceIndex = (numericUserId - 1) % demoPersonaSequence.length
  const fallbackKey = demoPersonaSequence[sequenceIndex]
  return demoPersonaTemplates[fallbackKey] || demoPersonaTemplates.digital
}

export const demoPersonaSampleUsers = Array.from(demoPersonaBindings.entries()).map(([id, key]) => {
  const persona = demoPersonaTemplates[key] || demoPersonaTemplates.digital
  return {
    id,
    label: persona.label,
    hint: persona.segment?.segmentName || '样本画像',
    tags: cloneList(persona.userTags).slice(0, 2),
  }
})

const buildDemoPortraitLayerMap = persona => ({
  intent: {
    label: '短期意图',
    values: cloneList(persona.segment.topTags || []).slice(0, 3),
    basis: persona.portraitLayers[0]?.description || '最近行为信号集中。',
  },
  preference: {
    label: '长期偏好',
    values: cloneList(persona.segment.topCategories || []).slice(0, 3),
    basis: persona.portraitLayers[1]?.description || '长期偏好稳定存在。',
  },
  segment: {
    label: '分群标签',
    values: [persona.segment.segmentName],
    basis: persona.portraitLayers[2]?.description || '分群结果进入排序承接逻辑。',
  },
})

const buildDemoRealtimeCategoryWeights = persona =>
  Object.entries(persona.categoryWeights || {})
    .slice(0, 3)
    .map(([categoryName, weight]) => ({ categoryName, weight }))

const buildDemoCompareProducts = compareOrders => ({
  online: pickDemoProducts(compareOrders.online || []),
  hybrid: pickDemoProducts(compareOrders.hybrid || []),
  cf: pickDemoProducts(compareOrders.cf || []),
  cb: pickDemoProducts(compareOrders.cb || []),
  hot: pickDemoProducts(compareOrders.hot || []),
})

export const demoRecommendProfile = (userId = 4) => {
  const persona = resolveDemoPersona(userId)
  const experiment = demoExperimentMeta[persona.experimentGroup] || demoExperimentMeta.hybrid
  return {
    userId,
    username: `demo_user_${userId}`,
    nickname: `${persona.label}用户${userId}`,
    experimentGroup: persona.experimentGroup,
    experimentGroupDesc: experiment.label,
    interactedProducts: persona.interactedProducts,
    vectorDimension: 5,
    userTags: cloneList(persona.userTags),
    categoryWeights: cloneRecord(persona.categoryWeights),
    behaviorStats: cloneObjectRows(persona.behaviorStats),
    searchCategoryPreferences: cloneRecord(persona.searchCategoryPreferences),
    portraitLayers: cloneObjectRows(persona.portraitLayers),
  }
}

export const demoRecommendPreview = (userId = 4) => {
  const persona = resolveDemoPersona(userId)
  const experiment = demoExperimentMeta[persona.experimentGroup] || demoExperimentMeta.hybrid
  return {
    userId,
    experimentGroup: persona.experimentGroup,
    algorithmWeights: cloneRecord(experiment.weights),
    products: pickDemoProducts(persona.recommendation.productIds || []),
    explanations: cloneObjectRows(persona.recommendation.explanations),
  }
}

export const demoRecommendRealtime = (userId = 4) => {
  const persona = resolveDemoPersona(userId)
  return {
    generatedAt: dateTimeText(now),
    profile: demoRecommendProfile(userId),
    segment: {
      ...cloneRecord(persona.segment),
      snapshotDate: dateText(daysAgo(1)),
    },
    recommendation: demoRecommendPreview(userId),
  }
}

export const demoRecommendCompare = (userId = 4) => {
  const persona = resolveDemoPersona(userId)
  const experiment = demoExperimentMeta[persona.experimentGroup] || demoExperimentMeta.hybrid
  return {
    userId,
    experimentGroup: persona.experimentGroup,
    weights: cloneRecord(experiment.weights),
    ...buildDemoCompareProducts(persona.recommendation.compareOrders || {}),
    quality: {
      ...cloneRecord(persona.recommendation.quality),
      topPreferenceCategories: cloneList(persona.recommendation.quality?.topPreferenceCategories || []),
      tagComparisons: cloneObjectRows(persona.recommendation.quality?.tagComparisons || []),
    },
    portraitLayers: buildDemoPortraitLayerMap(persona),
    explainableFormula: { name: '混合推荐', expression: `${experiment.weights.collaborative.toFixed(2)}CF + ${experiment.weights.content.toFixed(2)}CB + ${experiment.weights.popularity.toFixed(2)}Hot` },
    beforeAfterQuality: {
      ...cloneRecord(persona.recommendation.beforeAfterQuality),
      baseline: cloneRecord(persona.recommendation.beforeAfterQuality?.baseline),
      optimized: cloneRecord(persona.recommendation.beforeAfterQuality?.optimized),
      negativeFeedback: cloneRecord(persona.recommendation.beforeAfterQuality?.negativeFeedback),
    },
  }
}

const demoStreamUsers = [4, 7, 12, 18, 23].map(id => {
  const persona = resolveDemoPersona(id)
  return {
    id,
    nickname: `${persona.label}样本${id}`,
    username: `demo_user_${id}`,
    tags: cloneList(persona.userTags).slice(0, 3),
    topCategory: persona.segment.topCategories[0],
    behaviorEventCount: persona.behaviorStats.reduce((sum, item) => sum + Number(item.count || 0), 0),
  }
})

const toDemoHotProduct = (item, index, score) => ({
  ...item,
  productId: item.id,
  productName: item.name,
  productImage: item.mainImage || '',
  rank: index + 1,
  categoryName: index < 3 ? '数码' : '配件',
  score,
})

export const demoStreamOverview = {
  status: {
    realtimeEnabled: true,
    kafkaConsumerEnabled: false,
    consumerGroupId: 'demo-stream-group',
    redisHotLastUpdate: dateTimeText(now),
  },
  metrics: {
    hotProducts1m: 6,
    hotProducts1h: 8,
    sampleUsers: demoStreamUsers.length,
  },
  hotProducts1m: demoRecommendProducts.slice(0, 5).map((item, index) => toDemoHotProduct(item, index, 96 - index * 4)),
  hotProducts1h: demoRecommendProducts.slice(0, 5).map((item, index) => toDemoHotProduct(item, index, 90 - index * 3)),
  hotProducts1d: demoRecommendProducts.slice(0, 5).map((item, index) => toDemoHotProduct(item, index, 84 - index * 2)),
  pipeline: [
    { name: 'event', status: 'active', summary: '行为事件接收中', target: 'behavior_event' },
    { name: 'profile', status: 'ready', summary: '画像快照可读', target: 'redis:profile' },
    { name: 'hot', status: 'active', summary: '热榜已聚合', target: 'redis:hot' },
    { name: 'alert', status: 'ready', summary: '监控在线', target: 'stream-monitor' },
  ],
  sampleUsers: demoStreamUsers.map(item => ({
    user: { id: item.id, nickname: item.nickname, username: item.username },
    lastUpdate: dateTimeText(now),
    behaviorEventCount: item.behaviorEventCount,
    topCategory: item.topCategory,
    tags: item.tags,
  })),
  monitor: {
    available: true,
    updatedAt: dateTimeText(now),
    consumerLag: { totalLag: 0, topics: [{ topic: 'behavior_event', lag: 0 }] },
    deadLetter: { totalMessages: 0, topics: [] },
    alerts: [],
  },
}

export const demoStreamUserSnapshot = (userId = 4) => {
  const numericUserId = Math.max(1, Number(userId) || 4)
  const user = demoStreamUsers.find(item => item.id === numericUserId) || demoStreamUsers[0]
  const persona = resolveDemoPersona(numericUserId)
  return {
    user: { id: numericUserId, nickname: user.nickname, username: `demo_user_${numericUserId}` },
    lastUpdate: dateTimeText(now),
    tags: cloneList(user.tags),
    behaviorDistribution: cloneObjectRows(persona.behaviorStats),
    categoryWeights: buildDemoRealtimeCategoryWeights(persona),
  }
}

const demoDashboardRecentStats = Array.from({ length: 7 }, (_, index) => {
  const revenue = 428600 + index * 18200
  const orderCount = 152 + index * 7
  return {
    date: dateText(daysAgo(6 - index)),
    amount: revenue,
    orderCount,
  }
})

export const demoDashboard = {
  orderCount: 3842,
  paidOrderCount: 3219,
  refundCount: 96,
  totalUsers: 12860,
  activeUsers: 8430,
  totalProducts: 2480,
  todayOrders: 186,
  todaySales: 52680.8,
  pendingRefunds: 12,
  pendingProfileChanges: 5,
  riskAlerts: 9,
  paidUserCount: 2168,
  recentStats: demoDashboardRecentStats,
  performanceSummary: {
    exposureCount: 186420,
    clickCount: 34296,
    purchaseCount: 11403,
    conversionRate: 6.12,
    clickThroughRate: 18.4,
  },
}

export const demoRecommendAnalytics = (days = 30) => {
  const start = daysAgo(Number(days || 30) - 1)
  const dailyTrend = Array.from({ length: Math.min(Number(days || 30), 14) }, (_, index) => {
    const exposureCount = 10800 + index * 560
    const clickCount = Math.round(exposureCount * (0.158 + index * 0.002))
    const purchaseCount = Math.round(clickCount * (0.31 + index * 0.004))
    return {
      statDate: dateText(new Date(start.getTime() + index * dayMs)),
      exposureCount,
      clickCount,
      purchaseCount,
      conversionRate: Number(((purchaseCount / exposureCount) * 100).toFixed(2)),
      clickThroughRate: Number(((clickCount / exposureCount) * 100).toFixed(2)),
    }
  })

  return {
    totalUsers: 12860,
    totalProducts: 2480,
    performance: {
      days,
      startDate: dateText(start),
      endDate: dateText(now),
      summary: {
        exposureCount: 186420,
        userCount: 8430,
        clickCount: 34296,
        purchaseCount: 11403,
        successCount: 138260,
        clickThroughRate: 18.4,
        conversionRate: 6.12,
        recommendationSuccessRate: 74.16,
        postClickConversionRate: 33.23,
      },
      sceneMetrics: [
        { scene: 'HOME', exposureCount: 64200, clickCount: 12840, purchaseCount: 4301, conversionRate: 6.7, clickThroughRate: 20, successRate: 76.2 },
        { scene: 'DETAIL', exposureCount: 48360, clickCount: 8124, purchaseCount: 2892, conversionRate: 5.98, clickThroughRate: 16.8, successRate: 73.6 },
        { scene: 'CART', exposureCount: 39210, clickCount: 7449, purchaseCount: 2818, conversionRate: 7.19, clickThroughRate: 19, successRate: 78.5 },
        { scene: 'SEARCH', exposureCount: 34650, clickCount: 5883, purchaseCount: 1392, conversionRate: 4.02, clickThroughRate: 16.98, successRate: 67.9 },
      ],
      algorithmMetrics: [
        { algorithm: 'hybrid', exposureCount: 72800, clickCount: 15033, purchaseCount: 5229, conversionRate: 7.18, clickThroughRate: 20.65, successRate: 79.2 },
        { algorithm: 'collaborative', exposureCount: 51280, clickCount: 9041, purchaseCount: 3015, conversionRate: 5.88, clickThroughRate: 17.63, successRate: 72.4 },
        { algorithm: 'content', exposureCount: 38860, clickCount: 6620, purchaseCount: 2157, conversionRate: 5.55, clickThroughRate: 17.04, successRate: 70.8 },
        { algorithm: 'hot', exposureCount: 23480, clickCount: 3602, purchaseCount: 1002, conversionRate: 4.27, clickThroughRate: 15.34, successRate: 66.1 },
      ],
      dailyTrend,
      comparisonHighlights: [
        {
          dimension: 'scene',
          title: '信号源对比',
          winnerLabel: '高意向信号源承接最稳',
          baselineLabel: '检索信号源',
          summary: '高意向信号源转化更强。',
          conversionLiftRatio: 78.9,
          successLiftRatio: 15.6,
        },
        {
          dimension: 'algorithm',
          title: '算法对比',
          winnerLabel: 'Hybrid 综合排序',
          baselineLabel: '热榜兜底',
          summary: 'Hybrid 点击后购买更强。',
          conversionLiftRatio: 68.1,
          successLiftRatio: 19.8,
        },
      ],
      sceneAlgorithmLeaders: [
        { sceneLabel: '主信号源', algorithmLabel: 'Hybrid 综合排序', shareInsideScene: 0.43, conversionRate: 0.0718 },
        { sceneLabel: '内容信号源', algorithmLabel: '内容相似', shareInsideScene: 0.37, conversionRate: 0.0635 },
        { sceneLabel: '高意向信号源', algorithmLabel: '协同过滤', shareInsideScene: 0.31, conversionRate: 0.0812 },
      ],
      bestAlgorithmSegment: {
        available: true,
        segmentLabel: '高价值活跃用户',
        algorithmLabel: 'Hybrid 综合排序',
        summary: '高价值活跃用户更适合 Hybrid。',
        conversionRate: 0.0826,
        successRate: 0.812,
        exposureCount: 28640,
      },
      optimizationStages: [
        {
          key: 'recall',
          title: '多路召回',
          focus: '覆盖',
          techStack: '协同过滤 / 内容相似 / 热榜 / 搜索意图',
          evidence: 'token 追踪曝光来源。',
          result: '降低热榜同质化。',
          note: '先看召回，再看权重。',
        },
        {
          key: 'rank',
          title: '画像排序',
          focus: '转化',
          techStack: '用户偏好 / 分群标签 / 商品质量 / 库存',
          evidence: '不同分群使用不同权重。',
          result: '结果可解释。',
          note: '可联动解释面板。',
        },
      ],
      diagnosticCards: [
        { title: '数据新鲜度', value: '5 分钟', summary: 'Redis 快照保持近期可读', detail: 'MySQL 失败时仍可读取最近一批结果。' },
        { title: '归因字段', value: 'Token', summary: '曝光到成交可追踪', detail: '用于串联推荐曝光、点击和订单。' },
        { title: '降级策略', value: '热榜', summary: '异常时回退热销商品', detail: '保证推荐结果持续可用。' },
        { title: '实验口径', value: '分层', summary: '按人群与信号源比较', detail: '避免只看总量平均数。' },
      ],
      distributionQuality: {
        available: true,
        summary: '推荐曝光覆盖主信号源，高意向信号源贡献主要转化。',
      },
      sevenDayRepurchase: {
        current: 0.214,
        baseline: 0.176,
        lift: 21.6,
      },
    },
  }
}

const demoFeatureColumns = [
  'order_count_90d',
  'order_amount_90d',
  'avg_order_amount_90d',
  'distinct_category_count_90d',
  'behavior_count_30d',
  'view_count_30d',
  'cart_count_30d',
  'favorite_count_30d',
  'purchase_behavior_count_30d',
  'active_days_30d',
  'avg_duration_30d',
  'recency_order_days',
  'recency_behavior_days',
  'tenure_days',
]

export const demoKmeansLatestTask = {
  id: 2026042901,
  batchNo: 'KM-20260429-DEMO',
  snapshotDate: dateText(daysAgo(1)),
  status: 'SUCCESS',
  finalStatus: 'SUCCESS',
  clusterCount: 4,
  sampleUserCount: 8430,
  clusteredUserCount: 7526,
  coldStartUserCount: 904,
  silhouetteScore: 0.6127,
  inertiaScore: 184.392615,
  featureColumns: demoFeatureColumns,
  startTime: dateTimeText(daysAgo(1)),
  endTime: dateTimeText(new Date(daysAgo(1).getTime() + 3 * 60 * 1000)),
  dataSource: 'redis + mysql',
  freshness: {
    lastTaskTime: dateTimeText(daysAgo(1)),
    snapshotDate: dateText(daysAgo(1)),
    source: 'redis',
  },
  storageBoundary: {
    mysqlTables: ['analytics_kmeans_task', 'analytics_kmeans_segment', 'analytics_kmeans_user_result'],
    redisKeys: ['analytics:kmeans:latest:task', 'analytics:kmeans:latest:summary'],
  },
}

export const demoKmeansSegments = [
  {
    segmentCode: 'S1',
    segmentName: '高价值活跃用户',
    userCount: 1860,
    userRatio: 0.247,
    avgOrderAmount: 682.4,
    avgOrderCount: 4.8,
    avgBehaviorCount: 38.6,
    avgRecencyDays: 9,
    topCategories: ['数码', '家电', '运动'],
    segmentDescription: '近期消费高、复购强、活跃稳定，是新品首发和会员权益的优先触达人群。',
    operationSuggestion: '优先推会员券、新品首发、组合购，并保持推荐理由可解释。',
    llmSummary: '适合做高客单价商品与会员权益承接。',
  },
  {
    segmentCode: 'S2',
    segmentName: '高意向待转化用户',
    userCount: 2140,
    userRatio: 0.284,
    avgOrderAmount: 188.2,
    avgOrderCount: 1.2,
    avgBehaviorCount: 45.1,
    avgRecencyDays: 18,
    topCategories: ['美妆', '食品', '服饰'],
    segmentDescription: '浏览、收藏和加购较多，但成交偏弱，需要优惠和提醒承接。',
    operationSuggestion: '使用限时券、加购提醒和客服触达推动首单转化。',
    llmSummary: '适合做限时券和强理由推荐。',
  },
  {
    segmentCode: 'S3',
    segmentName: '稳定消费用户',
    userCount: 2688,
    userRatio: 0.357,
    avgOrderAmount: 312.7,
    avgOrderCount: 2.1,
    avgBehaviorCount: 24.4,
    avgRecencyDays: 31,
    topCategories: ['日用', '食品', '母婴'],
    segmentDescription: '消费和活跃处于中间水平，适合做常规个性化推荐和满减组合。',
    operationSuggestion: '用跨品类组合、满减券和热销榜单提升复购。',
    llmSummary: '适合做持续促活。',
  },
  {
    segmentCode: 'S4',
    segmentName: '沉睡低活跃用户',
    userCount: 838,
    userRatio: 0.111,
    avgOrderAmount: 96.5,
    avgOrderCount: 0.7,
    avgBehaviorCount: 5.4,
    avgRecencyDays: 86,
    topCategories: ['服饰', '家清'],
    segmentDescription: '近期访问和购买弱，需要召回，不适合强依赖个性化排序。',
    operationSuggestion: '先用召回券和热门商品唤醒，再逐步恢复个性化推荐。',
    llmSummary: '适合做召回运营。',
  },
  {
    segmentCode: 'COLD_START',
    segmentName: '冷启动观察用户',
    userCount: 904,
    userRatio: 0.107,
    avgOrderAmount: 0,
    avgOrderCount: 0,
    avgBehaviorCount: 1.8,
    avgRecencyDays: 0,
    topCategories: ['待识别'],
    segmentDescription: '行为样本不足，先独立观察，避免进入 KMeans 后拉偏聚类中心。',
    operationSuggestion: '优先使用热榜、新人券和类目探索策略。',
    llmSummary: '适合做冷启动推荐。',
  },
]

export const demoKmeansSummary = {
  segmentCount: 5,
  dataSource: 'redis + mysql',
  summary: {
    requestedClusterCount: 4,
    actualClusterCount: 4,
    sampleUserCount: 8430,
    clusteredUserCount: 7526,
    coldStartUserCount: 904,
    bestSegmentCode: 'S1',
    segmentDistribution: demoKmeansSegments.map(item => ({
      segmentCode: item.segmentCode,
      segmentName: item.segmentName,
      userCount: item.userCount,
      userRatio: item.userRatio,
    })),
    clusterSelection: {
      mode: 'auto_silhouette',
      candidateScores: [
        { k: 2, silhouetteScore: 0.4921 },
        { k: 3, silhouetteScore: 0.5719 },
        { k: 4, silhouetteScore: 0.6127 },
        { k: 5, silhouetteScore: 0.5982 },
      ],
    },
  },
  featureColumns: demoFeatureColumns,
  freshness: demoKmeansLatestTask.freshness,
  storageBoundary: demoKmeansLatestTask.storageBoundary,
  task: demoKmeansLatestTask,
  llmOverview: {
    overallSummary: '本批次形成高价值、待转化、稳定消费、沉睡召回和冷启动观察五类人群，可直接联动推荐与优惠券策略。',
  },
}

export const demoKmeansTaskHistory = {
  records: [
    demoKmeansLatestTask,
    {
      ...demoKmeansLatestTask,
      id: 2026042801,
      batchNo: 'KM-20260428-DEMO',
      snapshotDate: dateText(daysAgo(2)),
      startTime: dateTimeText(daysAgo(2)),
      endTime: dateTimeText(new Date(daysAgo(2).getTime() + 4 * 60 * 1000)),
      silhouetteScore: 0.6041,
    },
  ],
  total: 2,
  runtime: {
    runningInDatabase: false,
    triggerInProgress: false,
    latestStatus: 'SUCCESS',
  },
}

export const demoKmeansUsers = {
  records: [
    { userId: 1012, nickname: '张同学', username: 'user1012', segmentCode: 'S1', segmentName: '高价值活跃用户', confidenceScore: 0.91, distanceToCenter: 0.083, totalAmount: 2860.5, orderCount: 8 },
    { userId: 1048, nickname: '李同学', username: 'user1048', segmentCode: 'S2', segmentName: '高意向待转化用户', confidenceScore: 0.84, distanceToCenter: 0.126, totalAmount: 198.9, orderCount: 1 },
    { userId: 1086, nickname: '王同学', username: 'user1086', segmentCode: 'S3', segmentName: '稳定消费用户', confidenceScore: 0.79, distanceToCenter: 0.169, totalAmount: 836.2, orderCount: 3 },
  ],
  total: 3,
}

export const demoKmeansUserDetail = {
  userId: 1012,
  nickname: '张同学',
  segmentCode: 'S1',
  segmentName: '高价值活跃用户',
  confidenceScore: 0.91,
  distanceToCenter: 0.083,
  rawFeatures: {
    order_count_90d: 8,
    order_amount_90d: 2860.5,
    avg_order_amount_90d: 357.56,
    behavior_count_30d: 42,
    cart_count_30d: 9,
    favorite_count_30d: 7,
    recency_order_days: 6,
  },
  normalizedFeatures: {
    order_count_90d: 1.62,
    order_amount_90d: 1.88,
    avg_order_amount_90d: 1.31,
    behavior_count_30d: 1.44,
    recency_order_days: -0.86,
  },
  segment: demoKmeansSegments[0],
}

export const demoSeckillDiagnostics = {
  moduleEnabled: true,
  diagnosis: '秒杀链路可用，活动、报名、库存和压测链路已就绪。',
  activityCount: 3,
  publishedActivityCount: 2,
  applicationCount: 18,
  approvedApplicationCount: 12,
  visibleProductCount: 8,
}

export const demoSeckillActivities = {
  records: [
    {
      id: 301,
      name: '数码尖货限时秒杀',
      description: '库存小于并发用户数，用于验证防超卖和限购。',
      coverImage: '',
      startTime: dateTimeText(daysAfter(1)),
      endTime: dateTimeText(daysAfter(2)),
      sortOrder: 1,
      publishStatus: 1,
      runtimeStatus: 0,
    },
    {
      id: 302,
      name: '新人专享低价场',
      description: '承接冷启动用户，配合新人券和热榜推荐。',
      coverImage: '',
      startTime: dateTimeText(daysAfter(3)),
      endTime: dateTimeText(daysAfter(4)),
      sortOrder: 2,
      publishStatus: 1,
      runtimeStatus: 0,
    },
  ],
  total: 2,
}

export const demoSeckillApplications = {
  records: [
    { id: 701, activityId: 301, activityName: '数码尖货限时秒杀', productName: '旗舰影像手机 Pro', merchantName: '官方自营店', status: 0, seckillStock: 10, seckillPrice: 1999, activityStartTime: dateTimeText(daysAfter(1)), activityEndTime: dateTimeText(daysAfter(2)) },
    { id: 702, activityId: 301, activityName: '数码尖货限时秒杀', productName: '智能手表 S', merchantName: '潮品数码馆', status: 1, seckillStock: 20, seckillPrice: 499, activityStartTime: dateTimeText(daysAfter(1)), activityEndTime: dateTimeText(daysAfter(2)) },
  ],
  total: 2,
}

export const demoSeckillStressResult = {
  success: true,
  reportPath: 'docs/competition/load-test-report.md',
  report: {
    summary: {
      requests: 200,
      success: 10,
      failed: 190,
      duration_seconds: 4.82,
      throughput_per_second: 41.49,
      latency_ms: { min: 42, p50: 186, p90: 518, p95: 736, p99: 1088, max: 1260 },
      messages: {
        '秒杀成功': 10,
        '库存不足': 121,
        '限购拦截': 38,
        '请求过快': 31,
      },
    },
    preparation: {
      rechargeAmount: 50000,
      accounts: Array.from({ length: 20 }, (_, index) => ({ username: `stress_user_${index + 1}` })),
      seckillData: {
        productName: '旗舰影像手机 Pro',
        productId: 88001,
        applyId: 99001,
        seckillStock: 10,
        plannedUsers: 20,
        limitPerUser: 1,
        seckillPrice: 1999,
        competitionNote: '验证库存扣减、限购、限流和失败兜底。',
      },
    },
  },
}

export const demoSystemHealth = {
  timestamp: dateTimeText(now),
  mysql: { status: 'UP', message: '主库连接正常，统计查询可用。' },
  redis: { status: 'UP', message: '热榜与画像缓存命中稳定。' },
  pythonAnalytics: { status: 'UP', message: '离线分析脚本最近一轮执行成功。' },
  sqlInit: { status: 'UP', message: '初始化 SQL 已加载，样例数据可读。' },
  modules: { status: 'UP', enabled: 12, total: 12 },
}

export const demoAdminWorkbenchBadgeCounts = {
  profileChanges: 5,
  refunds: 12,
  reviews: 9,
  seckillApplications: 3,
}

export const demoFunnelAnalysis = {
  stages: [
    { name: '浏览', count: 12860, rate: 100 },
    { name: '搜索', count: 8430, rate: 65.55 },
    { name: '加购', count: 3120, rate: 24.26 },
    { name: '购买', count: 786, rate: 6.11 },
  ],
  conversion: {
    viewToCart: 24.26,
    cartToBuy: 25.19,
    viewToBuy: 6.11,
  },
}

export const demoRfmAnalysis = {
  thresholds: {
    recencyMedian: 21,
    frequencyMedian: 2,
    monetaryMedian: 268,
  },
  segments: [
    { name: '高价值活跃', count: 1860, percentage: 24.7 },
    { name: '高意向待转化', count: 2140, percentage: 28.4 },
    { name: '稳定消费', count: 2688, percentage: 35.7 },
    { name: '沉睡待召回', count: 838, percentage: 11.1 },
  ],
}

export const demoAssociationRules = {
  totalTransactions: 4380,
  filteredRules: 4,
  rules: [
    { productA: '耳机', productB: '充电宝', support: 386, confidenceAB: 0.41, confidenceBA: 0.36, lift: 1.42 },
    { productA: '台灯', productB: '收纳盒', support: 244, confidenceAB: 0.38, confidenceBA: 0.31, lift: 1.28 },
    { productA: '手环', productB: '运动水杯', support: 198, confidenceAB: 0.34, confidenceBA: 0.27, lift: 1.19 },
    { productA: '键盘', productB: '鼠标垫', support: 172, confidenceAB: 0.43, confidenceBA: 0.39, lift: 1.51 },
  ],
}

export const demoRetentionAnalysis = {
  months: ['注册月', '+1月', '+2月', '+3月', '+4月'],
  cohorts: [
    { cohort: dateText(daysAgo(120)).slice(0, 7), size: 1680, retention: [100, 63, 49, 41, 37] },
    { cohort: dateText(daysAgo(90)).slice(0, 7), size: 1824, retention: [100, 66, 52, 45, 39] },
    { cohort: dateText(daysAgo(60)).slice(0, 7), size: 1942, retention: [100, 68, 54, 48, 42] },
    { cohort: dateText(daysAgo(30)).slice(0, 7), size: 2106, retention: [100, 71, 58, 0, 0] },
  ],
}

export const demoAdminSalesAnalytics = {
  totalRevenue: 3258400.6,
  totalOrders: 11872,
  avgOrderValue: 274.46,
  recentStats: demoDashboardRecentStats.map(item => ({
    date: item.date,
    amount: Number((item.amount * 1.18).toFixed(2)),
    orderCount: Number(item.orderCount || 0) + 14,
  })),
  hotProducts: [
    { productName: '便携充电宝 20000mAh', salesCount: 3120, categoryName: '数码' },
    { productName: '运动水杯 1L', salesCount: 4206, categoryName: '运动' },
    { productName: '智能手环 S', salesCount: 2764, categoryName: '穿戴' },
    { productName: '氨基酸洁面套装', salesCount: 2540, categoryName: '个护' },
    { productName: '麦饭石不粘锅 32cm', salesCount: 2075, categoryName: '厨房' },
  ],
  categorySales: [
    { categoryName: '数码', totalSales: 6840 },
    { categoryName: '家居', totalSales: 4310 },
    { categoryName: '个护', totalSales: 2540 },
    { categoryName: '运动', totalSales: 4206 },
    { categoryName: '厨房', totalSales: 2075 },
    { categoryName: '穿戴', totalSales: 2764 },
  ],
}

export const demoBehaviorAnalytics = [
  { behaviorType: 'view', count: 186420, user_count: 8430 },
  { behaviorType: 'search', count: 54280, user_count: 6118 },
  { behaviorType: 'favorite', count: 28760, user_count: 3952 },
  { behaviorType: 'cart', count: 18340, user_count: 3264 },
  { behaviorType: 'purchase', count: 11403, user_count: 2168 },
]

export const demoSearchBehaviorAnalytics = (days = 14) => {
  const safeDays = Math.max(7, Math.min(Number(days || 14), 30))
  const start = daysAgo(safeDays - 1)
  const trend = Array.from({ length: safeDays }, (_, index) => {
    const totalQueries = 2280 + index * 118 + (index % 3) * 64
    const correctedHits = Math.round(totalQueries * (0.142 + (index % 4) * 0.008))
    const correctionHitRate = Number(((correctedHits / totalQueries) * 100).toFixed(2))
    return {
      date: dateText(new Date(start.getTime() + index * dayMs)),
      totalQueries,
      correctedHits,
      correctionHitRate,
    }
  })

  return {
    days: safeDays,
    quality: {
      totalQueries: trend.reduce((sum, item) => sum + item.totalQueries, 0),
      correctedHits: trend.reduce((sum, item) => sum + item.correctedHits, 0),
      correctionHitRate: 16.8,
    },
    conversion: {
      searchUserCount: 6118,
      searchToClickUserCount: 2986,
      searchToClickRate: 48.81,
      searchToPurchaseUserCount: 934,
      searchToPurchaseRate: 15.27,
    },
    trend,
    topKeywords: [
      { keyword: '蓝牙耳机', totalCount: 3240 },
      { keyword: '充电宝', totalCount: 2868 },
      { keyword: '收纳箱', totalCount: 2486 },
      { keyword: '运动水杯', totalCount: 2364 },
      { keyword: '洁面套装', totalCount: 2182 },
      { keyword: '机械键盘', totalCount: 2054 },
      { keyword: '台灯', totalCount: 1926 },
      { keyword: '不粘锅', totalCount: 1818 },
      { keyword: '咖啡机', totalCount: 1662 },
      { keyword: '口红礼盒', totalCount: 1546 },
    ],
  }
}

export const demoSalesTrendAnalysis = {
  dates: demoDashboardRecentStats.map(item => item.date),
  revenues: demoDashboardRecentStats.map(item => item.amount),
  movingAverage7: demoDashboardRecentStats.map((item, index, list) => {
    const startIndex = Math.max(0, index - 2)
    const subset = list.slice(startIndex, index + 1)
    const average = subset.reduce((sum, current) => sum + Number(current.amount || 0), 0) / subset.length
    return Number(average.toFixed(2))
  }),
  orderCounts: demoDashboardRecentStats.map(item => item.orderCount),
  totalRevenue: demoDashboardRecentStats.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  totalOrders: demoDashboardRecentStats.reduce((sum, item) => sum + Number(item.orderCount || 0), 0),
  avgOrderValue: 274.26,
  weekOverWeek: 12.8,
}

export const demoActivityHeatmap = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  hours: ['09:00', '12:00', '15:00', '18:00', '21:00'],
  data: [
    [0, 0, 26], [1, 0, 34], [2, 0, 42], [3, 0, 55], [4, 0, 61],
    [0, 1, 28], [1, 1, 37], [2, 1, 49], [3, 1, 58], [4, 1, 64],
    [0, 2, 31], [1, 2, 43], [2, 2, 56], [3, 2, 66], [4, 2, 72],
    [0, 3, 29], [1, 3, 39], [2, 3, 52], [3, 3, 60], [4, 3, 69],
    [0, 4, 35], [1, 4, 46], [2, 4, 59], [3, 4, 74], [4, 4, 82],
    [0, 5, 41], [1, 5, 55], [2, 5, 68], [3, 5, 79], [4, 5, 88],
    [0, 6, 38], [1, 6, 49], [2, 6, 63], [3, 6, 72], [4, 6, 81],
  ],
  max: 88,
}

export const demoABTestReport = {
  control: {
    groupCode: 'control',
    description: '热门对照组',
    dataSource: 'mysql',
    uniqueUsers: 2840,
    totalExposures: 64200,
    totalClicks: 9310,
    totalAddToCarts: 2216,
    totalPurchases: 842,
    ctr: 0.145,
    conversionRate: 0.0904,
    overallConversion: 0.0131,
    stratifiedLifecycle: {
      new_user: { segment: 'new_user', totalExposures: 31200, overallConversion: 0.0108 },
      returning_user: { segment: 'returning_user', totalExposures: 33000, overallConversion: 0.0153 },
    },
    stratifiedValue: {
      high_aov: { segment: 'high_aov', totalExposures: 24600, overallConversion: 0.0148 },
      low_aov: { segment: 'low_aov', totalExposures: 39600, overallConversion: 0.0121 },
    },
  },
  hybrid: {
    groupCode: 'hybrid',
    description: '标准混合组',
    dataSource: 'mysql',
    uniqueUsers: 3160,
    totalExposures: 72800,
    totalClicks: 15033,
    totalAddToCarts: 6284,
    totalPurchases: 5229,
    ctr: 0.2065,
    conversionRate: 0.3478,
    overallConversion: 0.0718,
    stratifiedLifecycle: {
      new_user: { segment: 'new_user', totalExposures: 34400, overallConversion: 0.0635 },
      returning_user: { segment: 'returning_user', totalExposures: 38400, overallConversion: 0.0792 },
    },
    stratifiedValue: {
      high_aov: { segment: 'high_aov', totalExposures: 30100, overallConversion: 0.0826 },
      low_aov: { segment: 'low_aov', totalExposures: 42700, overallConversion: 0.0641 },
    },
  },
  cf_heavy: {
    groupCode: 'cf_heavy',
    description: '协同强化组',
    dataSource: 'mysql',
    uniqueUsers: 2876,
    totalExposures: 51280,
    totalClicks: 10496,
    totalAddToCarts: 3388,
    totalPurchases: 3015,
    ctr: 0.2047,
    conversionRate: 0.2872,
    overallConversion: 0.0588,
    stratifiedLifecycle: {
      new_user: { segment: 'new_user', totalExposures: 23800, overallConversion: 0.0496 },
      returning_user: { segment: 'returning_user', totalExposures: 27480, overallConversion: 0.0667 },
    },
    stratifiedValue: {
      high_aov: { segment: 'high_aov', totalExposures: 21020, overallConversion: 0.0684 },
      low_aov: { segment: 'low_aov', totalExposures: 30260, overallConversion: 0.0521 },
    },
  },
}

export const demoAiConfig = {
  status: 'online',
  model: 'gpt-4.1-mini',
  apiUrl: 'https://api.openai.com/v1',
  modules: {
    'ai-chat': true,
    'ai-merchant-copilot': true,
    'ai-review-summary': true,
    'ai-product-qa': true,
  },
}

export const demoAiModuleSwitches = {
  'ai-chat': { enabled: true },
  'ai-merchant-copilot': { enabled: true },
  'ai-review-summary': { enabled: true },
  'ai-product-qa': { enabled: true },
}

export const demoAiTestResult = (message = '') => ({
  status: 'success',
  reply: `AI 服务在线，已收到检查消息：${String(message || '状态巡检')}。`,
})

export const demoAiReviewSummary = (productId = '') =>
  `商品 ${productId || '演示样例'} 的评价摘要：优点集中在“降噪稳定、通勤舒适、性价比高”，负面反馈主要是“续航期待更高”，适合数码偏好和价格敏感用户。`

export const demoAiProductQA = (productId = '', question = '') =>
  `商品 ${productId || '演示样例'} 更适合通勤、学习和轻送礼场景。针对问题“${question || '这款适合什么人群？'}”，建议优先推荐给高意向待转化用户，并配合限时券承接。`

export const demoAiChatResponse = (message = '') => ({
  reply: `已根据“${message || '默认需求'}”生成导购建议，优先展示高转化候选，并结合用户画像给出解释。`,
  products: demoRecommendProducts.slice(0, 3).map((item, index) => ({
    ...item,
    recommendReason: [
      '匹配数码偏好与通勤场景。',
      '命中高意向用户常见标签。',
      '热度稳定，适合作为兜底候选。',
    ][index],
  })),
  shoppingBrief: {
    summary: '优先选择高转化、评价稳定、价格在中档区间的数码商品。',
    category: '数码',
    budget: '200 - 500 元',
    brands: ['通勤优选', '性价比'],
    scenes: ['通勤', '学习'],
    keywords: ['蓝牙', '降噪', '轻便'],
  },
  insightCards: [
    { title: '推荐策略', value: 'Hybrid', description: '优先使用 0.40CF + 0.30CB + 0.30Hot。' },
    { title: '人群标签', value: '高意向待转化', description: '适合叠加限时券和加购提醒。' },
    { title: '预算带', value: '中客单', description: '更易承接首单与复购。' },
  ],
  nextActions: [
    { key: 'view_product_401', label: '查看耳机候选', description: '带入商品问答区继续讲解。', type: 'view_product', productId: 401 },
    { key: 'ask_coupon_plan', label: '继续生成优惠建议', description: '基于当前人群补一轮促转化话术。', prompt: '继续给我一套适合高意向用户的优惠承接方案' },
  ],
  suggestedPrompts: [
    '继续解释为什么这组结果优于热榜',
    '给我一段适合答辩的推荐算法讲解',
  ],
  strategyLabel: 'Hybrid 综合排序',
  personaCard: {
    segmentName: '高意向待转化用户',
    summary: '最近搜索和加购强，适合优先展示数码类高性价比商品，并叠加限时券承接。',
  },
  needClarification: false,
  clarificationQuestion: '',
})
