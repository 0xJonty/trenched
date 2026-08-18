import { render } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { emptyStore, type ReconStore } from '../lib/recon.ts'
import type { RuntimeMessage } from '../lib/protocol.ts'
import './popup.css'

function ask<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>
}

function Popup() {
  const [store, setStore] = useState<ReconStore>(emptyStore())

  const refresh = useCallback(async () => {
    setStore(await ask<ReconStore>({ type: 'get-recon' }))
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 1000)
    return () => clearInterval(id)
  }, [refresh])

  const captured = store.totals.in + store.totals.out

  return (
    <main class="popup">
      <h1>Trenched</h1>

      <div class={`status ${store.recording ? 'live' : ''}`}>
        <span class="dot" />
        {store.recording ? 'Recording' : 'Idle'}
      </div>

      {store.recording ? (
        <p class="muted">
          {captured.toLocaleString()} frames captured across {Object.keys(store.shapes).length}{' '}
          shapes.
        </p>
      ) : (
        <p class="muted">
          Alerts are not built yet. Start a recon recording to capture Axiom's feed.
        </p>
      )}

      <button class="btn" onClick={() => void chrome.runtime.openOptionsPage()}>
        Open recon
      </button>
    </main>
  )
}

const root = document.getElementById('root')
if (root) render(<Popup />, root)
