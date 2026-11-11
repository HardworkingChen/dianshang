const { getSystemInfoCompat } = require('../utils/system-info')

let runtimeConfig = {}
try {
  runtimeConfig = require('./runtime') || {}
} catch (err) {
  runtimeConfig = {}
}

let privateConfig = {}
try {
  privateConfig = require('../project.private.config.json') || {}
} catch (err) {
  privateConfig = {}
}

const trimEndSlash = (value) => String(value || '').trim().replace(/\/+$/, '')
const pickFirstConfiguredValue = (...values) => {
  for (let index = 0; index < values.length; index += 1) {
    const current = trimEndSlash(values[index])
    if (current) {
      return current
    }
  }
  return ''
}

const withApiSuffix = (value) => {
  const normalized = trimEndSlash(value)
  if (!normalized) {
    return ''
  }
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

const DEFAULT_REMOTE_BASE = 'http://39.102.61.148/api'

const API_BASES = {
  localhost: withApiSuffix(
    pickFirstConfiguredValue(
      runtimeConfig.apiBaseUrlLocal,
      privateConfig.apiBaseUrlLocal,
      runtimeConfig.apiBaseUrlDevLocal,
      privateConfig.apiBaseUrlDevLocal,
      'http://localhost:8080'
    )
  ),
  lan: withApiSuffix(
    pickFirstConfiguredValue(
      runtimeConfig.apiBaseUrlLan,
      privateConfig.apiBaseUrlLan,
      'http://192.168.0.10:8080'
    )
  ),
  server: withApiSuffix(
    pickFirstConfiguredValue(
      runtimeConfig.apiBaseUrlDevice,
      runtimeConfig.apiBaseUrl,
      privateConfig.apiBaseUrlDevice,
      privateConfig.apiBaseUrl,
      DEFAULT_REMOTE_BASE
    )
  ),
  trial: withApiSuffix(
    pickFirstConfiguredValue(
      runtimeConfig.apiBaseUrlTrial,
      privateConfig.apiBaseUrlTrial,
      DEFAULT_REMOTE_BASE
    )
  ),
  release: withApiSuffix(
    pickFirstConfiguredValue(
      runtimeConfig.apiBaseUrlRelease,
      privateConfig.apiBaseUrlRelease,
      DEFAULT_REMOTE_BASE
    )
  )
}

const FALLBACK_BASE = API_BASES.server

const ENV_CONFIG = {
  develop: {
    apiBaseUrl: API_BASES.server,
    apiBaseUrlDevtools: withApiSuffix(
      pickFirstConfiguredValue(
        runtimeConfig.apiBaseUrlDevtools,
        runtimeConfig.apiBaseUrlDev,
        privateConfig.apiBaseUrlDevtools,
        privateConfig.apiBaseUrlDev,
        runtimeConfig.useLocalDevApi === true || privateConfig.useLocalDevApi === true ? API_BASES.localhost : '',
        API_BASES.server
      )
    ),
    apiBaseUrlDevice: withApiSuffix(
      pickFirstConfiguredValue(
        runtimeConfig.apiBaseUrlDevice,
        privateConfig.apiBaseUrlDevice,
        API_BASES.server
      )
    )
  },
  trial: {
    apiBaseUrl: API_BASES.trial,
    apiBaseUrlDevtools: API_BASES.trial,
    apiBaseUrlDevice: API_BASES.trial
  },
  release: {
    apiBaseUrl: API_BASES.release,
    apiBaseUrlDevtools: API_BASES.release,
    apiBaseUrlDevice: API_BASES.release
  }
}

const normalizeEnvName = (env) => {
  if (!env) {
    return 'develop'
  }
  return String(env).toLowerCase()
}

const detectRuntimePlatform = () => {
  if (typeof wx !== 'object') {
    return 'unknown'
  }

  try {
    const systemInfo = getSystemInfoCompat()
    const platform = String(systemInfo.platform || '').toLowerCase()
    if (platform === 'devtools') {
      return 'devtools'
    }
    return 'device'
  } catch (err) {
    console.warn('[config/env] get runtime platform failed:', err)
  }

  return 'unknown'
}

const detectEnv版本 = () => {
  if (typeof wx !== 'object' || typeof wx.getAccountInfoSync !== 'function') {
    return 'develop'
  }

  try {
    const info = wx.getAccountInfoSync()
    if (info && info.miniProgram && (info.miniProgram.envVersion || info.miniProgram.env版本)) {
      return normalizeEnvName(info.miniProgram.envVersion || info.miniProgram.env版本)
    }
  } catch (err) {
    console.warn('[config/env] getAccountInfoSync failed:', err)
  }

  return 'develop'
}

const getApiBaseUrl = () => {
  const env = detectEnv版本()
  const config = ENV_CONFIG[env] || ENV_CONFIG.develop
  const runtimePlatform = detectRuntimePlatform()

  if (runtimePlatform === 'devtools' && config.apiBaseUrlDevtools) {
    return config.apiBaseUrlDevtools
  }

  if (runtimePlatform === 'device' && config.apiBaseUrlDevice) {
    return config.apiBaseUrlDevice
  }

  return config.apiBaseUrl || FALLBACK_BASE
}

const getRuntimeAllowedHosts = () => {
  const env = detectEnv版本()
  const serverHost = getHostFromUrl(API_BASES.server)
  const lanHost = getHostFromUrl(API_BASES.lan)
  const trialHost = getHostFromUrl(API_BASES.trial)
  const releaseHost = getHostFromUrl(API_BASES.release)
  const commonHosts = [
    serverHost,
    trialHost,
    releaseHost
  ]

  if (env === 'develop') {
    return [
      'localhost',
      '127.0.0.1',
      lanHost,
      serverHost,
      ...commonHosts
    ].filter(Boolean)
  }

  return commonHosts
}

const getHostFromUrl = (url) => {
  const text = String(url || '')
  const match = text.match(/^https?:\/\/([^/:?#]+)/i)
  return match ? match[1] : ''
}

module.exports = {
  getApiBaseUrl,
  detectEnv版本,
  detectRuntimePlatform,
  getRuntimeAllowedHosts,
  API_BASES
}

