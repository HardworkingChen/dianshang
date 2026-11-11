const HIDDEN_MARKERS = [
  '秒杀压测',
  '自动秒杀压测商品',
  '链路测试',
]

function containsHiddenMarker(text) {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return HIDDEN_MARKERS.some(marker => normalized.includes(String(marker).toLowerCase()))
}

function normalizeSeckillStatus(rawStatus, startTime, endTime) {
  const now = Date.now()
  const startAt = startTime ? new Date(String(startTime).replace(/-/g, '/')).getTime() : 0
  const endAt = endTime ? new Date(String(endTime).replace(/-/g, '/')).getTime() : 0
  const hasRawStatus = rawStatus !== null && rawStatus !== undefined && `${rawStatus}` !== ''
  const status = hasRawStatus ? Number(rawStatus) : NaN

  if (status === 1 || (startAt && endAt && now >= startAt && now < endAt)) {
    return 1
  }
  if (status === 0 || (startAt && now < startAt)) {
    return 0
  }
  if (status === 3) {
    return 3
  }
  return 2
}

function isSeckillProduct(rawItem = {}) {
  const seckillApplyId = Number(rawItem.seckillApplyId || rawItem.applyId || rawItem.seckill_apply_id || 0)
  const seckillActivityId = Number(rawItem.seckillActivityId || rawItem.activityId || rawItem.seckill_activity_id || 0)
  const hasRawSeckillPrice = rawItem.seckillPrice !== null && rawItem.seckillPrice !== undefined && `${rawItem.seckillPrice}` !== ''
  const seckillPrice = hasRawSeckillPrice ? Number(rawItem.seckillPrice) : NaN
  const hasSeckillIdentity = seckillApplyId > 0 || seckillActivityId > 0 || Number.isFinite(seckillPrice)

  if (!hasSeckillIdentity) {
    return false
  }

  const status = normalizeSeckillStatus(
    rawItem.seckillStatus,
    rawItem.seckillStartTime || rawItem.startTime || '',
    rawItem.seckillEndTime || rawItem.endTime || ''
  )

  return status === 0 || status === 1 || status === 3
}

function shouldHideProduct(rawItem = {}) {
  if (!rawItem || typeof rawItem !== 'object') {
    return false
  }

  if (
    containsHiddenMarker(rawItem.name)
    || containsHiddenMarker(rawItem.productName)
    || containsHiddenMarker(rawItem.title)
    || containsHiddenMarker(rawItem.description)
    || containsHiddenMarker(rawItem.categoryName)
    || containsHiddenMarker(rawItem.category)
  ) {
    return true
  }

  const tags = Array.isArray(rawItem.tags)
    ? rawItem.tags
    : (typeof rawItem.tags === 'string' ? [rawItem.tags] : [])

  return tags.some(tag => containsHiddenMarker(tag))
}

function filterOutSeckillProducts(list = []) {
  if (!Array.isArray(list)) {
    return []
  }
  return list.filter(item => !isSeckillProduct(item) && !shouldHideProduct(item))
}

module.exports = {
  normalizeSeckillStatus,
  isSeckillProduct,
  shouldHideProduct,
  filterOutSeckillProducts
}
