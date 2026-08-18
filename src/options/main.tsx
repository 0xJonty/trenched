import { render } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { emptyStore, shapesByFrequency, type ReconStore } from '../lib/recon.ts'
import type { RuntimeMessage } from '../lib/protocol.ts'
import './options.css'

function ask<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>
}

function Recon() {
  const [store, setStore] = useState<ReconStore>(emptyStore())
  const [expanded, setExpanded] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStore(await ask<ReconStore>({ type: 'get-recon' }))
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 1500)
    return () => clearInterval(id)
  }, [refresh])

  const toggle = async () => {
    setStore(await ask<ReconStore>({ type: 'set-recording', recording: !store.recording }))
  }

  const clear = async () => {
    setStore(await ask<ReconStore>({ type: 'clear-recon' }))
    setExpanded(null)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trenched-recon-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const shapes = shapesByFrequency(store)

  return (
    <main class="options">
      <header>
        <h1>Trenched</h1>
        <p class="muted">
          Recon — capture Axiom's socket traffic so the feed schema can be written from real
          data instead of guesswork.
        </p>
      </header>

      <section class="panel">
        <div class="row">
          <button class={store.recording ? 'btn danger' : 'btn primary'} onClick={toggle}>
            {store.recording ? 'Stop recording' : 'Start recording'}
          </button>
          <button class="btn" onClick={exportJson} disabled={shapes.length === 0}>
            Export JSON
          </button>
          <button class="btn" onClick={clear} disabled={shapes.length === 0}>
            Clear
          </button>
        </div>

        {store.recording && (
          <p class="hint">
            Recording. Open <strong>axiom.trade</strong> and sit on Pulse — switch chains, and
            let it run until you have seen coins bond and migrate.
          </p>
        )}

        <dl class="stats">
          <div>
            <dt>Frames in</dt>
            <dd>{store.totals.in.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Frames out</dt>
            <dd>{store.totals.out.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Not JSON</dt>
            <dd>{store.totals.unparsed.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Shapes</dt>
            <dd>{shapes.length}</dd>
          </div>
        </dl>

        {store.droppedShapes > 0 && (
          <p class="warn">
            {store.droppedShapes} distinct shapes were dropped after hitting the cap. Clear and
            record a narrower session if you need them.
          </p>
        )}
      </section>

      {store.socketUrls.length > 0 && (
        <section class="panel">
          <h2>Sockets</h2>
          <ul class="urls">
            {store.socketUrls.map((url) => (
              <li key={url}>
                <code>{url}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="panel">
        <h2>Shapes</h2>
        {shapes.length === 0 ? (
          <p class="muted">Nothing captured yet.</p>
        ) : (
          <table class="shapes">
            <thead>
              <tr>
                <th>Dir</th>
                <th>Count</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              {shapes.map((shape) => {
                const key = `${shape.direction}:${shape.signature}`
                const open = expanded === key
                return (
                  <>
                    <tr key={key} class="clickable" onClick={() => setExpanded(open ? null : key)}>
                      <td>
                        <span class={`tag ${shape.direction}`}>{shape.direction}</span>
                      </td>
                      <td class="num">{shape.count.toLocaleString()}</td>
                      <td>
                        <code>{shape.signature}</code>
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${key}:sample`}>
                        <td colSpan={3}>
                          <pre class="sample">{JSON.stringify(shape.samples, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {store.unparsedSamples.length > 0 && (
        <section class="panel">
          <h2>Non-JSON frames</h2>
          <pre class="sample">{store.unparsedSamples.join('\n')}</pre>
        </section>
      )}

      <footer class="muted">
        Samples are redacted and truncated before they are stored. Check an export before
        pasting it anywhere public.
      </footer>
    </main>
  )
}

const root = document.getElementById('root')
if (root) render(<Recon />, root)
