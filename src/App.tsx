import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './App.css'

type MicState = 'idle' | 'checking' | 'ready' | 'denied'

function TraceMark() {
  return <div className="trace-mark" aria-hidden="true"><span className="trace-orbit trace-orbit-one"/><span className="trace-orbit trace-orbit-two"/><span className="trace-mark-core"/></div>
}

function MainApp() {
  const [showSplash, setShowSplash] = useState(true)
  const [micState, setMicState] = useState<MicState>('idle')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1550)
    return () => window.clearTimeout(splashTimer)
  }, [])

  const checkMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState('denied')
      setNotice('Microphone access is unavailable in this environment.')
      return
    }
    setMicState('checking')
    setNotice('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setMicState('ready')
      setNotice('Microphone access is ready. Voice recognition is the next feature to connect.')
    } catch {
      setMicState('denied')
      setNotice('Microphone access was not granted. You can enable it in Windows settings.')
    }
  }

  const exitTrace = async () => {
    try {
      await getCurrentWindow().close()
    } catch {
      setNotice('You can close TRACE with Alt + F4.')
    }
  }

  return (
    <main className="trace-app">
      {showSplash ? (
        <section className="trace-splash" aria-label="TRACE startup">
          <TraceMark />
          <div className="splash-wordmark">T R A C E</div>
          <p>A little help, right when you need it.</p>
        </section>
      ) : (
        <section className="trace-home">
          <header className="trace-home-brand">
            <TraceMark />
            <span>T R A C E</span>
          </header>

          <div className="trace-prompt">
            <div className="trace-eyebrow"><span/> YOUR PERSONAL GUIDE <span/></div>
            <h1>What would you<br/><em>like to find?</em></h1>
            <p>Just tell me what you're looking for. I'll help you get there.</p>

            <button
              className={'trace-mic-button' + (micState === 'checking' ? ' checking' : '')}
              onClick={checkMicrophone}
              disabled={micState === 'checking'}
              aria-label="Check microphone access"
            >
              <span className="mic-halo"/>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7"/></svg>
            </button>
            <div className="trace-mic-caption">
              {micState === 'checking' ? 'CHECKING MICROPHONE' : micState === 'ready' ? 'MICROPHONE READY' : micState === 'denied' ? 'MICROPHONE UNAVAILABLE' : 'TAP TO SPEAK'}
            </div>
            <div className="trace-privacy"><span/> YOUR DEVICE · YOUR CONTROL</div>
            {notice && <p className="trace-notice" role="status">{notice}</p>}
          </div>

          <footer className="trace-footer">
            <span>HERE WHEN YOU NEED IT</span>
            <button className="trace-exit" onClick={exitTrace} aria-label="Exit TRACE" title="Exit TRACE">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H10M15 16l4-4-4-4M19 12H9"/></svg>
              <span>EXIT</span>
            </button>
          </footer>
        </section>
      )}
    </main>
  )
}

export default MainApp
