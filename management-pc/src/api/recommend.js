import request from '../utils/request'
import {
  competitionRequestConfig,
  demoABTestReport,
  demoRecommendCompare,
  demoRecommendPreview,
  demoRecommendProfile,
  demoRecommendRealtime,
  withCompetitionFallback,
} from '../utils/competitionDemoData'

export function getRecommendPreview(userId, limit = 10) {
  if (!userId || userId === 'undefined') return Promise.reject(new Error('缺少用户 ID'))
  return withCompetitionFallback(
    () => request.get(`/admin/recommend/preview/${userId}`, competitionRequestConfig({ params: { limit } })),
    () => {
      const preview = demoRecommendPreview(userId)
      return { ...preview, products: (preview.products || []).slice(0, limit) }
    }
  )
}

export function getRecommendRealtime(userId, limit = 10) {
  if (!userId || userId === 'undefined') return Promise.reject(new Error('缺少用户 ID'))
  return withCompetitionFallback(
    () => request.get(`/admin/recommend/realtime/${userId}`, competitionRequestConfig({ params: { limit } })),
    () => {
      const realtime = demoRecommendRealtime(userId)
      return {
        ...realtime,
        recommendation: {
          ...(realtime.recommendation || {}),
          products: (realtime.recommendation?.products || []).slice(0, limit),
        },
      }
    }
  )
}

export function getRecommendCompare(userId, limit = 10) {
  if (!userId || userId === 'undefined') return Promise.reject(new Error('缺少用户 ID'))
  return withCompetitionFallback(
    () => request.get(`/admin/recommend/compare/${userId}`, competitionRequestConfig({ params: { limit } })),
    () => {
      const compare = demoRecommendCompare(userId)
      return {
        ...compare,
        online: (compare.online || []).slice(0, limit),
        hybrid: (compare.hybrid || []).slice(0, limit),
        cf: (compare.cf || []).slice(0, limit),
        cb: (compare.cb || []).slice(0, limit),
        hot: (compare.hot || []).slice(0, limit),
      }
    }
  )
}

export function getUserProfile(userId) {
  if (!userId || userId === 'undefined') return Promise.reject(new Error('缺少用户 ID'))
  return withCompetitionFallback(
    () => request.get(`/admin/recommend/user-profile/${userId}`, competitionRequestConfig()),
    () => demoRecommendProfile(userId)
  )
}

export function getABTestReport() {
  return withCompetitionFallback(
    () => request.get('/admin/recommend/abtest-report', competitionRequestConfig()),
    demoABTestReport
  )
}

export function resetABTest() {
  return withCompetitionFallback(
    () => request.post('/admin/recommend/abtest-reset', {}, competitionRequestConfig()),
    { success: true, message: '演示模式已重置实验数据。' }
  )
}
