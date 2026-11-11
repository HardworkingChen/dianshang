const LEGACY_BANNER_PREFIX = 'https://cyy050722.oss-cn-beijing.aliyuncs.com/seed/banners/'
const { normalizeImageUrl } = require('./image')

const TITLE_BANNER_IMAGE_MAP = {
  '河南特色好物': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Xinyang_Maojian.jpg/960px-Xinyang_Maojian.jpg',
  '非遗文创与伴手礼': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Ru_Ware_%28cropped%29.JPG/960px-Ru_Ware_%28cropped%29.JPG',
  '洛阳礼物精选': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Luoyang_Peony_Museum.jpg/960px-Luoyang_Peony_Museum.jpg',
  '节气茶礼上新': 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Maojian.jpg',
  '少林文创新品': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Folding_fan_with_figures_in_garden_setting_%28recto%29_%28CBL_C_3066%2C_front%29.jpg',
  '汝瓷雅礼推荐': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Jin_Jun_Ware_Cup.jpg/960px-Jin_Jun_Ware_Cup.jpg',
}

function resolveBannerImage(title, image) {
  const fallbackImage = TITLE_BANNER_IMAGE_MAP[String(title || '').trim()]
  if (!image) {
    return normalizeImageUrl(fallbackImage || '')
  }
  if (String(image).startsWith(LEGACY_BANNER_PREFIX) && fallbackImage) {
    return normalizeImageUrl(fallbackImage)
  }
  return normalizeImageUrl(image)
}

module.exports = {
  resolveBannerImage
}
