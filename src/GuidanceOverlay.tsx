import { invoke } from '@tauri-apps/api/core'
import './GuidanceOverlay.css'

export default function GuidanceOverlay() {
  const returnToTrace = async () => {
    await invoke('close_guidance_preview')
  }

  return (
    <main className="guidance-overlay">
      <div className="guidance-preview-note">
        <span className="guidance-preview-mark">✳</span>
        <div>
          <strong>TRACE guidance preview</strong>
          <p>The native overlay is running above your desktop.</p>
        </div>
        <button onClick={returnToTrace}>Return to TRACE <span>↗</span></button>
      </div>

      <div className="guidance-target-demo" aria-hidden="true">
        <span className="guidance-target-corner corner-tl" />
        <span className="guidance-target-corner corner-tr" />
        <span className="guidance-target-corner corner-bl" />
        <span className="guidance-target-corner corner-br" />
        <span className="guidance-target-label">TARGET HIGHLIGHT PREVIEW</span>
      </div>

      <div className="guidance-instruction">
        <span className="guidance-instruction-kicker">YOUR NEXT STEP</span>
        <p>When TRACE finds the right place, it will highlight it here and explain what to do.</p>
        <span className="guidance-instruction-foot">One step at a time · You're in control</span>
      </div>
    </main>
  )
}
