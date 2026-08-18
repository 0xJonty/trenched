/**
 * ISOLATED world. The only place that talks to both the page and the
 * service worker.
 */
import { isTapMessage } from '../lib/protocol.ts'

window.addEventListener('message', (event: MessageEvent) => {
  // Only trust messages this window posted to itself.
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  if (!isTapMessage(event.data)) return

  const message = event.data

  switch (message.type) {
    case 'socket-open':
      void chrome.runtime.sendMessage({ type: 'tap-status', connected: true, url: message.url })
      break
    case 'socket-close':
      void chrome.runtime.sendMessage({ type: 'tap-status', connected: false, url: message.url })
      break
    case 'frame':
      void chrome.runtime.sendMessage({ type: 'feed-frame', payload: message.payload })
      break
  }
})
