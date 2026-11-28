import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './App.css'

type MicState = 'idle' | 'listening' | 'transcribing' | 'captured' | 'error'

function TraceMark() {
  return <div className="trace-mark" aria-hidden="true"><span className="trace-orbit trace-orbit-one"/><span className="trace-orbit trace-orbit-two"/><span className="trace-mark-core"/></div>
}

async function decodeToWhisperPcm(blob: Blob): Promise<number[]> {
  const decodeContext = new AudioContext()
  try {
    const decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer())
    const sampleRate = 16_000
    const frameCount = Math.ceil(decoded.duration * sampleRate)
    const offline = new OfflineAudioContext(1, frameCount, sampleRate)
    const mono = offline.createBuffer(1, decoded.length, decoded.sampleRate)
    const output = mono.getChannelData(0)
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel))
    for (let i = 0; i < decoded.length; i++) {
      let sum = 0
      for (const channel of channels) sum += channel[i]
      output[i] = sum / channels.length
    }
    const source = offline.createBufferSource()
    source.buffer = mono
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return Array.from(rendered.getChannelData(0))
  } finally {
    await decodeContext.close()
  }
}

function MainApp() {
  const [showSplash, setShowSplash] = useState(true)
  const [micState, setMicState] = useState<MicState>('idle')
  const [notice, setNotice] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [capturedSeconds, setCapturedSeconds] = useState(0)
  const [transcript, setTranscript] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const speechStartedAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const chunksRef = useRef<Blob[]>([])
  const finishedRef = useRef(false)

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1650)
    return () => {
      window.clearTimeout(splashTimer)
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      void audioContextRef.current?.close()
    }
  }, [])

  const releaseAudio = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }
    audioContextRef.current = null
    setAudioLevel(0)
  }

  const finishRecording = (reason: 'silence' | 'timeout' | 'manual') => {
    if (finishedRef.current) return
    finishedRef.current = true
    const elapsed = Math.max(0, Math.round((performance.now() - startedAtRef.current) / 1000))
    setCapturedSeconds(elapsed)
    const hasSpeech = speechStartedAtRef.current > 0
    if (reason === 'timeout') {
      setNotice('I stopped listening after 30 seconds.')
    } else if (!hasSpeech) {
      setMicState('captured')
      setNotice('I didn’t hear anything clearly. Please try again, a little closer to your microphone.')
    } else {
      setMicState('transcribing')
      setNotice('Transcribing on your device. The first run may download the local speech model.')
    }

    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    releaseAudio()
  }

  const startListening = async () => {
    if (micState === 'listening') {
      finishRecording('manual')
      return
    }
    if (micState === 'transcribing') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicState('error')
      setNotice('Audio recording is not supported by this environment.')
      return
    }

    setNotice('')
    setTranscript('')
    setCapturedSeconds(0)
    setMicState('listening')
    finishedRef.current = false
    speechStartedAtRef.current = 0
    lastVoiceAtRef.current = 0
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        if (speechStartedAtRef.current === 0) return
        try {
          const recording = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const samples = await decodeToWhisperPcm(recording)
          const result = await invoke<string>('transcribe_audio', { samples })
          setTranscript(result)
          setNotice('I heard: “' + result + '”')
          setMicState('captured')
        } catch (error) {
          setMicState('error')
          setNotice(String(error).replace(/^Error: /, ''))
        } finally {
          chunksRef.current = []
          recorderRef.current = null
        }
      }
      recorder.start(250)

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) throw new Error('Audio analysis is unavailable in this environment.')
      const context = new AudioContextClass()
      audioContextRef.current = context
      await context.resume()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      startedAtRef.current = performance.now()

      const detectAudio = () => {
        if (finishedRef.current) return
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (let i = 0; i < samples.length; i++) {
          const sample = (samples[i] - 128) / 128
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / samples.length)
        setAudioLevel(Math.min(1, rms * 8))

        const now = performance.now()
        if (rms > 0.026) {
          if (speechStartedAtRef.current === 0) speechStartedAtRef.current = now
          lastVoiceAtRef.current = now
        }
        const elapsed = now - startedAtRef.current
        if (elapsed >= 30000) {
          finishRecording('timeout')
          return
        }
        if (speechStartedAtRef.current > 0 && now - lastVoiceAtRef.current >= 1400) {
          finishRecording('silence')
          return
        }
        if (speechStartedAtRef.current === 0 && elapsed >= 8000) {
          finishRecording('silence')
          return
        }
        animationFrameRef.current = requestAnimationFrame(detectAudio)
      }
      animationFrameRef.current = requestAnimationFrame(detectAudio)
    } catch (error) {
      releaseAudio()
      recorderRef.current = null
      setMicState('error')
      setNotice(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access was not granted. Enable it in Windows settings and try again.'
        : 'TRACE could not start the microphone. Check that it is connected and not being used exclusively by another app.')
    }
  }

  const exitTrace = async () => {
    if (micState === 'listening') finishRecording('manual')
    try {
      await getCurrentWindow().close()
    } catch {
      setNotice('You can close TRACE with Alt + F4.')
    }
  }

  const micLabel = micState === 'listening' ? 'LISTENING · TAP TO STOP' : micState === 'transcribing' ? 'UNDERSTANDING YOUR VOICE' : micState === 'captured' ? 'TAP TO SPEAK AGAIN' : micState === 'error' ? 'PLEASE TRY AGAIN' : 'TAP TO SPEAK'

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
              className={'trace-mic-button' + (micState === 'listening' ? ' listening' : '') + (micState === 'transcribing' ? ' transcribing' : '')}
              onClick={startListening}
              aria-label={micState === 'listening' ? 'Stop listening' : 'Start speaking'}
              aria-pressed={micState === 'listening'}
              disabled={micState === 'transcribing'}
            >
              <span className="mic-halo"/>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7"/></svg>
            </button>
            <div className="trace-mic-caption">{micLabel}</div>
            {micState === 'listening' && (
              <div className="trace-live-meter" aria-label="Live microphone level">
                {Array.from({ length: 25 }, (_, i) => {
                  const wave = Math.max(3, (0.15 + audioLevel * (0.5 + 0.5 * Math.sin(i * 1.7))) * 28)
                  return <span key={i} style={{ height: wave + 'px' }}/>
                })}
              </div>
            )}
            <div className="trace-privacy"><span/> YOUR DEVICE · YOUR CONTROL</div>
            {notice && <p className="trace-notice" role="status">{notice}{capturedSeconds > 0 ? ' (' + capturedSeconds + 's)' : ''}</p>}
            {transcript && <p className="trace-transcript">{transcript}</p>}
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
