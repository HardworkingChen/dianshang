const { normalizeImageUrl, resolveProductImage } = require('../../utils/image')

Component({
  data: {
    imageLoadFailed: false,
    imageRetryAttempted: false,
    displayImage: '',
    displayMetaLine: '',
    displayReasonTag: '',
    displaySourceLabel: '',
    displaySalesText: ''
  },
  properties: {
    product: {
      type: Object,
      value: {}
    },
    skeleton: {
      type: Boolean,
      value: false
    },
    showReason: {
      type: Boolean,
      value: false
    },
    showSales: {
      type: Boolean,
      value: false
    },
    showAddCart: {
      type: Boolean,
      value: false
    },
    actionMode: {
      type: String,
      value: 'cart'
    },
    showDislike: {
      type: Boolean,
      value: false
    },
    enableLongPressMenu: {
      type: Boolean,
      value: false
    },
    longPressDuration: {
      type: Number,
      value: 1500
    },
    className: {
      type: String,
      value: ''
    }
  },
  observers: {
    'product': function (product) {
      this.syncImageState(product)
    }
  },
  lifetimes: {
    attached() {
      this.syncImageState(this.data.product)
    }
  },
  methods: {
    getProductId() {
      const product = this.data.product || {}
      return product.id || product.productId || null
    },
    normalizeText(value) {
      return String(value || '')
        .replace(/\s+/g, '')
        .replace(/[·|｜、,，。:：]/g, '')
        .trim()
        .toLowerCase()
    },
    buildDisplayFields(product = {}) {
      const salesText = String(product.salesText || '').trim()
      const normalizedSalesText = salesText && salesText !== '0' ? salesText : ''

      let metaLine = String(product.extraInfo || product.categoryName || '').trim()
      if (normalizedSalesText && metaLine.includes(`已售 ${normalizedSalesText}`)) {
        metaLine = metaLine
          .replace(new RegExp(`(?:\\s*[·|｜、,，]?\\s*)?已售\\s*${normalizedSalesText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
          .replace(/[·|｜、,，]\s*$/, '')
          .trim()
      }

      const rawReasonTag = Array.isArray(product.reasonTags) && product.reasonTags.length
        ? product.reasonTags[0]
        : (product.reason || '')
      const reasonTag = String(rawReasonTag || '').trim()
      const sourceLabel = String(product.sourceLabel || '').trim()

      const normalizedReasonTag = this.normalizeText(reasonTag)
      const normalizedSourceLabel = this.normalizeText(sourceLabel)
      const displayReasonTag = normalizedReasonTag && normalizedReasonTag !== normalizedSourceLabel
        ? reasonTag
        : ''

      return {
        displayMetaLine: metaLine,
        displayReasonTag,
        displaySourceLabel: sourceLabel,
        displaySalesText: normalizedSalesText
      }
    },
    syncImageState(product) {
      const displayFields = this.buildDisplayFields(product || {})
      this.setData({
        imageLoadFailed: false,
        imageRetryAttempted: false,
        displayImage: resolveProductImage(product || {}),
        ...displayFields
      })
    },
    onImageError() {
      const currentImage = this.data.displayImage || resolveProductImage(this.data.product || {})
      if (!this.data.imageRetryAttempted && currentImage && currentImage.indexOf('?') !== -1) {
        const retryImage = normalizeImageUrl(currentImage.split('?')[0])
        if (retryImage && retryImage !== currentImage) {
          this.setData({
            imageRetryAttempted: true,
            imageLoadFailed: false,
            displayImage: retryImage
          })
          return
        }
      }
      if (!this.data.imageLoadFailed) {
        this.setData({ imageLoadFailed: true })
      }
      console.warn('[product-card] image load failed', {
        productId: this.data.product && this.data.product.id,
        image: currentImage
      })
    },
    onLongPress() {
      if (this.data.skeleton || !this.data.enableLongPressMenu) return
      this._longPressTriggered = true
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
      this.triggerEvent('longpressmenu', {
        id: this.getProductId(),
        recToken: this.data.product.recommendationToken,
        product: this.data.product
      })
    },
    noop() {},
    onTap(e) {
      if (this.data.skeleton) return;
      if (this._suppressNextCardTap) {
        this._suppressNextCardTap = false
        return
      }
      if (this._longPressTriggered) {
        this._longPressTriggered = false
        return
      }
      const detail = {
        id: this.getProductId(),
        recToken: this.data.product.recommendationToken
      }
      const eventOptions = {
        bubbles: true,
        composed: true
      }
      this.triggerEvent('cardtap', detail, eventOptions);
      this.triggerEvent('click', detail, eventOptions);
    },
    onAddCart(e) {
      if (this.data.skeleton) return;
      this._suppressNextCardTap = true
      const productId = this.getProductId()
      if (!productId) {
        return
      }
      if (this._lastAddCartTriggerAt && Date.now() - this._lastAddCartTriggerAt < 260) {
        return
      }
      this._lastAddCartTriggerAt = Date.now()
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e.detail || {}
      this.triggerEvent('addcart', { 
        id: productId,
        recToken: this.data.product.recommendationToken,
        actionMode: this.data.actionMode || 'cart',
        clientX: touch.x || touch.clientX || 200,
        clientY: touch.y || touch.clientY || 500
      }, {
        bubbles: true,
        composed: true
      });
    },
    onDislike() {
      if (this.data.skeleton) return;
      this.triggerEvent('dislike', {
        id: this.getProductId(),
        recToken: this.data.product.recommendationToken
      });
    },
    onExplain() {
      if (this.data.skeleton) return
      this.triggerEvent('explain', {
        id: this.getProductId(),
        recToken: this.data.product.recommendationToken,
        product: this.data.product
      })
    }
  }
})
