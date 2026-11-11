const BLOCKED_HOST_PATTERNS = [
  /(?:^|\/\/)placehold\.co\//i,
  /(?:^|\/\/)via\.placeholder\.com\//i,
  /(?:^|\/\/)dummyimage\.com\//i,
  /(?:^|\/\/)(?:api\.)?dicebear\.com\//i,
]
const SIGNED_QUERY_PATTERN = /[?&](?:Expires|Signature|OSSAccessKeyId|x-oss-signature|x-oss-expires)=/i
const OSS_HOST_PATTERN = /^https:\/\/cyy050722\.oss-cn-beijing\.aliyuncs\.com\//i
const OSS_IMAGE_PROCESS_PATTERN = /[?&]x-oss-process=image\//i

function getPreferredImageWidth() {
  if (typeof wx === 'undefined' || typeof wx.getSystemInfoSync !== 'function') {
    return 1200
  }

  try {
    const systemInfo = wx.getSystemInfoSync() || {}
    const windowWidth = Number(systemInfo.windowWidth || 375)
    const pixelRatio = Number(systemInfo.pixelRatio || 2)
    const targetWidth = Math.round(windowWidth * pixelRatio * 1.35)
    return Math.max(960, Math.min(1600, targetWidth))
  } catch (error) {
    return 1200
  }
}

function appendOssHdParams(url) {
  const text = String(url || '').trim()
  if (!text || !OSS_HOST_PATTERN.test(text) || OSS_IMAGE_PROCESS_PATTERN.test(text)) {
    return text
  }

  const joiner = text.includes('?') ? '&' : '?'
  const preferredWidth = getPreferredImageWidth()
  return `${text}${joiner}x-oss-process=image/resize,w_${preferredWidth}/quality,q_92/format,webp`
}

function sanitizeImageText(text) {
  if (!text) {
    return ''
  }

  const lower = text.toLowerCase()
  if (lower === 'null' || lower === 'undefined' || lower === 'nan') {
    return ''
  }

  const normalized = text.startsWith('//') ? `https:${text}` : text
  const secure = normalized.replace(/^http:\/\/cyy050722\.oss-cn-beijing\.aliyuncs\.com/i, 'https://cyy050722.oss-cn-beijing.aliyuncs.com')

  for (let i = 0; i < BLOCKED_HOST_PATTERNS.length; i += 1) {
    if (BLOCKED_HOST_PATTERNS[i].test(secure)) {
      return ''
    }
  }

  if (SIGNED_QUERY_PATTERN.test(secure) && secure.indexOf('?') !== -1) {
    return secure.split('?')[0]
  }

  return appendOssHdParams(secure)
}

function normalizeImageUrl(value) {
  if (!value) {
    return ''
  }

  if (Array.isArray(value)) {
    return pickFirstImage(value)
  }

  let next = value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        next = JSON.parse(trimmed)
      } catch (error) {
        next = trimmed
      }
    } else {
      next = trimmed
    }
  }

  if (Array.isArray(next)) {
    return pickFirstImage(next)
  }

  const text = sanitizeImageText(String(next || '').trim())
  if (!text) {
    return ''
  }

  if (/^https?:\/\//i.test(text) || text.startsWith('/')) {
    return text
  }

  return ''
}

function pickFirstImage(candidates = []) {
  for (let i = 0; i < candidates.length; i += 1) {
    const normalized = normalizeImageUrl(candidates[i])
    if (normalized) {
      return normalized
    }
  }
  return ''
}

function resolveProductImage(rawItem = {}) {
  return pickFirstImage([
    rawItem.productImage,
    rawItem.mainImage,
    rawItem.image,
    rawItem.thumbnail,
    rawItem.thumb,
    rawItem.imageUrl,
    Array.isArray(rawItem.images) ? rawItem.images[0] : rawItem.images,
    rawItem.product && rawItem.product.image,
    rawItem.product && rawItem.product.mainImage,
    rawItem.product && Array.isArray(rawItem.product.images) ? rawItem.product.images[0] : (rawItem.product ? rawItem.product.images : ''),
  ])
}

function resolveActivityImage(rawItem = {}) {
  return pickFirstImage([
    rawItem.activityCoverImage,
    rawItem.coverImage,
    rawItem.activityImage,
    rawItem.image,
  ])
}

module.exports = {
  normalizeImageUrl,
  pickFirstImage,
  resolveProductImage,
  resolveActivityImage,
}
