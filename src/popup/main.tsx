import { render } from 'preact'
import './popup.css'

function Popup() {
  return (
    <main class="popup">
      <h1>Trenched</h1>
      <p class="muted">Scaffold. Feed status lands in M2.</p>
    </main>
  )
}

const root = document.getElementById('root')
if (root) render(<Popup />, root)
