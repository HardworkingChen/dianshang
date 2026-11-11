import request from '../utils/request'
import {
  competitionRequestConfig,
  demoAiChatResponse,
  demoAiConfig,
  demoAiModuleSwitches,
  demoAiProductQA,
  demoAiReviewSummary,
  demoAiTestResult,
  withCompetitionFallback,
} from '../utils/competitionDemoData'

export const AI_REQUEST_TIMEOUT = 90000

export function getAiConfig() {
  return withCompetitionFallback(
    () => request.get('/ai/admin/config', competitionRequestConfig()),
    demoAiConfig
  )
}

export function testAiConnection(message) {
  return withCompetitionFallback(
    () => request.post('/ai/admin/test', { message }, competitionRequestConfig({ timeout: AI_REQUEST_TIMEOUT })),
    () => demoAiTestResult(message)
  )
}

export function getAiReviewSummary(productId) {
  return withCompetitionFallback(
    () => request.get(`/ai/review-summary/${productId}`, competitionRequestConfig({ timeout: AI_REQUEST_TIMEOUT })),
    () => demoAiReviewSummary(productId)
  )
}

export function askAiProductQA(productId, question) {
  return withCompetitionFallback(
    () => request.post('/ai/product-qa', { productId, question }, competitionRequestConfig({ timeout: AI_REQUEST_TIMEOUT })),
    () => demoAiProductQA(productId, question)
  )
}

export function getAiModuleSwitches() {
  return withCompetitionFallback(
    () => request.get('/admin/module-switches', competitionRequestConfig()),
    demoAiModuleSwitches
  )
}

export function updateAiModuleSwitch(module, enabled) {
  return withCompetitionFallback(
    () => request.put('/admin/module-switches', { module, enabled }, competitionRequestConfig()),
    { success: true, module, enabled }
  )
}

export function sendAiChat(message, history = []) {
  return withCompetitionFallback(
    () => request.post('/ai/chat', { message, history }, competitionRequestConfig({ timeout: AI_REQUEST_TIMEOUT })),
    () => demoAiChatResponse(message)
  )
}
