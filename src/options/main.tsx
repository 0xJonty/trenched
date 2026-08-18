import { render } from 'preact'
import './options.css'

function Options() {
  return (
    <main class="options">
      <h1>Trenched</h1>
      <p class="muted">
        Scaffold. Chain filters, sounds and the dev wallet list land in M2 and M3.
      </p>
    </main>
  )
}

const root = document.getElementById('root')
if (root) render(<Options />, root)
