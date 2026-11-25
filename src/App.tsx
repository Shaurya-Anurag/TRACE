import { useMemo, useState } from 'react'
import './App.css'

type Page = 'Home' | 'Active Sessions' | 'Explore possibilities' | 'Your computer' | 'Your activity' | 'Preferences'
type Status = 'In progress' | 'Paused' | 'Completed' | 'Needs attention'

const navItems: { label: Page; icon: string }[] = [
  { label: 'Home', icon: '⌂' },
  { label: 'Active Sessions', icon: '◷' },
  { label: 'Explore possibilities', icon: '✳' },
  { label: 'Your computer', icon: '▣' },
  { label: 'Your activity', icon: '↗' },
]
const tasks = [
  { title: 'Find the photos from my birthday', detail: 'Looking through your Pictures folder', app: 'File Explorer', status: 'In progress' as Status, progress: 68, step: 'Checking folders modified around your birthday', time: 'Just now' },
  { title: 'Save the recipe I found yesterday', detail: 'A browser page is ready to be saved', app: 'Microsoft Edge', status: 'Paused' as Status, progress: 32, step: 'Waiting for you to choose where to save it', time: 'Today, 10:42 AM' },
  { title: 'Organise the documents on my desktop', detail: 'Sorting documents into sensible groups', app: 'File Explorer', status: 'Needs attention' as Status, progress: 54, step: 'I found a few files I cannot confidently classify', time: 'Yesterday' },
]
const suggestions = [
  { icon: '⌕', title: 'Find something on your computer', desc: 'Locate a file, photo, document, or download.' },
  { icon: '▤', title: 'Work with a document', desc: 'Open, organise, rename, or save a document.' },
  { icon: '◎', title: 'Find something online', desc: 'Search the web and get to the right place.' },
  { icon: '▧', title: 'Organise your files', desc: 'Tidy up folders without losing track of anything.' },
]
const apps = [
  { name: 'Microsoft Edge', detail: 'Browser', state: 'Ready', symbol: 'e', tone: 'edge' },
  { name: 'Google Chrome', detail: 'Browser', state: 'Ready', symbol: '◉', tone: 'chrome' },
  { name: 'File Explorer', detail: 'Files and folders', state: 'Ready', symbol: '▰', tone: 'folder' },
  { name: 'Microsoft Word', detail: 'Documents', state: 'Partial support', symbol: 'W', tone: 'word' },
  { name: 'Photos', detail: 'Photos and images', state: 'Partial support', symbol: '✿', tone: 'photos' },
  { name: 'Blender', detail: '3D creation', state: 'Not supported yet', symbol: '◈', tone: 'blender' },
]
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    search: 'M11 19a8 8 0 1 1 5.657-2.343L22 22M16.657 16.657 22 22',
    mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    chevron: 'm9 18 6-6-6-6',
    plus: 'M12 5v14m-7-7h14',
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    pause: 'M8 5v14m8-14v14',
    play: 'm8 5 12 7-12 7V5Z',
    close: 'm6 6 12 12M18 6 6 18',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2m10-10h-2M4 12H2m17.07-7.07-1.42 1.42M6.35 17.65l-1.42 1.42m14.14 0-1.42-1.42M6.35 6.35 4.93 4.93',
    check: 'm5 12 4 4L19 6',
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.plus} /></svg>
}
function StatusPill({ status }: { status: Status | string }) {
  return <span className={'status status-' + status.toLowerCase().replaceAll(' ', '-')}>{status}</span>
}
function App() {
  const [page, setPage] = useState<Page>('Home')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [expandedTask, setExpandedTask] = useState<number | null>(0)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [toast, setToast] = useState('')
  const [appQuery, setAppQuery] = useState('')
  const [preferenceTab, setPreferenceTab] = useState('General')
  const filteredTasks = useMemo(() => localTasks.filter(t => (filter === 'All' || t.status === filter) && (t.title + t.app).toLowerCase().includes(query.toLowerCase())), [localTasks, filter, query])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const go = (next: Page) => { setPage(next); setToast('') }
  const updateTask = (index: number, status: Status) => setLocalTasks(old => old.map((t, i) => i === index ? { ...t, status } : t))
  const title = page === 'Home' ? 'Your workspace' : page
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span /></div><div><div className="brand-name">TRACE</div><div className="brand-caption">A little help, right when you need it.</div></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="nav-list">
        {navItems.map(item => <button key={item.label} className={'nav-item ' + (page === item.label ? 'active' : '')} onClick={() => go(item.label)}><span className="nav-glyph">{item.icon}</span><span>{item.label}</span>{item.label === 'Active Sessions' && <span className="nav-count">{localTasks.filter(t => t.status === 'In progress' || t.status === 'Paused').length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-mini"><span className="privacy-dot" /><div><strong>Running on your device</strong><small>Your information stays yours.</small></div></div>
        <button className={'nav-item settings-link ' + (page === 'Preferences' ? 'active' : '')} onClick={() => go('Preferences')}><span className="nav-glyph"><Icon name="settings" /></span><span>Preferences</span></button>
        <div className="profile-row"><div className="avatar">S</div><div><strong>Your TRACE</strong><small>Personal workspace</small></div><button className="icon-button" onClick={() => notify('You are using your local TRACE workspace.')} aria-label="More options"><Icon name="more" /></button></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>TRACE</span><Icon name="chevron" /><strong>{title}</strong></div><div className="topbar-right"><span className="local-indicator"><i /> Local mode</span><button className="top-avatar" onClick={() => go('Preferences')}>S</button></div></header>
      <div className="page-scroll">
        {page === 'Home' && <div className="home-page">
          <section className="welcome"><div className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL GUIDE</div><h1>What are we<br/><em>working on?</em></h1><p className="welcome-copy">Tell me what you'd like to do. We'll figure it out together.</p>
            <div className="command-box"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && notify(query.trim() ? 'Your request is ready to begin. Task execution will be connected next.' : 'Tell me what you would like help with.')} placeholder="I want to find the photos from my birthday..." aria-label="Describe what you want help with"/><button className="mic-button" onClick={() => notify('Voice input will be available when local speech recognition is connected.')} aria-label="Voice input"><Icon name="mic" /></button><button className="send-button" onClick={() => notify(query.trim() ? 'Your request is ready to begin. Task execution will be connected next.' : 'Tell me what you would like help with.')} aria-label="Start"><Icon name="arrow" /></button></div>
            <div className="command-hint"><span>TRY SOMETHING SIMPLE</span><button onClick={() => setQuery('Help me find a photo on my computer')}>Find a photo</button><i>·</i><button onClick={() => setQuery('Help me save a webpage')}>Save a webpage</button><i>·</i><button onClick={() => setQuery('Help me organise my files')}>Organise files</button></div>
          </section>
          <section className="home-section activity-section"><div className="section-heading"><div><div className="section-kicker">PICK UP WHERE YOU LEFT OFF</div><h2>Things we're doing</h2></div><button className="text-link" onClick={() => go('Active Sessions')}>View all <Icon name="arrow" /></button></div>
            <div className="home-task-grid">{localTasks.slice(0,2).map((task,i) => <article className="task-card" key={task.title}><div className="task-top"><span className="app-chip">{task.app === 'File Explorer' ? '▰' : '◉'} <small>{task.app}</small></span><StatusPill status={task.status}/></div><h3>{task.title}</h3><p>{task.detail}</p><div className="progress-track"><span style={{width: task.progress + '%'}} /></div><div className="task-foot"><span>{task.progress}% complete</span><button onClick={() => go('Active Sessions')}>Continue <Icon name="arrow"/></button></div></article>)}</div>
          </section>
          <section className="home-lower">
            <div className="home-section explore-block"><div className="section-heading compact"><div><div className="section-kicker">A FEW PLACES TO START</div><h2>Explore possibilities</h2></div><button className="circle-arrow" onClick={() => go('Explore possibilities')} aria-label="Explore possibilities"><Icon name="arrow"/></button></div><p className="section-intro">Not sure what to ask? Tell me what you're trying to do, and we'll take it from there.</p><div className="suggestion-list">{suggestions.slice(0,3).map(s => <button className="suggestion-row" key={s.title} onClick={() => {setQuery(s.title); go('Explore possibilities')}}><span className="suggestion-icon">{s.icon}</span><span><strong>{s.title}</strong><small>{s.desc}</small></span><Icon name="chevron"/></button>)}</div><button className="subtle-link" onClick={() => go('Explore possibilities')}>Explore all possibilities <Icon name="arrow"/></button></div>
            <div className="home-section computer-block"><div className="section-heading compact"><div><div className="section-kicker">WHAT'S AVAILABLE HERE</div><h2>Your computer</h2></div><button className="circle-arrow" onClick={() => go('Your computer')} aria-label="Your computer"><Icon name="arrow"/></button></div><p className="section-intro">TRACE can help with the apps and places available on this device.</p><div className="mini-apps">{apps.slice(0,3).map(a => <div className="mini-app" key={a.name}><span className={'app-icon '+a.tone}>{a.symbol}</span><span><strong>{a.name}</strong><small>{a.state}</small></span><span className="ready-dot"/></div>)}</div><button className="subtle-link" onClick={() => go('Your computer')}>See your installed apps <Icon name="arrow"/></button></div>
            <div className="guidance-card"><div className="guidance-orbit orbit-one"/><div className="guidance-orbit orbit-two"/><div className="guidance-spark">✳</div><div className="guidance-copy"><span>MADE TO MOVE AT YOUR PACE</span><h2>Your goals.<br/><em>Our guidance.</em></h2><p>No jargon. No rush. Just a little help, one step at a time.</p></div><div className="guidance-foot"><span>TRACE</span><span>HERE WHEN YOU NEED IT</span></div></div>
          </section>
        </div>}
        {page === 'Active Sessions' && <div className="content-page"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/> YOUR OPEN TASKS</div><h1>Things we're<br/><em>doing.</em></h1><p>Pick up where you left off, or take a moment to see what's happening.</p></div><div className="toolbar"><div className="search-field"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a task..." /></div><div className="filter-pills">{['All','In progress','Paused','Needs attention'].map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><div className="session-list">{filteredTasks.filter(t=>t.status!=='Completed').map(task=>{const index=localTasks.findIndex(x=>x.title===task.title);return <article className="session-card" key={task.title}><div className="session-main"><div className="session-app-icon">{task.app==='File Explorer'?'▰':'◉'}</div><div className="session-copy"><div className="session-meta"><span>{task.app}</span><i>·</i><span>{task.time}</span></div><h3>{task.title}</h3><p>{task.step}</p></div><StatusPill status={task.status}/></div><div className="session-progress"><div className="progress-track"><span style={{width:task.progress+'%'}}/></div><span>{task.progress}%</span></div><div className="session-actions"><button className="quiet-button" onClick={()=>setExpandedTask(expandedTask===index?null:index)}>{expandedTask===index?'Hide details':'View details'}</button><span className="action-spacer"/>{task.status==='Paused'?<button className="primary-button small" onClick={()=>updateTask(index,'In progress')}><Icon name="play"/> Resume</button>:<button className="quiet-button" onClick={()=>updateTask(index,'Paused')}><Icon name="pause"/> Pause</button>}<button className="quiet-button" onClick={()=>notify('Stopping a session will be available when task execution is connected.')}>Stop</button></div>{expandedTask===index&&<div className="session-detail"><strong>What TRACE is doing</strong><p>{task.detail}. TRACE checks each step before moving on. You remain in control throughout.</p></div>}</article>})}{filteredTasks.length===0&&<div className="empty-state"><span>⌕</span><h3>Nothing here just yet</h3><p>Try another search or choose a different filter.</p></div>}</div></div>}
        {page === 'Explore possibilities' && <div className="content-page explore-page"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/> START WITH WHAT YOU WANT TO DO</div><h1>Explore<br/><em>possibilities.</em></h1><p>You don't need to know the name of an app or how something works. Just tell TRACE what you're trying to do.</p></div><div className="discovery-search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What would you like help with?"/><button onClick={()=>notify(query.trim()?'We can shape this into a guided task next.':'Describe what you have in mind.')}>Continue <Icon name="arrow"/></button></div><div className="section-kicker spaced">SOME WAYS I CAN HELP</div><div className="possibility-grid">{suggestions.filter(s=>(s.title+s.desc).toLowerCase().includes(query.toLowerCase())||!query).map(s=><button className="possibility-card" key={s.title} onClick={()=>setQuery(s.title)}><span className="possibility-icon">{s.icon}</span><span className="possibility-arrow"><Icon name="arrow"/></span><h3>{s.title}</h3><p>{s.desc}</p></button>)}</div><div className="not-listed"><div className="not-listed-mark">✳</div><div><strong>Something else in mind?</strong><p>It doesn't have to be on this page. Describe it in your own words and we'll work out whether TRACE can help.</p></div><button className="text-link" onClick={()=>document.querySelector<HTMLInputElement>('.discovery-search input')?.focus()}>Tell me what you need <Icon name="arrow"/></button></div><div className="honesty-note"><span className="privacy-dot"/><p>TRACE will tell you honestly when it can't guide something reliably yet. You won't be left guessing.</p></div></div>}
        {page === 'Your computer' && <div className="content-page computer-page"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/> YOUR DEVICE, AT A GLANCE</div><h1>Your<br/><em>computer.</em></h1><p>These are some of the applications on this device. What TRACE can help with depends on the app and what you're trying to do.</p></div><div className="computer-summary"><div><span className="summary-number">{apps.length}</span><span className="summary-label">Applications shown</span></div><div><span className="summary-number">3</span><span className="summary-label">Ready for guidance</span></div><div><span className="summary-number">2</span><span className="summary-label">Partial support</span></div><div className="summary-note"><span className="privacy-dot"/><span>App discovery is local to this device.</span></div></div><div className="computer-toolbar"><div className="search-field"><Icon name="search"/><input value={appQuery} onChange={e=>setAppQuery(e.target.value)} placeholder="Search your applications..."/></div><button className="outline-button" onClick={()=>notify('Application discovery refresh will be connected to the local desktop service.')}>↻ Refresh list</button></div><div className="app-list">{apps.filter(a=>(a.name+a.detail).toLowerCase().includes(appQuery.toLowerCase())).map(a=><div className="app-row" key={a.name}><span className={'app-icon large '+a.tone}>{a.symbol}</span><div className="app-row-copy"><strong>{a.name}</strong><small>{a.detail}</small></div><span className={'support-state '+(a.state==='Ready'?'supported':a.state==='Partial support'?'partial':'unsupported')}><i/>{a.state}</span><button className="quiet-button" onClick={()=>notify(a.state==='Not supported yet'?'TRACE cannot reliably guide this application yet.':'Guidance for this application can be started from a task.')}>Learn more <Icon name="arrow"/></button></div>)}</div><div className="computer-footnote">Don't see an application? <button onClick={()=>notify('You can request an application for future support.')}>Let TRACE know <Icon name="arrow"/></button></div></div>}
        {page === 'Your activity' && <div className="content-page activity-page"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/> A LOOK BACK</div><h1>Your<br/><em>activity.</em></h1><p>Tasks you've worked through with TRACE, all in one place.</p></div><div className="toolbar"><div className="search-field"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your activity..."/></div><div className="filter-pills">{['All','Completed','In progress','Paused'].map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><div className="activity-timeline">{localTasks.filter(t=>(filter==='All'||t.status===filter)&&(t.title+t.app).toLowerCase().includes(query.toLowerCase())).map((task,i)=><div className="timeline-row" key={task.title}><div className="timeline-date">{i===0?'TODAY':'YESTERDAY'}</div><div className="timeline-marker"/><article className="timeline-card"><div className="timeline-top"><span>{task.app}</span><StatusPill status={task.status}/></div><h3>{task.title}</h3><p>{task.detail}</p><button className="subtle-link" onClick={()=>notify('This activity record is stored locally in this prototype.')}>View details <Icon name="arrow"/></button></article></div>)}</div></div>}
        {page === 'Preferences' && <div className="content-page preferences-page"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/> MAKE TRACE FEEL RIGHT</div><h1>Your<br/><em>preferences.</em></h1><p>A few choices to make your experience feel comfortable. You can change these whenever you like.</p></div><div className="preferences-layout"><nav className="preferences-nav">{['General','Accessibility','Voice & sound','Privacy','Applications'].map(t=><button className={preferenceTab===t?'selected':''} onClick={()=>setPreferenceTab(t)} key={t}>{t}<Icon name="chevron"/></button>)}</nav><div className="preferences-content"><div className="preferences-heading"><span className="section-kicker">PREFERENCES</span><h2>{preferenceTab}</h2><p>These settings are saved on this device.</p></div>{(preferenceTab==='General'?[['Start TRACE when I sign in','Open TRACE when you start your computer.'],['Remember where I left off','Return to your recent activity when you open TRACE.'],['Show helpful suggestions','Offer ideas when you are not sure where to begin.']]:preferenceTab==='Accessibility'?[['Larger text','Make words and controls easier to read.'],['Reduce motion','Use fewer animations and transitions.'],['High contrast','Make important controls and text easier to distinguish.']]:preferenceTab==='Voice & sound'?[['Speak instructions aloud','TRACE can read guidance out loud when voice is available.'],['Sound cues','Use gentle sounds for important moments.']]:preferenceTab==='Privacy'?[['Keep activity on this device','Your activity stays in local storage.'],['Ask before guiding an application','Confirm before TRACE starts guiding you in an app.']]:[['Discover installed applications','Allow TRACE to check which applications are installed.'],['Show partially supported apps','Include apps where guidance may be limited.']]).map(([heading,desc],i)=><div className="preference-row" key={heading}><div><strong>{heading}</strong><p>{desc}</p></div><button className={'toggle '+(i===0?'on':'')} onClick={e=>e.currentTarget.classList.toggle('on')} aria-label={'Toggle '+heading}><span/></button></div>)}<div className="preferences-note"><span className="privacy-dot"/><p>Some options will become active as TRACE's local guidance features are built. Nothing here connects to a hosted AI service.</p></div></div></div></div>}
      </div>
    </main>
    {toast&&<div className="toast"><span className="toast-dot"/> {toast}</div>}
  </div>
}
export default App
