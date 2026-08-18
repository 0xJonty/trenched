/**
 * MV3 service worker. Terminates when idle — hold no state here that matters.
 * Anything durable belongs in chrome.storage.local.
 */
import type { RuntimeMessage } from '../lib/protocol.ts'

chrome.runtime.onInstalled.addListener(() => {
  console.warn('[trenched] installed')
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  switch (message.type) {
    case 'tap-status':
      // M2 surfaces this in the popup.
      break
    case 'feed-frame':
      // M2 classifies, dedupes and alerts.
      break
    case 'open-research':
      // M4 opens the tabs.
      break
    case 'get-status':
      break
  }
  return false
})
