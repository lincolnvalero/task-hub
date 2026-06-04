const API          = window.location.origin
const TOKEN_KEY    = 'taskhub_token'
const USER_KEY     = 'taskhub_user'
const LIST_PAGE_SZ = 20

const STATUS_LABELS = {
  BACKLOG: 'Backlog', A_FAZER: 'A fazer',
  EM_ANDAMENTO: 'Em andamento', REVISAO: 'Revisão', CONCLUIDO: 'Concluído',
}
const STATUS_ORDER = ['BACKLOG','A_FAZER','EM_ANDAMENTO','REVISAO','CONCLUIDO']
// Backlog foi removido da UI — tarefas legadas em BACKLOG aparecem como "A fazer"
const UI_STATUS_ORDER = ['A_FAZER','EM_ANDAMENTO','REVISAO','CONCLUIDO']

const PRIORITY_LABELS = { BAIXA:'Baixa', MEDIA:'Média', ALTA:'Alta', URGENTE:'Urgente' }
const PRIORITY_ORDER  = { URGENTE:0, ALTA:1, MEDIA:2, BAIXA:3 }

const CANAL_LABELS = {
  INSTAGRAM:'Instagram', YOUTUBE:'YouTube', TIKTOK:'TikTok',
  LINKEDIN:'LinkedIn', WHATSAPP:'WhatsApp', SITE:'Site',
  EMAIL:'E-mail', EVENTO:'Evento', APRESENTACAO:'Apresentação', OUTRO:'Outro',
}
const CANAL_COLORS = {
  INSTAGRAM:'#E1306C', YOUTUBE:'#FF4444', TIKTOK:'#69C9D0',
  LINKEDIN:'#0077B5', WHATSAPP:'#25D366', SITE:'#6366f1',
  EMAIL:'#f59e0b', EVENTO:'#a78bfa', APRESENTACAO:'#06b6d4', OUTRO:'#6b7280',
}

const VALID_TRANSITIONS = {
  BACKLOG:      ['A_FAZER'],
  A_FAZER:      ['EM_ANDAMENTO','BACKLOG'],
  EM_ANDAMENTO: ['REVISAO','A_FAZER'],
  REVISAO:      ['CONCLUIDO','EM_ANDAMENTO'],
  CONCLUIDO:    ['EM_ANDAMENTO'],
}

const STATUS_STYLE = {
  BACKLOG:      { bg:'rgba(107,114,128,0.18)', color:'#9ca3af' },
  A_FAZER:      { bg:'rgba(99,102,241,0.15)',  color:'#818cf8' },
  EM_ANDAMENTO: { bg:'rgba(139,92,246,0.18)',  color:'#a78bfa' },
  REVISAO:      { bg:'rgba(245,158,11,0.18)',  color:'#fbbf24' },
  CONCLUIDO:    { bg:'rgba(34,197,94,0.18)',   color:'#4ade80' },
}

const state = {
  token:        localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  user:         JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null'),
  allTasks:     [],
  teams:        [],
  users:        [],
  campaigns:    [],
  currentTaskId: null,
  filters:      { status:'', priority:'', teamId:'', canal:'', userId:'', campaignId:'', deadline:'', dateFrom:'', dateTo:'' },
  listSort:     { key:'data_fim_planejado', dir:'asc' },
  listPage:     1,
  listView:     'kanban',
  charts:       { status:null, teams:null, canal:null, workload:null },
  searchTO:     null,
  dragTaskId:   null,
  _dashMetrics: null,
}

/* ── DOM helpers ──────────────────────────────────────────────── */
const $  = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
function getInitials(name) {
  return String(name ?? '?').trim().split(/\s+/).slice(0,2).map(w=>w[0].toUpperCase()).join('')
}
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444']
function getAvatarColor(name) {
  let h = 0
  for (let i = 0; i < (name||'').length; i++) h = (h*31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function toDateInput(iso) { return iso ? iso.slice(0,10) : '' }
function relativeTime(iso) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m/60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h/24)
  return d < 30 ? `há ${d}d` : new Date(iso).toLocaleDateString('pt-BR')
}
function deadlineChip(iso) {
  if (!iso) return '<span class="deadline-chip">—</span>'
  const target = new Date(iso)
  const today  = new Date(); today.setHours(0,0,0,0); target.setHours(0,0,0,0)
  const diff   = Math.round((target - today) / 86400000)
  const label  = new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
  if (diff < 0)  return `<span class="deadline-chip overdue">⚠ ${label}</span>`
  if (diff === 0) return `<span class="deadline-chip today">⏰ hoje</span>`
  if (diff <= 3)  return `<span class="deadline-chip soon">${label}</span>`
  return `<span class="deadline-chip">${label}</span>`
}
function priorityChip(p) {
  return `<span class="card-priority-chip chip-${p}">${PRIORITY_LABELS[p]||p}</span>`
}
function statusBadge(s) {
  return `<span class="status-badge sb-${s}">${STATUS_LABELS[s]||s}</span>`
}
function canalChip(c) {
  if (!c) return ''
  const color = CANAL_COLORS[c] || '#6b7280'
  const label = CANAL_LABELS[c] || c
  return `<span class="canal-badge" style="--canal-color:${color};--canal-bg:${color}22">${label}</span>`
}

/* ── Theme & layout prefs ──────────────────────────────────────── */
const THEME_KEY   = 'taskhub_theme'
const SIDEBAR_KEY = 'taskhub_sidebar'
function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')   // creme é o padrão
}
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  localStorage.setItem(THEME_KEY, next)
  // re-render dashboard charts com as novas cores do tema
  if (state._dashMetrics && !$('#dashboardView')?.hidden) renderDashboard(state._dashMetrics)
}
function applySidebarPref() {
  if (localStorage.getItem(SIDEBAR_KEY) === 'collapsed') $('#sidebar')?.classList.add('collapsed')
}
function toggleSidebarCollapse() {
  const sb = $('#sidebar'); if (!sb) return
  sb.classList.toggle('collapsed')
  localStorage.setItem(SIDEBAR_KEY, sb.classList.contains('collapsed') ? 'collapsed' : 'expanded')
}
// Cores dos gráficos lidas dos tokens CSS (theme-aware)
function chartColors() {
  const cs = getComputedStyle(document.documentElement)
  return {
    text:  cs.getPropertyValue('--text').trim()       || '#2A2724',
    muted: cs.getPropertyValue('--text-muted').trim()  || '#6B6359',
    grid:  cs.getPropertyValue('--border').trim()      || '#E7E0D4',
  }
}
// Aplica o tema imediatamente (evita flash)
applyTheme(localStorage.getItem(THEME_KEY) || 'light')

/* ── API ───────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const headers = {
    ...(state.token ? { Authorization:`Bearer ${state.token}` } : {}),
    ...(opts.headers || {}),
  }
  if (opts.body) headers['Content-Type'] = 'application/json'
  const res  = await fetch(API + path, { ...opts, headers })
  const text = await res.text()
  const body = text ? (() => { try { return JSON.parse(text) } catch { return null } })() : null
  if (res.status === 401) { clearSession(); showLogin(); throw new Error('Sessão expirada.') }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error || body?.message || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return body
}

/* ── Toast ─────────────────────────────────────────────────────── */
function toast(msg, type = 'info', onClick = null) {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  if (onClick) {
    el.style.cursor = 'pointer'
    el.title = 'Clique para abrir'
    el.addEventListener('click', () => { onClick(); el.remove() }, { once: true })
  }
  $('#toastContainer').appendChild(el)
  setTimeout(() => {
    el.classList.add('toast-out')
    el.addEventListener('animationend', () => el.remove(), { once: true })
  }, onClick ? 7000 : 4000) // toasts clicáveis ficam mais tempo
}

/* ── Confirm dialog ────────────────────────────────────────────── */
function confirmDialog(msg) {
  return new Promise(resolve => {
    const dlg = $('#confirmDialog')
    $('#confirmMsg').textContent = msg
    dlg.showModal()
    function done(val) { dlg.close(); resolve(val) }
    $('#confirmOk').addEventListener('click',     () => done(true),  { once:true })
    $('#confirmCancel').addEventListener('click', () => done(false), { once:true })
    dlg.addEventListener('cancel', () => resolve(false), { once:true })
  })
}
/* promptInputDialog — styled replacement for native window.prompt()
   Returns the trimmed text the user typed, or null if cancelled. */
function promptInputDialog(msg, placeholder) {
  return new Promise(resolve => {
    const dlg = $('#promptDialog')
    $('#promptMsg').textContent = msg
    const inp = $('#promptInput')
    inp.value = ''
    inp.placeholder = placeholder || 'Opcional…'
    dlg.showModal()
    requestAnimationFrame(() => inp.focus())
    function done(val) { dlg.close(); resolve(val) }
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(inp.value.trim() || null) }
    }, { once: true })
    $('#promptOk').addEventListener('click',     () => done(inp.value.trim() || null), { once:true })
    $('#promptCancel').addEventListener('click', () => done(null),                     { once:true })
    dlg.addEventListener('cancel', () => resolve(null), { once:true })
  })
}

/* ── Session ───────────────────────────────────────────────────── */
function saveSession(token, user, remember = true) {
  state.token = token; state.user = user
  const store = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage
  store.setItem(TOKEN_KEY, token)
  store.setItem(USER_KEY, JSON.stringify(user))
  other.removeItem(TOKEN_KEY); other.removeItem(USER_KEY)
}
function clearSession() {
  state.token = null; state.user = null
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY)
}
function isAdmin() { return state.user?.role === 'ADMIN' || state.user?.role === 'MANAGER' }

/* ── Login / app shell toggle ──────────────────────────────────── */
function showLogin() {
  $('#loginScreen').hidden = false
  $('#appShell').hidden    = true
}
function showApp() {
  $('#loginScreen').hidden = true
  $('#appShell').hidden    = false
  const u = state.user
  const av = $('#sidebarAvatar')
  av.textContent        = getInitials(u.nome)
  av.style.background   = getAvatarColor(u.nome)
  $('#sidebarName').textContent = u.nome
  $('#sidebarRole').textContent = u.role
  $$('.admin-only').forEach(el => { el.hidden = !isAdmin() })
  $('[data-view="dashboard"]').hidden = !isAdmin()
  const banner = $('#guestBanner')
  if (banner) banner.hidden = u.role !== 'GUEST'
  applySidebarPref()
  startNotifPolling()
  navigate(isAdmin() ? 'dashboard' : 'tasks')
}

/* ── Navigation ────────────────────────────────────────────────── */
function navigate(view) {
  $$('.view').forEach(v => v.hidden = true)
  const el = $(`#${view}View`)
  if (el) el.hidden = false
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view))
  // Sync mobile bottom nav active state
  $$('.mbn-item[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view))
  if (view === 'dashboard') loadDashboard()
  if (view === 'tasks')     loadTasks()
  if (view === 'teams')     loadTeams()
  if (view === 'users')     loadUsers()
  if (view === 'briefings') loadBriefings()
  if (view === 'campaigns') loadCampaigns()
  if (view === 'calendar')  loadCalendar()
  if (view === 'agenda')    loadAgenda()
  if (view === 'reunioes')  loadReunioes()
}

/* ── Auth events ───────────────────────────────────────────────── */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault()
  $('#loginError').hidden = true
  try {
    const data = await api('/auth/login', {
      method:'POST',
      body: JSON.stringify({ email:$('#email').value.trim(), senha:$('#senha').value }),
    })
    saveSession(data.token, data.user, $('#rememberMe')?.checked ?? true); showApp()
  } catch (err) {
    $('#loginError').textContent = err.message
    $('#loginError').hidden = false
  }
})
$('#guestBtn').addEventListener('click', async () => {
  $('#loginError').hidden = true
  try {
    const data = await api('/auth/guest', { method:'POST' })
    saveSession(data.token, data.user, false); showApp()
  } catch (err) {
    $('#loginError').textContent = err.message
    $('#loginError').hidden = false
  }
})
$('#logoutBtn').addEventListener('click', () => { clearSession(); showLogin() })

/* ── Mostrar/ocultar senha (ícone de olho) ─────────────────────── */
$$('.pw-toggle').forEach(btn => btn.addEventListener('click', () => {
  const inp = $(btn.dataset.target)
  if (!inp) return
  const show = inp.type === 'password'
  inp.type = show ? 'text' : 'password'
  btn.classList.toggle('showing', show)
}))

/* ── Sidebar nav ───────────────────────────────────────────────── */
$$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)))
$('#sidebarToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'))
$('#sidebarCollapseBtn')?.addEventListener('click', toggleSidebarCollapse)
$('#themeToggle')?.addEventListener('click', toggleTheme)
document.addEventListener('click', e => {
  const sb = $('#sidebar')
  if (sb && sb.classList.contains('open') && !sb.contains(e.target) && e.target !== $('#sidebarToggle'))
    sb.classList.remove('open')
})

/* ── Dashboard ─────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const [board, metrics] = await Promise.all([
      api('/tasks/kanban'),
      api('/dashboard/metrics'),
    ])
    state.allTasks    = Object.values(board).flat()
    state._dashMetrics = metrics
    renderDashboard(metrics)
  } catch (err) { toast(err.message, 'error') }
}
$('#refreshDashBtn').addEventListener('click', loadDashboard)
document.addEventListener('DOMContentLoaded', () => {
  const dp = $('#dashPeriod')
  if (dp) dp.addEventListener('change', () => { if (state._dashMetrics) renderDashboard(state._dashMetrics) })
})

function getDashPeriodTasks() {
  const period = $('#dashPeriod')?.value || 'all'
  if (period === 'all') return state.allTasks
  const now = new Date(), cutoff = new Date(now)
  if (period === '30d')  cutoff.setDate(now.getDate() - 30)
  else if (period === '90d')  cutoff.setDate(now.getDate() - 90)
  else if (period === 'year') { cutoff.setMonth(0); cutoff.setDate(1); cutoff.setHours(0,0,0,0) }
  return state.allTasks.filter(t => !t.created_at || new Date(t.created_at) >= cutoff)
}

function renderDashboard(metrics) {
  const tasks = getDashPeriodTasks()
  renderKpiCards(tasks, metrics)
  renderChartStatus(tasks)
  renderChartCanal(tasks)
  renderChartTeams(tasks)
  renderChartWorkload(tasks)
  renderUpcoming()
}

function renderKpiCards(tasks, metrics) {
  const r = metrics?.resumo || {}
  const done     = tasks.filter(t => t.status === 'CONCLUIDO').length
  const active   = tasks.filter(t => t.status !== 'CONCLUIDO').length
  const now = new Date(); now.setHours(0,0,0,0)
  const overdue  = tasks.filter(t => t.status !== 'CONCLUIDO' && t.data_fim_planejado && new Date(t.data_fim_planejado) < now).length
  const total    = tasks.length
  const efficiency = total > 0 ? Math.round((done / total) * 100) : 0
  $('#kpiGrid').innerHTML = [
    { label:'Tarefas no período',  value: total,        cls:'primary' },
    { label:'Ativas',              value: active,       cls:'' },
    { label:'Concluídas',          value: done,         cls:'success' },
    { label:'Atrasadas',           value: overdue,      cls: overdue > 0 ? 'danger' : '' },
    { label:'Eficiência',          value: efficiency+'%', cls: efficiency >= 70 ? 'success' : efficiency >= 40 ? '' : 'danger' },
    { label:'Pend. candidatura',   value: r.candidaturas_pendentes ?? 0, cls:'' },
  ].map(k => `
    <div class="kpi-card ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>`).join('')
}

function renderChartStatus(tasks) {
  const ctx = $('#chartStatus')
  if (!ctx) return
  if (state.charts.status) { state.charts.status.destroy(); state.charts.status = null }
  const COLORS = { BACKLOG:'#6b7280', A_FAZER:'#6366f1', EM_ANDAMENTO:'#8b5cf6', REVISAO:'#f59e0b', CONCLUIDO:'#22c55e' }
  const counts = {}
  STATUS_ORDER.forEach(s => { counts[s] = tasks.filter(t => t.status === s).length })
  const labels = STATUS_ORDER.filter(s => counts[s] > 0)
  if (!labels.length) return
  const C = chartColors()
  state.charts.status = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: labels.map(s => STATUS_LABELS[s]),
      datasets:[{ data: labels.map(s => counts[s]), backgroundColor: labels.map(s => COLORS[s]||'#6366f1'), borderWidth:0, hoverOffset:8 }],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ color:C.text, padding:12, font:{family:'Inter',size:11} } } },
    },
  })
}

function renderChartCanal(tasks) {
  const ctx = $('#chartCanal')
  if (!ctx) return
  if (state.charts.canal) { state.charts.canal.destroy(); state.charts.canal = null }
  const counts = {}
  tasks.forEach(t => { if (t.canal) counts[t.canal] = (counts[t.canal]||0) + 1 })
  const labels = Object.keys(counts).sort((a,b) => counts[b] - counts[a])
  if (!labels.length) {
    ctx.parentElement.innerHTML = '<p class="muted" style="text-align:center;padding:2rem 0">Sem dados de canal ainda.</p>'
    return
  }
  const C = chartColors()
  state.charts.canal = new Chart(ctx, {
    type:'bar',
    data:{
      labels: labels.map(c => CANAL_LABELS[c]||c),
      datasets:[{
        data: labels.map(c => counts[c]),
        backgroundColor: labels.map(c => CANAL_COLORS[c]||'#6b7280'),
        borderRadius:6, borderSkipped:false,
      }],
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{ color:C.grid }, ticks:{ color:C.muted, font:{family:'Inter'} } },
        y:{ grid:{ display:false }, ticks:{ color:C.text, font:{family:'Inter'} } },
      },
    },
  })
}

function renderChartTeams(tasks) {
  const ctx = $('#chartTeams')
  if (!ctx) return
  if (state.charts.teams) { state.charts.teams.destroy(); state.charts.teams = null }
  const counts = {}
  tasks.forEach(t => {
    ;(t.assignments||[]).forEach(a => {
      const name = a.team?.nome || a.team_id
      counts[name] = (counts[name]||0) + 1
    })
  })
  const labels = Object.keys(counts).sort((a,b) => counts[b] - counts[a])
  if (!labels.length) return
  const C = chartColors()
  state.charts.teams = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[{ data: labels.map(l => counts[l]), backgroundColor:'#6366f1', borderRadius:6, borderSkipped:false }],
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{ color:C.grid }, ticks:{ color:C.muted, font:{family:'Inter'} } },
        y:{ grid:{ display:false }, ticks:{ color:C.text, font:{family:'Inter'} } },
      },
    },
  })
}

function renderChartWorkload(tasks) {
  const ctx = $('#chartWorkload')
  if (!ctx) return
  if (state.charts.workload) { state.charts.workload.destroy(); state.charts.workload = null }
  const counts = {}
  tasks.filter(t => t.status !== 'CONCLUIDO').forEach(t => {
    ;(t.assignments||[]).forEach(a => {
      const name = a.user?.nome || a.user_id
      counts[name] = (counts[name]||0) + 1
    })
  })
  const labels = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0,10)
  if (!labels.length) return
  const C = chartColors()
  state.charts.workload = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[{ data: labels.map(l => counts[l]), backgroundColor: labels.map(l => counts[l] >= 5 ? '#ef4444' : '#8b5cf6'), borderRadius:6, borderSkipped:false }],
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{ color:C.grid }, ticks:{ color:C.muted, font:{family:'Inter'}, stepSize:1 } },
        y:{ grid:{ display:false }, ticks:{ color:C.text, font:{family:'Inter'} } },
      },
    },
  })
}

function renderUpcoming() {
  const list = $('#upcomingList')
  const soon = state.allTasks
    .filter(t => t.data_fim_planejado && t.status !== 'CONCLUIDO')
    .sort((a,b) => new Date(a.data_fim_planejado) - new Date(b.data_fim_planejado))
    .slice(0,5)
  if (!soon.length) { list.innerHTML = '<p class="muted">Nenhuma tarefa com prazo próximo.</p>'; return }
  list.innerHTML = soon.map(t => `
    <div class="upcoming-item" data-id="${t.id}">
      ${priorityChip(t.prioridade)}
      ${t.canal ? canalChip(t.canal) : ''}
      <span class="upcoming-title">${escapeHtml(t.titulo)}</span>
      <span class="upcoming-meta">${deadlineChip(t.data_fim_planejado)}</span>
    </div>`).join('')
  $$('.upcoming-item').forEach(el => el.addEventListener('click', () => { navigate('tasks'); openPanel(el.dataset.id) }))
}

/* ── Tasks: load + filter ──────────────────────────────────────── */
async function loadTasks() {
  try {
    const promises = [api('/tasks/kanban')]
    if (!state.teams.length) promises.push(api('/teams').then(t => { state.teams = Array.isArray(t) ? t : [] }))
    if (!state.users.length) promises.push(api('/users').then(u => { state.users = Array.isArray(u) ? u : [] }))
    if (!state.campaigns.length) promises.push(api('/campaigns').then(c => { state.campaigns = Array.isArray(c) ? c : [] }).catch(() => {}))
    const [board] = await Promise.all(promises)
    state.allTasks = board ? Object.values(board).flat() : []
    applyFiltersAndRender()
    populateTeamFilter()
    populateUserFilter()
    populateCampaignFilter()
  } catch (err) { toast(err.message, 'error') }
}
function getFilteredTasks() {
  let t = state.allTasks
  const { status, priority, teamId, canal, userId, campaignId, deadline, dateFrom, dateTo } = state.filters
  if (status)   t = t.filter(x => x.status === status)
  if (priority) t = t.filter(x => x.prioridade === priority)
  if (teamId)   t = t.filter(x => (x.assignments||[]).some(a => a.team_id === teamId))
  if (canal)    t = t.filter(x => x.canal === canal)
  if (userId)   t = t.filter(x => (x.assignments||[]).some(a => a.user_id === userId))
  if (campaignId) t = t.filter(x => x.campaign_id === campaignId)
  if (dateFrom) {
    const from = new Date(dateFrom); from.setHours(0,0,0,0)
    t = t.filter(x => x.data_fim_planejado && new Date(x.data_fim_planejado) >= from)
  }
  if (dateTo) {
    const to = new Date(dateTo); to.setHours(23,59,59,999)
    t = t.filter(x => x.data_fim_planejado && new Date(x.data_fim_planejado) <= to)
  }
  if (deadline) {
    const now = new Date(); now.setHours(0,0,0,0)
    if (deadline === 'today') {
      t = t.filter(x => x.status !== 'CONCLUIDO' && x.data_fim_planejado && (() => {
        const d = new Date(x.data_fim_planejado); d.setHours(0,0,0,0); return +d === +now
      })())
    } else if (deadline === 'week') {
      const wk = new Date(now); wk.setDate(now.getDate() + 7)
      t = t.filter(x => x.status !== 'CONCLUIDO' && x.data_fim_planejado &&
        new Date(x.data_fim_planejado) >= now && new Date(x.data_fim_planejado) <= wk)
    } else if (deadline === 'overdue') {
      t = t.filter(x => x.status !== 'CONCLUIDO' && x.data_fim_planejado && new Date(x.data_fim_planejado) < now)
    }
  }
  return t
}
function applyFiltersAndRender() {
  if      (state.listView === 'list')     renderListView()
  else if (state.listView === 'gallery')  renderGalleryView()
  else if (state.listView === 'timeline') renderTimelineView()
  else                                    renderKanban()
}
function populateTeamFilter() {
  const sel = $('#filterTeam')
  const cur = sel.value
  sel.innerHTML = '<option value="">Equipe</option>' +
    state.teams.map(t => `<option value="${t.id}"${t.id===cur?' selected':''}>${escapeHtml(t.nome)}</option>`).join('')
}
function populateUserFilter() {
  const sel = $('#filterUser')
  if (!sel) return
  const cur = sel.value
  sel.innerHTML = '<option value="">Responsável</option>' +
    state.users.filter(u => u.role !== 'GUEST')
      .map(u => `<option value="${u.id}"${u.id===cur?' selected':''}>${escapeHtml(u.nome)}</option>`).join('')
}
function populateCampaignFilter() {
  const sel = $('#filterCampaign')
  if (!sel) return
  const cur = state.filters.campaignId
  sel.innerHTML = '<option value="">Campanha</option>' +
    (state.campaigns || []).map(c => `<option value="${c.id}"${c.id===cur?' selected':''}>${escapeHtml(c.nome)}</option>`).join('')
}

/* ── Kanban render ─────────────────────────────────────────────── */
// Backlog e "A fazer" são mescladas em uma única coluna (drop → A_FAZER)
const KANBAN_COLUMNS = [
  { label:'A fazer',      statuses:['BACKLOG','A_FAZER'], dropStatus:'A_FAZER' },
  { label:'Em andamento', statuses:['EM_ANDAMENTO'],      dropStatus:'EM_ANDAMENTO' },
  { label:'Revisão',      statuses:['REVISAO'],           dropStatus:'REVISAO' },
  { label:'Concluído',    statuses:['CONCLUIDO'],         dropStatus:'CONCLUIDO' },
]
function renderKanban() {
  const board = $('#kanbanBoard')
  const filtered = getFilteredTasks()
  const byStatus = Object.fromEntries(STATUS_ORDER.map(s => [s,[]]))
  filtered.forEach(t => { if (byStatus[t.status]) byStatus[t.status].push(t) })
  board.innerHTML = ''
  for (const column of KANBAN_COLUMNS) {
    const tasks = column.statuses.flatMap(s => byStatus[s])
    const col = document.createElement('div')
    col.className = 'kanban-col'
    col.dataset.status = column.dropStatus
    col.innerHTML = `
      <div class="col-header">
        <span class="col-title">${column.label}</span>
        <span class="col-count">${tasks.length}</span>
      </div>
      <div class="col-body"></div>`
    const body = col.querySelector('.col-body')
    if (tasks.length === 0) {
      const hasFilters = Object.values(state.filters).some(v => v)
      body.innerHTML = `<div class="col-empty">${hasFilters ? 'Sem resultados' : 'Sem tarefas'}</div>`
    } else {
      tasks.forEach(t => body.appendChild(buildCard(t)))
    }
    if (isAdmin()) setupDropZone(col)
    board.appendChild(col)
  }
}
const BUTLER_ACTIONS = {
  BACKLOG:      [{ next:'A_FAZER',      label:'→ A fazer' }],
  A_FAZER:      [{ next:'EM_ANDAMENTO', label:'→ Em andamento' }],
  EM_ANDAMENTO: [{ next:'REVISAO',      label:'→ Revisão' }],
  REVISAO:      [{ next:'CONCLUIDO',    label:'✓ Concluir' }, { next:'EM_ANDAMENTO', label:'↩ Devolver' }],
  CONCLUIDO:    [{ next:'EM_ANDAMENTO', label:'↩ Reabrir' }],
}
function buildButlerButtons(status) {
  return (BUTLER_ACTIONS[status]||[]).map(a =>
    `<button class="butler-btn${a.next==='CONCLUIDO'?' advance':''}" data-next="${a.next}">${a.label}</button>`
  ).join('')
}
function horaPublicacaoAlert(hora) {
  if (!hora) return ''
  const now = new Date()
  const [h, m] = hora.split(':').map(Number)
  const target = new Date(); target.setHours(h, m, 0, 0)
  const diffMin = Math.round((target - now) / 60000)
  if (diffMin >= 0 && diffMin <= 120) {
    return `<div class="hora-alert">⏰ Publica às ${hora} (${diffMin}min)</div>`
  }
  return ''
}

function buildCard(task) {
  const card = document.createElement('div')
  card.className = 'task-card'
  card.dataset.id       = task.id
  card.dataset.priority = task.prioridade
  card.draggable        = isAdmin()
  // Card aging
  if (task.updated_at) {
    const daysSince = Math.floor((Date.now() - new Date(task.updated_at)) / 86400000)
    if (daysSince >= 14) card.classList.add('very-aged')
    else if (daysSince >= 7) card.classList.add('aged')
  }
  const avatars = (task.assignments||[]).filter(a=>a.user).slice(0,3).map(a => {
    const n = a.user.nome||'?'
    return `<span class="avatar-chip" style="background:${getAvatarColor(n)}" title="${escapeHtml(n)}">${getInitials(n)}</span>`
  }).join('')
  const commentN = (task.comments||[]).length
  const voteN    = (task.votes||[]).length
  const horaAlert = horaPublicacaoAlert(task.hora_publicacao)
  card.innerHTML = `
    <div class="card-title">${escapeHtml(task.titulo)}</div>
    ${task.canal ? `<div style="margin-bottom:4px">${canalChip(task.canal)}</div>` : ''}
    <div class="card-meta">
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
        ${priorityChip(task.prioridade)}
        ${commentN ? `<span style="font-size:.7rem;color:var(--text-muted)">💬 ${commentN}</span>` : ''}
        ${voteN    ? `<span class="card-vote-count">❤️ ${voteN}</span>` : ''}
      </div>
      ${deadlineChip(task.data_fim_planejado)}
    </div>
    ${horaAlert}
    ${avatars ? `<div class="card-assignees" style="margin-top:8px">${avatars}</div>` : ''}
    ${isAdmin() ? `<div class="card-butler">${buildButlerButtons(task.status)}</div>` : ''}`
  card.addEventListener('click', () => openPanel(task.id))
  if (isAdmin()) {
    card.querySelectorAll('.butler-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const newStatus = btn.dataset.next
        if (!(VALID_TRANSITIONS[task.status]||[]).includes(newStatus)) {
          toast(`Transição não permitida: ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[newStatus]}`, 'error'); return
        }
        try {
          const payload = { status: newStatus }
          if (newStatus === 'CONCLUIDO') payload.data_conclusao_efetiva = new Date().toISOString()
          await api('/tasks/'+task.id+'/status', { method:'PATCH', body:JSON.stringify(payload) })
          task.status = newStatus
          toast(`Status → ${STATUS_LABELS[newStatus]}`, 'success')
          applyFiltersAndRender()
        } catch (err) { toast(err.message, 'error') }
      })
    })
    card.addEventListener('dragstart', e => {
      state.dragTaskId = task.id
      e.dataTransfer.effectAllowed = 'move'
      card.classList.add('dragging')
    })
    card.addEventListener('dragend', () => {
      state.dragTaskId = null
      card.classList.remove('dragging')
    })
  }
  return card
}
function setupDropZone(col) {
  col.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    col.classList.add('drag-over')
  })
  col.addEventListener('dragleave', e => {
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over')
  })
  col.addEventListener('drop', async e => {
    e.preventDefault()
    col.classList.remove('drag-over')
    const newStatus = col.dataset.status
    const taskId    = state.dragTaskId
    if (!taskId || !newStatus) return
    const task = state.allTasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    if (!(VALID_TRANSITIONS[task.status]||[]).includes(newStatus)) {
      toast(`Transição ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[newStatus]} não permitida.`, 'error')
      return
    }
    try {
      const payload = { status: newStatus }
      if (newStatus === 'CONCLUIDO') payload.data_conclusao_efetiva = new Date().toISOString()
      await api('/tasks/'+taskId+'/status', { method:'PATCH', body:JSON.stringify(payload) })
      task.status = newStatus
      toast(`Status → ${STATUS_LABELS[newStatus]}`, 'success')
      applyFiltersAndRender()
    } catch (err) { toast(err.message,'error'); renderKanban() }
  })
}

/* ── List view ─────────────────────────────────────────────────── */
function renderListView() {
  const { key, dir } = state.listSort
  const sorted = [...getFilteredTasks()].sort((a,b) => {
    let va = a[key]??'', vb = b[key]??''
    if (key==='prioridade')        { va=PRIORITY_ORDER[va]??9; vb=PRIORITY_ORDER[vb]??9 }
    else if (key==='data_fim_planejado') { va=va?new Date(va).getTime():9e15; vb=vb?new Date(vb).getTime():9e15 }
    else { va=String(va).toLowerCase(); vb=String(vb).toLowerCase() }
    return (va<vb?-1:va>vb?1:0) * (dir==='asc'?1:-1)
  })
  const pages = Math.max(1, Math.ceil(sorted.length / LIST_PAGE_SZ))
  state.listPage = Math.min(state.listPage, pages)
  const page = sorted.slice((state.listPage-1)*LIST_PAGE_SZ, state.listPage*LIST_PAGE_SZ)
  const tbody = $('#taskTableBody')
  const hasFilters = Object.values(state.filters).some(v => v)
  tbody.innerHTML = page.length
    ? page.map(t => {
        const assignee = t.assignments?.find(a => a.user)
        const team     = t.assignments?.find(a => a.team)
        const createdAt = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '—'
        return `<tr data-id="${t.id}">
          <td>${escapeHtml(t.titulo)}</td>
          <td>${statusBadge(t.status)}</td>
          <td>${priorityChip(t.prioridade)}</td>
          <td>${t.canal ? canalChip(t.canal) : '—'}</td>
          <td>${escapeHtml(assignee?.user?.nome||'—')}</td>
          <td>${escapeHtml(team?.team?.nome||'—')}</td>
          <td>${deadlineChip(t.data_fim_planejado)}</td>
          <td style="font-size:.78rem;color:var(--text-muted)">${createdAt}</td>
        </tr>`
      }).join('')
    : `<tr><td colspan="8" class="muted" style="text-align:center;padding:2rem">${hasFilters ? 'Nenhuma tarefa para estes filtros.' : 'Nenhuma tarefa encontrada.'}</td></tr>`
  $$('tr[data-id]',tbody).forEach(row => row.addEventListener('click', () => openPanel(row.dataset.id)))
  $$('.sortable').forEach(th => {
    th.classList.toggle('sort-asc',  th.dataset.sort===key && dir==='asc')
    th.classList.toggle('sort-desc', th.dataset.sort===key && dir==='desc')
  })
  const pag = $('#listPagination')
  if (pages <= 1) { pag.innerHTML=''; return }
  pag.innerHTML =
    `<span style="font-size:.8rem;color:var(--text-muted)">Pág. ${state.listPage}/${pages}</span>` +
    `<button class="btn-ghost btn-sm" data-page="${state.listPage-1}" ${state.listPage===1?'disabled':''}>‹</button>` +
    `<button class="btn-ghost btn-sm" data-page="${state.listPage+1}" ${state.listPage===pages?'disabled':''}>›</button>`
  $$('[data-page]',pag).forEach(b => b.addEventListener('click', () => {
    state.listPage = +b.dataset.page; renderListView()
  }))
}

/* ── View toggle ───────────────────────────────────────────────── */
function setViewContainers(active) {
  $('#kanbanBoard').hidden     = active !== 'kanban'
  $('#listViewWrap').hidden    = active !== 'list'
  $('#galleryViewWrap').hidden = active !== 'gallery'
  $('#timelineViewWrap').hidden = active !== 'timeline'
  $$('.view-toggle-btn').forEach(b => b.classList.remove('active'))
  const btns = { kanban:'#btnViewKanban', list:'#btnViewList', gallery:'#btnViewGallery', timeline:'#btnViewTimeline' }
  if (btns[active]) $(btns[active]).classList.add('active')
}
$('#btnViewKanban').addEventListener('click', () => {
  state.listView = 'kanban'; setViewContainers('kanban'); renderKanban()
})
$('#btnViewList').addEventListener('click', () => {
  state.listView = 'list'; setViewContainers('list'); renderListView()
})
$('#btnViewGallery').addEventListener('click', () => {
  state.listView = 'gallery'; setViewContainers('gallery'); renderGalleryView()
})
$('#btnViewTimeline').addEventListener('click', () => {
  state.listView = 'timeline'; setViewContainers('timeline'); renderTimelineView()
})
$$('.sortable').forEach(th => th.addEventListener('click', () => {
  const k = th.dataset.sort
  state.listSort = state.listSort.key===k
    ? { key:k, dir: state.listSort.dir==='asc'?'desc':'asc' }
    : { key:k, dir:'asc' }
  renderListView()
}))

/* ── Filter bar ────────────────────────────────────────────────── */
$$('.status-chip').forEach(chip => chip.addEventListener('click', () => {
  $$('.status-chip').forEach(c => c.classList.remove('active'))
  chip.classList.add('active')
  state.filters.status = chip.dataset.status
  state.listPage = 1; applyFiltersAndRender(); renderActiveFilterChips()
}))
$('#filterPriority').addEventListener('change', () => {
  state.filters.priority = $('#filterPriority').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterTeam').addEventListener('change', () => {
  state.filters.teamId = $('#filterTeam').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterCanal').addEventListener('change', () => {
  state.filters.canal = $('#filterCanal').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterUser').addEventListener('change', () => {
  state.filters.userId = $('#filterUser').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterDeadline').addEventListener('change', () => {
  state.filters.deadline = $('#filterDeadline').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterCampaign').addEventListener('change', () => {
  state.filters.campaignId = $('#filterCampaign').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterDateFrom').addEventListener('change', () => {
  state.filters.dateFrom = $('#filterDateFrom').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})
$('#filterDateTo').addEventListener('change', () => {
  state.filters.dateTo = $('#filterDateTo').value; state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
})

function renderActiveFilterChips() {
  const wrap = $('#activeFilterChips')
  if (!wrap) return
  const chips = []
  const { status, priority, teamId, canal, userId, campaignId, deadline, dateFrom, dateTo } = state.filters
  if (status)   chips.push({ label:`Status: ${STATUS_LABELS[status]||status}`,        clear() { state.filters.status='';   $$('.status-chip').forEach(c=>c.classList.toggle('active',c.dataset.status==='')) } })
  if (priority) chips.push({ label:`Prioridade: ${PRIORITY_LABELS[priority]||priority}`, clear() { state.filters.priority='';  $('#filterPriority').value='' } })
  if (teamId)   { const tm=state.teams.find(t=>t.id===teamId); chips.push({ label:`Equipe: ${tm?.nome||teamId}`,       clear() { state.filters.teamId='';   $('#filterTeam').value='' } }) }
  if (canal)    chips.push({ label:`Canal: ${CANAL_LABELS[canal]||canal}`,            clear() { state.filters.canal='';    $('#filterCanal').value='' } })
  if (userId)   { const u=state.users.find(x=>x.id===userId);  chips.push({ label:`Responsável: ${u?.nome||userId}`,  clear() { state.filters.userId='';   $('#filterUser').value='' } }) }
  if (campaignId) { const c=(state.campaigns||[]).find(x=>x.id===campaignId); chips.push({ label:`Campanha: ${c?.nome||campaignId}`, clear() { state.filters.campaignId=''; $('#filterCampaign').value='' } }) }
  if (deadline) {
    const DL = { today:'Vence hoje', week:'Vence esta semana', overdue:'Vencido' }
    chips.push({ label:DL[deadline]||deadline, clear() { state.filters.deadline=''; $('#filterDeadline').value='' } })
  }
  if (dateFrom || dateTo) {
    const fmt = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
    const label = dateFrom && dateTo ? `Prazo: ${fmt(dateFrom)} – ${fmt(dateTo)}`
      : dateFrom ? `Prazo a partir de ${fmt(dateFrom)}` : `Prazo até ${fmt(dateTo)}`
    chips.push({ label, clear() { state.filters.dateFrom=''; state.filters.dateTo=''; $('#filterDateFrom').value=''; $('#filterDateTo').value='' } })
  }
  if (!chips.length) { wrap.hidden=true; wrap.innerHTML=''; return }
  wrap.hidden = false
  wrap.innerHTML =
    chips.map((c,i) => `<span class="active-filter-chip" data-afc="${i}">${escapeHtml(c.label)} <button class="afc-remove" title="Remover">×</button></span>`).join('') +
    `<button class="afc-clear-all">Limpar todos</button>`
  chips.forEach((c,i) => {
    wrap.querySelector(`[data-afc="${i}"] .afc-remove`).addEventListener('click', () => {
      c.clear(); state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
    })
  })
  wrap.querySelector('.afc-clear-all').addEventListener('click', () => {
    state.filters = { status:'', priority:'', teamId:'', canal:'', userId:'', campaignId:'', deadline:'', dateFrom:'', dateTo:'' }
    $$('.status-chip').forEach(c=>c.classList.toggle('active',c.dataset.status===''))
    ;['#filterPriority','#filterTeam','#filterCanal','#filterUser','#filterCampaign','#filterDeadline','#filterDateFrom','#filterDateTo'].forEach(s => { const el=$(s); if(el) el.value='' })
    state.listPage=1; applyFiltersAndRender(); renderActiveFilterChips()
  })
}

/* ── Task detail panel ─────────────────────────────────────────── */
async function openPanel(taskId) {
  state.currentTaskId = taskId
  try {
    const task = await api('/tasks/' + taskId)
    populatePanel(task)
    $('#taskDetailOverlay').hidden = false
    document.body.style.overflow  = 'hidden'
  } catch (err) { toast(err.message,'error') }
}
function closePanel() {
  $('#taskDetailOverlay').hidden = true
  document.body.style.overflow  = ''
  state.currentTaskId = null
}
function populatePanel(task) {
  const statusSel = $('#panelStatus')
  // Backlog removido da UI: tarefa legada em BACKLOG é exibida como "A fazer"
  const uiStatus = task.status === 'BACKLOG' ? 'A_FAZER' : task.status
  statusSel.innerHTML = UI_STATUS_ORDER.map(k =>
    `<option value="${k}"${uiStatus===k?' selected':''}>${STATUS_LABELS[k]}</option>`).join('')
  const ss = STATUS_STYLE[uiStatus]||{}
  Object.assign(statusSel.style, { background:ss.bg||'', color:ss.color||'', borderColor:ss.color||'' })

  const titleEl = $('#panelTitle')
  titleEl.textContent    = task.titulo
  titleEl.contentEditable = isAdmin() ? 'plaintext-only' : 'false'

  $('#panelPriority').value       = task.prioridade || 'MEDIA'
  $('#panelCanal').value          = task.canal || ''
  $('#panelTipo').value           = task.tipo_tarefa || ''
  $('#panelStartDate').value      = toDateInput(task.data_inicio_planejado)
  $('#panelDueDate').value        = toDateInput(task.data_fim_planejado)
  $('#panelSolicitante').value    = task.solicitante || ''
  $('#panelDescricao').value      = task.descricao || ''
  $('#panelHoraPublicacao').value = task.hora_publicacao || ''
  $('#panelProductionDays').value = task.production_days || ''
  $('#panelLocal').value          = task.local || ''
  $('#panelLat').value            = task.lat != null ? task.lat : ''
  $('#panelLng').value            = task.lng != null ? task.lng : ''
  $('#panelRoteiro').value        = task.roteiro || ''
  $('#roteiroRevisions').hidden   = true
  $('#roteiroMeta').textContent   = task.roteiro ? `atualizado ${relativeTime(task.updated_at)}` : ''

  // Custom link fields with open buttons
  const gdriveVal   = task.link_gdrive   || ''
  const frameioVal  = task.link_frameio  || ''
  $('#panelGdrive').value   = gdriveVal
  $('#panelFrameio').value  = frameioVal
  const gdriveOpen  = $('#panelGdriveOpen')
  const frameioOpen = $('#panelFrameioOpen')
  if (gdriveVal)  { gdriveOpen.href  = gdriveVal;  gdriveOpen.hidden  = false }
  else            { gdriveOpen.hidden  = true }
  if (frameioVal) { frameioOpen.href = frameioVal; frameioOpen.hidden = false }
  else            { frameioOpen.hidden = true }

  const editable = isAdmin()
  ;['#panelPriority','#panelCanal','#panelTipo','#panelStartDate','#panelDueDate',
    '#panelSolicitante','#panelDescricao','#panelHoraPublicacao','#panelProductionDays',
    '#panelLocal','#panelLat','#panelLng',
    '#panelGdrive','#panelFrameio','#panelRoteiro']
    .forEach(sel => { const el = $(sel); if (el) el.disabled = !editable })
  $('#panelDeleteBtn').hidden = !editable
  const addWrap = $('#checklistAddWrap')
  if (addWrap) addWrap.hidden = !editable

  const assignees = (task.assignments||[]).filter(a=>a.user)
  $('#panelAssignees').innerHTML = assignees.length
    ? assignees.map(a => {
        const n = a.user.nome||'?'
        return `<span class="assignee-chip">
          <span class="a-avatar" style="background:${getAvatarColor(n)}">${getInitials(n)}</span>
          ${escapeHtml(n)}
        </span>`
      }).join('')
    : '<span class="no-assignees">Sem responsáveis</span>'

  renderChecklist(task.checklist || [], editable)
  renderVoteBtn(task.votes || [])
  renderComments(task.comments||[])
  renderPanelCampaign(task)
  renderApprovals(task.approvals || [])
  // o botão "adicionar peça" é só para a equipe (admin); aprovar/ajustes vale p/ todos
  const aw = $('#approvalAddWrap'); if (aw) aw.hidden = !editable
}
async function renderPanelCampaign(task) {
  const sel = $('#panelCampaign')
  if (!sel) return
  if (!Array.isArray(state.campaigns) || !state.campaigns.length) {
    try { const c = await api('/campaigns'); state.campaigns = Array.isArray(c) ? c : [] } catch { state.campaigns = state.campaigns || [] }
  }
  populateCampaignSelect('#panelCampaign', task.campaign_id || '')
  sel.disabled = !isAdmin()
  // Assets compartilhados da campanha (somente leitura no painel da tarefa)
  const assets = task.campaign?.link_assets || []
  const wrap = $('#panelCampaignAssets')
  const list = $('#panelCampaignAssetList')
  if (wrap && list) {
    if (task.campaign_id && assets.length) {
      wrap.hidden = false
      list.innerHTML = assets.map(a => `<div class="cdp-asset-row">
        <span class="cdp-asset-name">${escapeHtml(a.nome)}</span>
        <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.url)}</a>
      </div>`).join('')
    } else { wrap.hidden = true; list.innerHTML = '' }
  }
}
$('#panelCampaign')?.addEventListener('change', async () => {
  if (!isAdmin() || !state.currentTaskId) return
  const val = $('#panelCampaign').value || null
  await patchCurrentTask({ campaign_id: val })
  // recarrega a tarefa p/ refletir assets compartilhados da nova campanha
  try { const task = await api('/tasks/'+state.currentTaskId); renderPanelCampaign(task) } catch {}
})
function renderComments(comments) {
  const count = comments.length
  $('#commentCount').textContent = count||''
  $('#panelComments').innerHTML = count
    ? comments.map(c => {
        const n = c.user?.nome||'Usuário'
        return `<div class="comment-item">
          <span class="c-avatar" style="background:${getAvatarColor(n)}">${getInitials(n)}</span>
          <div class="comment-body">
            <div class="comment-meta"><strong>${escapeHtml(n)}</strong> · ${relativeTime(c.created_at)}</div>
            <div class="comment-text">${escapeHtml(c.texto)}</div>
          </div>
        </div>`}).join('')
    : '<p class="no-comments">Nenhum comentário ainda.</p>'
}
async function patchCurrentTask(data) {
  if (!state.currentTaskId) return
  try {
    await api('/tasks/'+state.currentTaskId, { method:'PATCH', body:JSON.stringify(data) })
    const idx = state.allTasks.findIndex(t => t.id === state.currentTaskId)
    if (idx !== -1) Object.assign(state.allTasks[idx], data)
    toast('Salvo.','success')
  } catch (err) { toast(err.message,'error') }
}

/* Panel field auto-save (admin only) */
$('#panelTitle').addEventListener('blur', () => {
  if (!isAdmin()) return
  const titulo = $('#panelTitle').textContent.trim()
  if (titulo && titulo.length >= 3) patchCurrentTask({ titulo })
})
$('#panelPriority').addEventListener('change', () => {
  if (!isAdmin()) return
  patchCurrentTask({ prioridade: $('#panelPriority').value })
})
$('#panelStatus').addEventListener('change', async () => {
  const newStatus = $('#panelStatus').value
  const task = state.allTasks.find(t => t.id === state.currentTaskId)
  if (!task || task.status === newStatus) return
  if (!(VALID_TRANSITIONS[task.status]||[]).includes(newStatus)) {
    toast(`Transição ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[newStatus]} não permitida.`,'error')
    $('#panelStatus').value = task.status; return
  }
  try {
    const payload = { status: newStatus }
    if (newStatus === 'CONCLUIDO') payload.data_conclusao_efetiva = new Date().toISOString()
    await api('/tasks/'+state.currentTaskId+'/status',{ method:'PATCH', body:JSON.stringify(payload) })
    task.status = newStatus
    const ss = STATUS_STYLE[newStatus]||{}
    Object.assign($('#panelStatus').style, { background:ss.bg||'', color:ss.color||'', borderColor:ss.color||'' })
    toast(`Status → ${STATUS_LABELS[newStatus]}`,'success')
    applyFiltersAndRender()
  } catch (err) {
    toast(err.message,'error')
    const task2 = state.allTasks.find(t => t.id === state.currentTaskId)
    if (task2) $('#panelStatus').value = task2.status
  }
})
$('#panelCanal').addEventListener('change', () => {
  if (isAdmin()) patchCurrentTask({ canal: $('#panelCanal').value || undefined })
})
;[['#panelTipo','tipo_tarefa'],['#panelSolicitante','solicitante']].forEach(([sel,key]) => {
  $(sel).addEventListener('blur', () => { if (isAdmin()) patchCurrentTask({ [key]: $(sel).value.trim()||undefined }) })
})
$('#panelLocal')?.addEventListener('blur', () => {
  if (isAdmin()) patchCurrentTask({ local: $('#panelLocal').value.trim() || null })
})
;['#panelLat','#panelLng'].forEach(sel => {
  $(sel)?.addEventListener('blur', () => {
    if (!isAdmin()) return
    const key = sel === '#panelLat' ? 'lat' : 'lng'
    const val = parseFloat($(sel).value)
    patchCurrentTask({ [key]: isNaN(val) ? null : val })
  })
})
;[['#panelStartDate','data_inicio_planejado'],['#panelDueDate','data_fim_planejado']].forEach(([sel,key]) => {
  $(sel).addEventListener('change', () => { if (isAdmin()) patchCurrentTask({ [key]: $(sel).value||undefined }) })
})
$('#panelDescricao').addEventListener('blur', () => {
  if (isAdmin()) patchCurrentTask({ descricao: $('#panelDescricao').value.trim()||undefined })
})
// Roteiro colaborativo — autosave (debounce) + on blur
let _roteiroTO = null
function saveRoteiro() {
  if (!isAdmin() || !state.currentTaskId) return
  const val = $('#panelRoteiro').value
  patchCurrentTask({ roteiro: val || null })
  $('#roteiroMeta').textContent = `salvo ${relativeTime(new Date().toISOString())}`
}
$('#panelRoteiro')?.addEventListener('input', () => {
  clearTimeout(_roteiroTO)
  _roteiroTO = setTimeout(saveRoteiro, 1500)
})
$('#panelRoteiro')?.addEventListener('blur', () => { clearTimeout(_roteiroTO); saveRoteiro() })
$('#roteiroHistoryBtn')?.addEventListener('click', async () => {
  const box = $('#roteiroRevisions')
  if (!box) return
  if (!box.hidden) { box.hidden = true; return }
  box.hidden = false
  box.innerHTML = '<div class="app-loader"></div>'
  try {
    const revs = await api('/tasks/'+state.currentTaskId+'/roteiro/revisions')
    if (!revs.length) { box.innerHTML = '<p class="muted" style="font-size:.8rem">Sem revisões ainda.</p>'; return }
    box.innerHTML = revs.map(r => {
      const autor = r.autor?.nome || 'Alguém'
      return `<div class="roteiro-rev">
        <div class="roteiro-rev-meta"><strong>${escapeHtml(autor)}</strong> · ${relativeTime(r.created_at)}</div>
        <div class="roteiro-rev-content">${escapeHtml(r.conteudo)}</div>
        ${isAdmin() ? `<button class="btn-ghost btn-sm roteiro-rev-restore" data-restore="${r.id}">Restaurar</button>` : ''}
      </div>`
    }).join('')
    $$('[data-restore]', box).forEach(btn => btn.addEventListener('click', () => {
      const rev = revs.find(x => x.id === btn.dataset.restore)
      if (rev) { $('#panelRoteiro').value = rev.conteudo; saveRoteiro(); toast('Roteiro restaurado.','success') }
    }))
  } catch (err) { box.innerHTML = `<p class="muted" style="font-size:.8rem">${escapeHtml(err.message)}</p>` }
})
$('#panelHoraPublicacao').addEventListener('blur', () => {
  if (isAdmin()) patchCurrentTask({ hora_publicacao: $('#panelHoraPublicacao').value.trim()||null })
})
$('#panelProductionDays').addEventListener('blur', () => {
  if (!isAdmin()) return
  const days = parseInt($('#panelProductionDays').value)
  patchCurrentTask({ production_days: isNaN(days) ? null : days })
})
$('#panelGdrive').addEventListener('blur', () => {
  if (!isAdmin()) return
  const val = $('#panelGdrive').value.trim()
  patchCurrentTask({ link_gdrive: val || null })
  const btn = $('#panelGdriveOpen')
  if (btn) { if (val) { btn.href = val; btn.hidden = false } else btn.hidden = true }
})
$('#panelFrameio').addEventListener('blur', () => {
  if (!isAdmin()) return
  const val = $('#panelFrameio').value.trim()
  patchCurrentTask({ link_frameio: val || null })
  const btn = $('#panelFrameioOpen')
  if (btn) { if (val) { btn.href = val; btn.hidden = false } else btn.hidden = true }
})

/* Panel close + delete */
$('#closePanelBtn').addEventListener('click', closePanel)
$('#panelBackdrop').addEventListener('click', closePanel)
$('#panelDeleteBtn').addEventListener('click', async () => {
  if (!await confirmDialog('Excluir esta tarefa? Esta ação é irreversível.')) return
  try {
    await api('/tasks/'+state.currentTaskId, { method:'DELETE' })
    state.allTasks = state.allTasks.filter(t => t.id !== state.currentTaskId)
    closePanel(); applyFiltersAndRender()
    toast('Tarefa excluída.','success')
  } catch (err) { toast(err.message,'error') }
})

/* Comment send */
async function sendComment() {
  const input = $('#commentInput')
  const texto = input.value.trim()
  if (!texto) return
  try {
    await api('/tasks/'+state.currentTaskId+'/comments',{ method:'POST', body:JSON.stringify({ texto }) })
    input.value = ''
    const task = await api('/tasks/'+state.currentTaskId)
    renderComments(task.comments||[])
  } catch (err) { toast(err.message,'error') }
}
$('#sendCommentBtn').addEventListener('click', sendComment)
$('#commentInput').addEventListener('keydown', e => { if (e.key==='Enter' && e.ctrlKey) { e.preventDefault(); sendComment() } })

/* ── Chip picker (multi-seleção com busca/validação) ───────────── */
function makeChipPicker({ inputId, dropdownId, chipsId, single = false }) {
  const input = $('#'+inputId), dd = $('#'+dropdownId), chipsEl = $('#'+chipsId)
  if (!input || !dd || !chipsEl) return { setOptions(){}, reset(){}, getIds(){ return [] }, addById(){} }
  let selected = []      // [{id,label,sub}]
  let opts = []          // [{id,label,sub}]
  function renderChips() {
    chipsEl.innerHTML = selected.map(s =>
      `<span class="picker-chip" data-id="${s.id}">${escapeHtml(s.label)} <button type="button" class="picker-chip-x" data-rm="${s.id}" title="Remover">×</button></span>`
    ).join('')
    $$('[data-rm]', chipsEl).forEach(b => b.addEventListener('click', () => {
      selected = selected.filter(x => x.id !== b.dataset.rm); renderChips()
    }))
  }
  function showDropdown() {
    const q = input.value.trim().toLowerCase()
    const selIds = new Set(selected.map(s => s.id))
    const matches = opts.filter(o => !selIds.has(o.id) &&
      (!q || o.label.toLowerCase().includes(q) || (o.sub||'').toLowerCase().includes(q))).slice(0, 8)
    if (!matches.length) {
      dd.innerHTML = '<div class="picker-empty">Nenhum item disponível.</div>'
      dd.hidden = false; return
    }
    dd.innerHTML = matches.map(o =>
      `<div class="picker-opt" data-id="${o.id}">${escapeHtml(o.label)}${o.sub?`<span class="picker-opt-sub">${escapeHtml(o.sub)}</span>`:''}</div>`
    ).join('')
    $$('.picker-opt', dd).forEach(el => el.addEventListener('mousedown', e => {
      e.preventDefault()
      const o = opts.find(x => x.id === el.dataset.id)
      if (o) {
        if (single) { selected = [o] }
        else if (!selected.some(s => s.id === o.id)) { selected.push(o) }
        renderChips()
      }
      input.value = ''; dd.hidden = true; input.focus()
      if (!single) showDropdown()
    }))
    dd.hidden = false
  }
  input.addEventListener('focus', showDropdown)
  input.addEventListener('input', showDropdown)
  input.addEventListener('blur', () => setTimeout(() => { dd.hidden = true }, 150))
  return {
    setOptions(o) { opts = o || [] },
    reset() { selected = []; renderChips(); input.value = ''; dd.hidden = true },
    getIds() { return selected.map(s => s.id) },
    addById(id) {
      const o = opts.find(x => x.id === id)
      if (o) {
        if (single) { selected = [o] }
        else if (!selected.some(s => s.id === id)) { selected.push(o) }
        renderChips()
      }
    },
  }
}
const teamPicker = makeChipPicker({ inputId:'teamPickerInput', dropdownId:'teamPickerDropdown', chipsId:'teamChips', single: true })
const userPicker = makeChipPicker({ inputId:'userPickerInput', dropdownId:'userPickerDropdown', chipsId:'userChips' })

/* ── New task dialog ───────────────────────────────────────────── */
$('#newTaskBtn').addEventListener('click', async () => {
  $('#taskFormError').hidden = true
  $('#tTitulo').value=''; $('#tDescricao').value=''; $('#tPrioridade').value='MEDIA'; $('#tCanal').value=''; $('#tPrazo').value=''
  try {
    if (!Array.isArray(state.teams) || !state.teams.length) {
      const t = await api('/teams');     state.teams = Array.isArray(t) ? t : []
    }
    if (!Array.isArray(state.users) || !state.users.length) {
      const u = await api('/users');     state.users = Array.isArray(u) ? u : []
    }
    if (!Array.isArray(state.campaigns) || !state.campaigns.length) {
      try { const c = await api('/campaigns'); state.campaigns = Array.isArray(c) ? c : [] } catch { state.campaigns = state.campaigns || [] }
    }
  } catch (err) { toast(err.message,'error'); return }
  if (!state.teams.length) { toast('Crie ao menos uma equipe primeiro.','error'); navigate('teams'); return }
  teamPicker.setOptions(state.teams.map(t => ({ id:t.id, label:t.nome })))
  userPicker.setOptions(state.users.filter(u=>u.role!=='GUEST').map(u => ({ id:u.id, label:u.nome, sub:u.email })))
  teamPicker.reset(); userPicker.reset()
  populateCampaignSelect('#tCampaign', '')
  $('#taskDialog').showModal()
})
$('#cancelTaskBtn').addEventListener('click', () => $('#taskDialog').close())
function calcAutoDeadline() {
  const start = $('#tStartDate').value
  const days  = parseInt($('#tProductionDays').value)
  if (start && days > 0) {
    const d = new Date(start); d.setDate(d.getDate() + days)
    $('#tPrazo').value = d.toISOString().slice(0,10)
  }
}
$('#tStartDate').addEventListener('change', calcAutoDeadline)
$('#tProductionDays').addEventListener('input', calcAutoDeadline)
$('#taskForm').addEventListener('submit', async e => {
  e.preventDefault()
  const _prodDays = parseInt($('#tProductionDays').value)
  const teamIds = teamPicker.getIds()
  if (!teamIds.length) {
    $('#taskFormError').textContent = 'Selecione ao menos uma equipe.'
    $('#taskFormError').hidden = false
    return
  }
  const body = {
    titulo:               $('#tTitulo').value.trim(),
    descricao:            $('#tDescricao').value.trim()||undefined,
    prioridade:           $('#tPrioridade').value,
    canal:                $('#tCanal').value||undefined,
    data_inicio_planejado: $('#tStartDate').value||undefined,
    data_fim_planejado:   $('#tPrazo').value||undefined,
    production_days:      isNaN(_prodDays) ? undefined : _prodDays,
    campaign_id:          $('#tCampaign').value || undefined,
    team_ids:             teamIds,
    user_ids:             userPicker.getIds(),
  }
  try {
    await api('/tasks',{ method:'POST', body:JSON.stringify(body) })
    $('#taskDialog').close()
    toast('Tarefa criada!','success')
    await loadTasks()
  } catch (err) {
    $('#taskFormError').textContent = err.message
    $('#taskFormError').hidden = false
  }
})

/* ── Teams ─────────────────────────────────────────────────────── */
const TEAM_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#06b6d4','#f43f5e']
function getTeamColor(name) {
  let h = 0
  for (let i = 0; i < (name||'').length; i++) h = (h*31 + name.charCodeAt(i)) >>> 0
  return TEAM_COLORS[h % TEAM_COLORS.length]
}
function getTeamTaskStats(teamId) {
  const now = new Date(); now.setHours(0,0,0,0)
  const tasks = state.allTasks.filter(t =>
    (t.assignments||[]).some(a => a.team_id === teamId)
  )
  const active  = tasks.filter(t => t.status !== 'CONCLUIDO').length
  const overdue = tasks.filter(t =>
    t.status !== 'CONCLUIDO' && t.data_fim_planejado && new Date(t.data_fim_planejado) < now
  ).length
  const done    = tasks.filter(t => t.status === 'CONCLUIDO').length
  return { total: tasks.length, active, overdue, done }
}

async function loadTeams() {
  const grid = $('#teamGrid')
  grid.innerHTML = '<p class="muted">Carregando…</p>'
  try {
    const [teams] = await Promise.all([
      api('/teams'),
      state.allTasks.length
        ? Promise.resolve()
        : api('/tasks/kanban').then(b => { state.allTasks = Object.values(b).flat() }),
    ])
    state.teams = teams
    renderTeamGrid(state.teams)
    setupTeamSearch()
  } catch (err) { grid.innerHTML = `<p class="muted">${err.message}</p>` }
}

function renderTeamGrid(teams) {
  const grid = $('#teamGrid')
  if (!teams.length) {
    grid.innerHTML = '<div class="empty-state">Nenhuma equipe. Clique em <strong>+ Nova equipe</strong> para começar.</div>'
    return
  }
  grid.innerHTML = teams.map(t => {
    const color   = getTeamColor(t.nome)
    const members = (t.collaborators||[])
    const visible = members.slice(0,4)
    const overflow = members.length - visible.length
    const stats   = getTeamTaskStats(t.id)
    const avatarsHtml = visible.map(m => {
      const n = (m.user||{}).nome || '?'
      return `<span class="tc-avatar" style="background:${getAvatarColor(n)}" title="${escapeHtml(n)}">${getInitials(n)}</span>`
    }).join('') + (overflow > 0 ? `<span class="tc-avatar tc-avatar-overflow">+${overflow}</span>` : '')
    return `<div class="team-card" data-team-id="${t.id}" style="--tc-color:${color}">
      <div class="tc-header">
        <div class="tc-name">${escapeHtml(t.nome)}</div>
        <div class="tc-color-dot"></div>
      </div>
      <div class="tc-stats">
        <div class="tc-stat">
          <div class="tc-stat-value">${stats.active}</div>
          <div class="tc-stat-label">Ativas</div>
        </div>
        <div class="tc-stat ${stats.overdue > 0 ? 'danger' : ''}">
          <div class="tc-stat-value">${stats.overdue}</div>
          <div class="tc-stat-label">Vencidas</div>
        </div>
        <div class="tc-stat success">
          <div class="tc-stat-value">${stats.done}</div>
          <div class="tc-stat-label">Concluídas</div>
        </div>
      </div>
      <div class="tc-footer">
        <div class="tc-avatars">${avatarsHtml || '<span style="font-size:.75rem;color:var(--text-dim)">Sem membros</span>'}</div>
        <span class="tc-member-count">${members.length} membro${members.length===1?'':'s'}</span>
      </div>
    </div>`
  }).join('')
  $$('.team-card').forEach(card =>
    card.addEventListener('click', () => openTeamPanel(card.dataset.teamId))
  )
}

function setupTeamSearch() {
  const input = $('#teamSearch')
  if (!input) return
  input.oninput = () => {
    const q = input.value.trim().toLowerCase()
    renderTeamGrid(q ? state.teams.filter(t => t.nome.toLowerCase().includes(q)) : state.teams)
  }
}

let currentTeamId = null
async function openTeamPanel(teamId) {
  currentTeamId = teamId
  const team = state.teams.find(t => t.id === teamId)
  if (!team) return
  const color = getTeamColor(team.nome)
  $('#tdpColorDot').style.background = color
  const nameEl = $('#tdpName')
  nameEl.textContent = team.nome
  nameEl.contentEditable = isAdmin() ? 'plaintext-only' : 'false'
  // Stats row
  const stats = getTeamTaskStats(teamId)
  $('#tdpStats').innerHTML = [
    { val: stats.active,  lbl: 'Ativas',    cls: '' },
    { val: stats.overdue, lbl: 'Vencidas',   cls: stats.overdue > 0 ? 'danger' : '' },
    { val: stats.done,    lbl: 'Concluídas', cls: 'success' },
    { val: stats.total,   lbl: 'Total',      cls: '' },
  ].map(s => `<div class="tdp-stat-item ${s.cls}">
    <div class="tdp-stat-val">${s.val}</div>
    <div class="tdp-stat-lbl">${s.lbl}</div>
  </div>`).join('')
  // Ensure users loaded
  if (!state.users.length) state.users = await api('/users')
  renderTeamPanelMembers(team)
  renderTeamPanelTasks(teamId)
  setupMemberSearch(teamId, team)
  $('#tdpDeleteBtn').hidden = !isAdmin()
  $('#teamDetailOverlay').hidden = false
  document.body.style.overflow = 'hidden'
}

function closeTeamPanel() {
  $('#teamDetailOverlay').hidden = true
  document.body.style.overflow  = ''
  currentTeamId = null
}

function renderTeamPanelMembers(team) {
  const members = (team.collaborators || [])
  $('#tdpMemberCount').textContent = members.length || ''
  const wrap = $('#tdpMemberList')
  if (!members.length) {
    wrap.innerHTML = '<p class="muted" style="font-size:.8rem">Nenhum membro ainda.</p>'
    return
  }
  wrap.innerHTML = members.map(m => {
    const u = m.user || {}
    const n = u.nome || '?'
    return `<div class="tdp-member-row" data-user-id="${m.user_id}">
      <span class="tc-avatar" style="background:${getAvatarColor(n)};width:28px;height:28px;font-size:.65rem;flex-shrink:0">${getInitials(n)}</span>
      <span class="tdp-member-name">${escapeHtml(n)}</span>
      <span class="tdp-member-role">${escapeHtml(u.cargo||u.role||'')}</span>
      ${isAdmin() ? `<button class="tdp-remove-btn" data-remove="${m.user_id}" title="Remover membro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>` : ''}
    </div>`
  }).join('')
  if (isAdmin()) {
    $$('[data-remove]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      const uid = btn.dataset.remove
      try {
        await api('/teams/'+currentTeamId+'/collaborators/'+uid, { method:'DELETE' })
        const t = state.teams.find(x => x.id === currentTeamId)
        if (t) t.collaborators = (t.collaborators||[]).filter(c => c.user_id !== uid)
        renderTeamPanelMembers(t)
        renderTeamGrid(state.teams)
        toast('Membro removido.', 'success')
      } catch (err) { toast(err.message, 'error') }
    }))
  }
}

function renderTeamPanelTasks(teamId) {
  const tasks = state.allTasks.filter(t =>
    (t.assignments||[]).some(a => a.team_id === teamId)
  )
  $('#tdpTaskCount').textContent = tasks.length || ''
  const wrap = $('#tdpTaskList')
  if (!tasks.length) {
    wrap.innerHTML = '<p class="muted" style="font-size:.8rem">Nenhuma tarefa vinculada.</p>'
    return
  }
  wrap.innerHTML = tasks.slice(0,10).map(t =>
    `<div class="tdp-task-row" data-id="${t.id}">
      ${priorityChip(t.prioridade)}
      <span class="tdp-task-title" title="${escapeHtml(t.titulo)}">${escapeHtml(t.titulo)}</span>
      ${statusBadge(t.status)}
    </div>`
  ).join('')
  $$('.tdp-task-row', wrap).forEach(row => row.addEventListener('click', () => {
    closeTeamPanel(); navigate('tasks'); openPanel(row.dataset.id)
  }))
}

function setupMemberSearch(teamId, team) {
  if (!isAdmin()) { $('#tdpMemberSearch').hidden = true; return }
  $('#tdpMemberSearch').hidden = false
  const input    = $('#tdpMemberInput')
  const dropdown = $('#tdpMemberDropdown')
  input.value    = ''
  dropdown.hidden = true
  const memberIds = new Set((team.collaborators||[]).map(c => c.user_id))

  input.oninput = () => {
    const q = input.value.trim().toLowerCase()
    if (!q) { dropdown.hidden = true; return }
    const matches = state.users
      .filter(u => u.role !== 'GUEST' && (u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
      .slice(0,6)
    if (!matches.length) { dropdown.hidden = true; return }
    dropdown.innerHTML = matches.map(u => {
      const isMember = memberIds.has(u.id)
      return `<div class="member-dd-item ${isMember ? 'is-member' : ''}" data-uid="${u.id}">
        <span class="tc-avatar" style="background:${getAvatarColor(u.nome)};width:24px;height:24px;font-size:.58rem;flex-shrink:0">${getInitials(u.nome)}</span>
        <span>${escapeHtml(u.nome)}</span>
        <span style="color:var(--text-muted);font-size:.75rem;margin-left:auto">${isMember ? '✓ membro' : escapeHtml(u.cargo||u.role||'')}</span>
      </div>`
    }).join('')
    dropdown.hidden = false
    $$('.member-dd-item:not(.is-member)', dropdown).forEach(item => {
      item.addEventListener('click', async () => {
        dropdown.hidden = true; input.value = ''
        const uid = item.dataset.uid
        try {
          await api('/teams/'+teamId+'/collaborators', { method:'POST', body:JSON.stringify({ user_id: uid }) })
          const u = state.users.find(x => x.id === uid)
          const t = state.teams.find(x => x.id === teamId)
          if (t && u) {
            t.collaborators = [...(t.collaborators||[]), { user_id: uid, user: u }]
            memberIds.add(uid)
            renderTeamPanelMembers(t)
            renderTeamGrid(state.teams)
          }
          toast('Membro adicionado.', 'success')
        } catch (err) { toast(err.message, 'error') }
      })
    })
  }
  input.addEventListener('blur', () => { setTimeout(() => { dropdown.hidden = true }, 150) })
}

/* Panel close / rename / delete */
$('#closeTeamPanelBtn').addEventListener('click', closeTeamPanel)
$('#teamPanelBackdrop').addEventListener('click', closeTeamPanel)
$('#tdpName').addEventListener('blur', async () => {
  if (!isAdmin() || !currentTeamId) return
  const nome = $('#tdpName').textContent.trim()
  if (!nome || nome.length < 2) return
  try {
    await api('/teams/'+currentTeamId, { method:'PATCH', body:JSON.stringify({ nome }) })
    const t = state.teams.find(x => x.id === currentTeamId)
    if (t) { t.nome = nome; renderTeamGrid(state.teams) }
    toast('Nome atualizado.', 'success')
  } catch (err) { toast(err.message, 'error') }
})
$('#tdpDeleteBtn').addEventListener('click', async () => {
  if (!await confirmDialog('Excluir esta equipe? Esta ação é irreversível.')) return
  try {
    await api('/teams/'+currentTeamId, { method:'DELETE' })
    state.teams = state.teams.filter(t => t.id !== currentTeamId)
    closeTeamPanel(); renderTeamGrid(state.teams)
    toast('Equipe excluída.', 'success')
  } catch (err) { toast(err.message, 'error') }
})

$('#newTeamBtn').addEventListener('click', () => { $('#teamNome').value=''; $('#teamDialog').showModal() })
$('#cancelTeamBtn').addEventListener('click', () => $('#teamDialog').close())
$('#teamForm').addEventListener('submit', async e => {
  e.preventDefault()
  try {
    await api('/teams',{ method:'POST', body:JSON.stringify({ nome:$('#teamNome').value.trim() }) })
    $('#teamDialog').close(); toast('Equipe criada.','success'); loadTeams()
  } catch (err) { toast(err.message,'error') }
})

/* ── Users ─────────────────────────────────────────────────────── */
async function loadUsers() {
  const tbody = $('#userList')
  tbody.innerHTML = '<tr><td colspan="5" class="muted">Carregando…</td></tr>'
  try {
    state.users = await api('/users')
    if (!state.users.length) { tbody.innerHTML='<tr><td colspan="5" class="muted">Nenhum usuário.</td></tr>'; return }
    tbody.innerHTML = state.users.map(u =>
      `<tr>
        <td>${escapeHtml(u.nome)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.cargo||'—')}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td style="display:flex;gap:6px">
          <button class="btn-outline btn-sm" data-edit="${u.id}">Editar</button>
          <button class="btn-outline-danger btn-sm" data-del-user="${u.id}">Excluir</button>
        </td>
      </tr>`).join('')
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => openUserDialog(state.users.find(u=>u.id===b.dataset.edit))))
    $$('[data-del-user]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmDialog('Excluir este usuário?')) return
      try { await api('/users/'+b.dataset.delUser,{method:'DELETE'}); toast('Usuário excluído.','success'); loadUsers() }
      catch (err) { toast(err.message,'error') }
    }))
  } catch (err) { tbody.innerHTML=`<tr><td colspan="5" class="muted">${err.message}</td></tr>` }
}
function openUserDialog(user) {
  const isEdit = !!user
  $('#userDialogTitle').textContent = isEdit ? 'Editar usuário' : 'Novo usuário'
  $('#userId').value    = user?.id   ?? ''
  $('#uNome').value     = user?.nome ?? ''
  $('#uEmail').value    = user?.email ?? ''
  $('#uTelefone').value = user?.telefone ?? ''
  $('#uCargo').value    = user?.cargo ?? ''
  $('#uIgreja').value   = user?.igreja ?? ''
  $('#uRole').value     = user?.role ?? 'COLLABORATOR'
  $('#uSenhaLabel').hidden = false
  $('#uSenhaLabelText').textContent = isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial'
  $('#uSenha').required    = !isEdit
  $('#uSenha').value       = ''
  $('#uSenha').type        = 'password'
  $('#uSenhaLabel .pw-toggle')?.classList.remove('showing')
  $('#uSenha').placeholder = isEdit ? '••••••' : ''
  $('#userFormError').hidden = true
  $('#userDialog').showModal()
}
$('#newUserBtn').addEventListener('click', () => openUserDialog(null))
$('#cancelUserBtn').addEventListener('click', () => $('#userDialog').close())
$('#userForm').addEventListener('submit', async e => {
  e.preventDefault()
  const id = $('#userId').value
  const body = {
    nome:     $('#uNome').value.trim(),
    email:    $('#uEmail').value.trim(),
    telefone: $('#uTelefone').value.trim()||undefined,
    cargo:    $('#uCargo').value.trim()||undefined,
    igreja:   $('#uIgreja').value.trim()||undefined,
    role:     $('#uRole').value,
  }
  const novaSenha = $('#uSenha').value
  try {
    if (id) {
      await api('/users/'+id, { method:'PATCH', body:JSON.stringify(body) })
      // Senha opcional na edição — usa o endpoint de redefinição de senha (admin)
      if (novaSenha) {
        if (novaSenha.length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.')
        await api('/users/'+id+'/reset-password', { method:'POST', body:JSON.stringify({ nova_senha: novaSenha }) })
      }
    } else {
      body.senha = novaSenha
      await api('/users',{ method:'POST', body:JSON.stringify(body) })
    }
    $('#userDialog').close()
    toast(id ? (novaSenha ? 'Usuário e senha atualizados.' : 'Usuário atualizado.') : 'Usuário criado.','success')
    loadUsers()
  } catch (err) { $('#userFormError').textContent=err.message; $('#userFormError').hidden=false }
})

/* ── Global search ─────────────────────────────────────────────── */
$('#globalSearch').addEventListener('input', e => {
  clearTimeout(state.searchTO)
  const q = e.target.value.trim().toLowerCase()
  const dd = $('#searchDropdown')
  if (!q) { dd.hidden=true; return }
  state.searchTO = setTimeout(() => {
    const results = state.allTasks.filter(t =>
      t.titulo.toLowerCase().includes(q) || (t.descricao||'').toLowerCase().includes(q)
    ).slice(0,8)
    if (!results.length) { dd.hidden=true; return }
    dd.innerHTML = results.map(t =>
      `<div class="search-result-item" data-id="${t.id}">
        <div>
          <div class="search-result-title">${escapeHtml(t.titulo)}</div>
          <div class="search-result-meta">${STATUS_LABELS[t.status]} · ${PRIORITY_LABELS[t.prioridade]}</div>
        </div>
      </div>`).join('')
    $$('.search-result-item',dd).forEach(el => el.addEventListener('click', () => {
      dd.hidden=true; $('#globalSearch').value=''; navigate('tasks'); openPanel(el.dataset.id)
    }))
    dd.hidden = false
  }, 300)
})
document.addEventListener('click', e => {
  if (!$('.search-container')?.contains(e.target)) $('#searchDropdown').hidden = true
})

/* ── Keyboard shortcuts ────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName
  if (tag==='INPUT'||tag==='TEXTAREA'||document.activeElement?.isContentEditable) return
  if (e.key==='n' && isAdmin() && !$('#appShell').hidden) { e.preventDefault(); $('#newTaskBtn').click() }
  if (e.key==='Escape' && !$('#taskDetailOverlay').hidden) closePanel()
  if (e.key==='Escape' && !$('#teamDetailOverlay').hidden) closeTeamPanel()
  if (e.key==='Escape' && !$('#campaignDetailOverlay').hidden) closeCampaignPanel()
})

/* ── Gallery view ──────────────────────────────────────────────── */
function renderGalleryView() {
  const grid = $('#galleryGrid')
  if (!grid) return
  const tasks = getFilteredTasks()
  if (!tasks.length) {
    const hasFilters = Object.values(state.filters).some(v => v)
    grid.innerHTML = `<div class="timeline-empty">${hasFilters ? 'Nenhuma tarefa para estes filtros.' : 'Nenhuma tarefa encontrada.'}</div>`
    return
  }
  grid.innerHTML = tasks.map(t => {
    const canalColor = t.canal ? (CANAL_COLORS[t.canal] || '#6b7280') : '#6b7280'
    const voteN    = (t.votes || []).length
    const commentN = (t.comments || []).length
    const avatars  = (t.assignments || []).filter(a => a.user).slice(0, 3).map(a => {
      const n = a.user.nome || '?'
      return `<span class="avatar-chip" style="background:${getAvatarColor(n)};width:20px;height:20px;font-size:.55rem" title="${escapeHtml(n)}">${getInitials(n)}</span>`
    }).join('')
    return `<div class="gallery-card" data-id="${t.id}">
      <div class="gallery-card-top" style="background:${canalColor}22;border-color:${canalColor}44">
        ${t.canal ? `<span class="gallery-card-canal" style="color:${canalColor}">${CANAL_LABELS[t.canal]||t.canal}</span>` : '<span class="gallery-card-canal" style="color:var(--text-dim)">—</span>'}
        ${statusBadge(t.status)}
      </div>
      <div class="gallery-card-body">
        <div class="gallery-card-title" title="${escapeHtml(t.titulo)}">${escapeHtml(t.titulo)}</div>
        <div class="gallery-card-chips">
          ${priorityChip(t.prioridade)}
          ${deadlineChip(t.data_fim_planejado)}
        </div>
        ${t.descricao ? `<div class="gallery-card-meta">${escapeHtml(t.descricao.slice(0,80))}${t.descricao.length>80?'…':''}</div>` : ''}
      </div>
      <div class="gallery-card-footer">
        <div style="display:flex;gap:4px">${avatars}</div>
        <div class="gallery-vote">
          ${commentN ? `<span style="font-size:.7rem;color:var(--text-muted)">💬 ${commentN}</span>` : ''}
          ${voteN    ? `<span style="font-size:.7rem;color:var(--text-muted)">❤️ ${voteN}</span>`    : ''}
        </div>
      </div>
    </div>`
  }).join('')
  $$('.gallery-card', grid).forEach(card =>
    card.addEventListener('click', () => openPanel(card.dataset.id))
  )
}

/* ── Timeline view ─────────────────────────────────────────────── */
// Timeline zoom state: null=auto, 0=mensal(30d), 1=semanal(7d), 2=diário(1d)
const TIMELINE_ZOOM_STEPS = [30, 7, 1]
const TIMELINE_ZOOM_LABELS = ['Mensal', 'Semanal', 'Diário']
let _timelineZoomIdx = null

function renderTimelineView() {
  const wrap = $('#timelineChart')
  if (!wrap) return
  const tasks = getFilteredTasks().filter(t => t.data_inicio_planejado || t.data_fim_planejado)
  if (!tasks.length) {
    wrap.innerHTML = '<div class="timeline-empty">Nenhuma tarefa com datas planejadas para exibir na linha do tempo.</div>'
    return
  }
  const allDates = tasks.flatMap(t => [
    t.data_inicio_planejado ? new Date(t.data_inicio_planejado) : null,
    t.data_fim_planejado    ? new Date(t.data_fim_planejado)    : null,
  ]).filter(Boolean)
  let minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  let maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
  minDate.setDate(minDate.getDate() - 3)
  maxDate.setDate(maxDate.getDate() + 3)
  const totalMs = maxDate - minDate
  if (totalMs <= 0) { wrap.innerHTML = '<div class="timeline-empty">Intervalo de datas inválido.</div>'; return }
  const totalDays = Math.round(totalMs / 86400000)
  const autoCellDays = totalDays <= 30 ? 1 : totalDays <= 90 ? 7 : 30
  const cellDays = _timelineZoomIdx !== null ? TIMELINE_ZOOM_STEPS[_timelineZoomIdx] : autoCellDays

  // Atualiza botões de zoom
  const zoomInBtn  = $('#timelineZoomIn')
  const zoomOutBtn = $('#timelineZoomOut')
  const effectiveIdx = _timelineZoomIdx !== null ? _timelineZoomIdx : TIMELINE_ZOOM_STEPS.indexOf(autoCellDays)
  if (zoomInBtn)  { zoomInBtn.disabled  = effectiveIdx >= TIMELINE_ZOOM_STEPS.length - 1; zoomInBtn.title  = 'Zoom in (mais detalhe)' }
  if (zoomOutBtn) { zoomOutBtn.disabled = effectiveIdx <= 0; zoomOutBtn.title = 'Zoom out (visão geral)' }
  const headers = []
  const cur = new Date(minDate)
  while (cur <= maxDate) { headers.push(new Date(cur)); cur.setDate(cur.getDate() + cellDays) }
  const today      = new Date()
  const todayPct   = ((today - minDate) / totalMs) * 100
  const showToday  = today >= minDate && today <= maxDate
  function dateToPct(d) {
    if (!d) return null
    return Math.min(100, Math.max(0, ((new Date(d) - minDate) / totalMs) * 100))
  }
  const headerHtml = `<div class="timeline-header">
    ${headers.map(h => `<div class="timeline-header-cell">${h.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</div>`).join('')}
  </div>`
  const rowsHtml = tasks.map(t => {
    const start = t.data_inicio_planejado || t.data_fim_planejado
    const end   = t.data_fim_planejado    || t.data_inicio_planejado
    const left  = dateToPct(start)
    const right = dateToPct(end)
    const width = Math.max(0.8, right - left)
    const canalColor = t.canal ? (CANAL_COLORS[t.canal] || '#6366f1') : '#6366f1'
    return `<div class="timeline-row" data-id="${t.id}">
      <div class="timeline-label" title="${escapeHtml(t.titulo)}">${escapeHtml(t.titulo.slice(0,30))}${t.titulo.length>30?'…':''}</div>
      <div class="timeline-track">
        <div class="timeline-bar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${canalColor}cc" title="${escapeHtml(t.titulo)}">
          <span style="font-size:.65rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block;padding:0 4px">${PRIORITY_LABELS[t.prioridade]||''}</span>
        </div>
        ${showToday ? `<div class="timeline-today" style="left:${todayPct.toFixed(2)}%"></div>` : ''}
      </div>
    </div>`
  }).join('')
  wrap.innerHTML = headerHtml + rowsHtml
  $$('.timeline-row', wrap).forEach(row => row.addEventListener('click', () => openPanel(row.dataset.id)))
}
// Timeline zoom — cicla entre mensal / semanal / diário
$('#timelineZoomIn')?.addEventListener('click', () => {
  const cur = _timelineZoomIdx ?? TIMELINE_ZOOM_STEPS.indexOf(/* auto = will be recomputed */ 7)
  _timelineZoomIdx = Math.min(TIMELINE_ZOOM_STEPS.length - 1, (cur === -1 ? 1 : cur) + 1)
  renderTimelineView()
})
$('#timelineZoomOut')?.addEventListener('click', () => {
  const cur = _timelineZoomIdx ?? TIMELINE_ZOOM_STEPS.indexOf(7)
  _timelineZoomIdx = Math.max(0, (cur === -1 ? 1 : cur) - 1)
  renderTimelineView()
})

/* ── Checklist ─────────────────────────────────────────────────── */
function renderChecklist(items, editable) {
  const list    = $('#panelChecklist')
  const countEl = $('#checklistCount')
  const progWrap = $('#checklistProgressWrap')
  const progFill = $('#checklistProgressFill')
  if (!list) return
  const done  = items.filter(i => i.done).length
  const total = items.length
  if (countEl) countEl.textContent = total || ''
  if (progWrap) {
    progWrap.hidden = total === 0
    if (progFill) progFill.style.width = total > 0 ? `${Math.round((done/total)*100)}%` : '0%'
  }
  if (!total) { list.innerHTML = '<p class="muted" style="font-size:.8rem">Sem itens.</p>'; return }
  list.innerHTML = items.map(item => {
    const dl = item.deadline ? new Date(item.deadline).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : ''
    return `<div class="checklist-item ${item.done?'done':''}" data-item-id="${item.id}">
      <button class="checklist-check${item.done?' checked':''}" data-check="${item.id}" title="${item.done?'Desmarcar':'Marcar como feito'}">
        ${item.done?'✓':''}
      </button>
      <span class="checklist-text ${item.done?'done-text':''}">${escapeHtml(item.texto)}</span>
      ${dl ? `<span class="checklist-meta">📅 ${dl}</span>` : ''}
      ${editable ? `<button class="checklist-del" data-del-item="${item.id}" title="Remover">×</button>` : ''}
    </div>`
  }).join('')
  $$('.checklist-check', list).forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const itemId = btn.dataset.check
      const item   = items.find(i => i.id === itemId)
      if (item) toggleChecklistItem(itemId, !item.done)
    })
  )
  if (editable) {
    $$('.checklist-del', list).forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); deleteChecklistItem(btn.dataset.delItem) })
    )
  }
}
async function addChecklistItem() {
  const input   = $('#checklistInput')
  const dlInput = $('#checklistDeadline')
  const texto   = input?.value.trim()
  if (!texto) return
  try {
    await api('/tasks/'+state.currentTaskId+'/checklist', {
      method:'POST',
      body: JSON.stringify({ texto, deadline: dlInput?.value||undefined }),
    })
    input.value = ''; if (dlInput) dlInput.value = ''
    const task = await api('/tasks/'+state.currentTaskId)
    renderChecklist(task.checklist||[], isAdmin())
    toast('Item adicionado.','success')
  } catch (err) { toast(err.message,'error') }
}
async function toggleChecklistItem(itemId, done) {
  try {
    await api('/tasks/'+state.currentTaskId+'/checklist/'+itemId, {
      method:'PATCH', body:JSON.stringify({ done }),
    })
    const task = await api('/tasks/'+state.currentTaskId)
    renderChecklist(task.checklist||[], isAdmin())
  } catch (err) { toast(err.message,'error') }
}
async function deleteChecklistItem(itemId) {
  try {
    await api('/tasks/'+state.currentTaskId+'/checklist/'+itemId, { method:'DELETE' })
    const task = await api('/tasks/'+state.currentTaskId)
    renderChecklist(task.checklist||[], isAdmin())
    toast('Item removido.','success')
  } catch (err) { toast(err.message,'error') }
}
$('#checklistAddBtn')?.addEventListener('click', addChecklistItem)
$('#checklistInput')?.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); addChecklistItem() } })

/* ── Votes ─────────────────────────────────────────────────────── */
function renderVoteBtn(votes) {
  const btn   = $('#panelVoteBtn')
  const count = $('#panelVoteCount')
  if (!btn) return
  const userId = state.user?.id || state.user?.sub
  const voted  = votes.some(v => v.user_id === userId)
  if (count) count.textContent = votes.length
  btn.classList.toggle('voted', voted)
  btn.title = voted ? 'Remover voto' : 'Votar nesta tarefa'
}
async function toggleVote(taskId) {
  try {
    const result = await api('/tasks/'+taskId+'/votes', { method:'POST' })
    const task = await api('/tasks/'+taskId)
    renderVoteBtn(task.votes||[])
    toast(result.voted ? 'Voto registrado!' : 'Voto removido.', 'success')
  } catch (err) { toast(err.message,'error') }
}
$('#panelVoteBtn')?.addEventListener('click', () => {
  if (state.currentTaskId) toggleVote(state.currentTaskId)
})

/* ── Asset approvals ───────────────────────────────────────────── */
const APPROVAL_LABELS = { PENDENTE:'Pendente', APROVADO:'Aprovado', AJUSTES:'Ajustes solicitados' }
function renderApprovals(approvals) {
  const list = $('#panelApprovals')
  if (!list) return
  $('#approvalCount').textContent = approvals.length || ''
  if (!approvals.length) {
    list.innerHTML = '<p class="muted" style="font-size:.8rem">Nenhuma peça enviada para aprovação.</p>'
    return
  }
  list.innerHTML = approvals.map(a => {
    const isImg = isImageUrl(a.asset_url)
    const fileName = (a.asset_url.split('/').pop() || a.asset_url).split('?')[0]
    return `<div class="approval-item" data-aid="${a.id}">
      ${isImg
        ? `<img class="approval-preview" src="${escapeHtml(a.asset_url)}" alt="peça" data-open="${escapeHtml(a.asset_url)}" loading="lazy" />`
        : ''}
      <div class="approval-filerow">
        <span>${isImg ? '🖼️' : '📄'}</span>
        <a href="${escapeHtml(a.asset_url)}" target="_blank" rel="noopener">${escapeHtml(fileName)}</a>
      </div>
      <div class="approval-body">
        <div class="approval-status-row">
          <span class="approval-badge ${a.status}">${APPROVAL_LABELS[a.status]||a.status}</span>
          <div class="approval-actions">
            ${a.status !== 'APROVADO' ? `<button class="approval-act ok"  data-approve="${a.id}">✓ Aprovar</button>` : ''}
            ${a.status !== 'AJUSTES'  ? `<button class="approval-act fix" data-fix="${a.id}">↻ Pedir ajustes</button>` : ''}
          </div>
        </div>
        ${a.nota ? `<div class="approval-note">💬 ${escapeHtml(a.nota)}</div>` : ''}
      </div>
    </div>`
  }).join('')
  $$('[data-open]', list).forEach(img => img.addEventListener('click', () => window.open(img.dataset.open, '_blank', 'noopener')))
  $$('[data-approve]', list).forEach(b => b.addEventListener('click', () => decideApproval(b.dataset.approve, 'APROVADO')))
  $$('[data-fix]', list).forEach(b => b.addEventListener('click', () => decideApproval(b.dataset.fix, 'AJUSTES')))
}
async function decideApproval(approvalId, status) {
  let nota
  if (status === 'AJUSTES') {
    const result = await promptInputDialog(
      'Descreva os ajustes necessários:',
      'Ex: aumentar fonte, trocar cor do fundo… (pressione Enter para confirmar)'
    )
    if (result === null) return   // user cancelled — abort the decision
    nota = result || undefined
  }
  try {
    await api('/approvals/'+approvalId, { method:'PATCH', body: JSON.stringify({ status, nota }) })
    const task = await api('/tasks/'+state.currentTaskId)
    renderApprovals(task.approvals || [])
    toast(status === 'APROVADO' ? 'Peça aprovada!' : 'Ajustes solicitados.', 'success')
  } catch (err) { toast(err.message, 'error') }
}
$('#approvalAddBtn')?.addEventListener('click', async () => {
  const url = $('#approvalUrl')?.value.trim()
  if (!url) { toast('Cole a URL da peça.', 'error'); return }
  try {
    await api('/tasks/'+state.currentTaskId+'/approvals', { method:'POST', body: JSON.stringify({ asset_url: url }) })
    $('#approvalUrl').value = ''
    const task = await api('/tasks/'+state.currentTaskId)
    renderApprovals(task.approvals || [])
    toast('Peça enviada para aprovação.', 'success')
  } catch (err) { toast(err.message, 'error') }
})

/* ── Attachment URL ────────────────────────────────────────────── */
$('#toggleAttachBtn')?.addEventListener('click', () => {
  const wrap = $('#attachUrlWrap')
  if (wrap) { wrap.hidden = !wrap.hidden; if (!wrap.hidden) $('#attachInput')?.focus() }
})
$('#attachBtn')?.addEventListener('click', async () => {
  const url  = $('#attachInput')?.value.trim()
  const task = state.currentTaskId
  if (!url || !task) return
  try {
    await api('/tasks/'+task+'/comments', {
      method:'POST',
      body: JSON.stringify({ texto: `📎 ${url}` }),
    })
    $('#attachInput').value = ''; $('#attachUrlWrap').hidden = true
    const updated = await api('/tasks/'+task)
    renderComments(updated.comments||[])
    toast('Link anexado.','success')
  } catch (err) { toast(err.message,'error') }
})

/* ── Briefings ─────────────────────────────────────────────────── */
async function loadBriefings() {
  const list = $('#briefingsList')
  if (!list) return
  list.innerHTML = '<p class="muted">Carregando…</p>'
  try {
    const data = await api('/briefing')
    state._lastBriefings = data
    renderBriefings(data)
  } catch (err) { list.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>` }
}

/** Dialog de confirmação e vínculo de campanha ao converter um briefing */
function briefingConvertDialog(briefing) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog')
    dlg.className = 'confirm-dialog'
    const camps = state.campaigns || []
    dlg.innerHTML = `
      <div class="confirm-body">
        <p class="confirm-msg">Converter o briefing de <strong>${escapeHtml(briefing.nome || 'este solicitante')}</strong> em tarefa?</p>
        <div class="form-group" style="margin:12px 0 0">
          <label class="label" for="bfCampSel">Vincular a campanha <span style="color:var(--text-muted)">(opcional)</span></label>
          <select id="bfCampSel" class="input" style="width:100%;margin-top:4px">
            <option value="">— sem campanha —</option>
            ${camps.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="dialog-actions" style="margin-top:16px">
          <button id="bfDlgCancel" class="btn-ghost">Cancelar</button>
          <button id="bfDlgOk" class="btn-primary">✓ Converter em tarefa</button>
        </div>
      </div>`
    document.body.appendChild(dlg)
    dlg.showModal()
    function done(val) { dlg.close(); dlg.remove(); resolve(val) }
    dlg.querySelector('#bfDlgOk').addEventListener('click', () => {
      const sel = dlg.querySelector('#bfCampSel')
      done({ confirmed: true, campaign_id: sel?.value || null })
    }, { once: true })
    dlg.querySelector('#bfDlgCancel').addEventListener('click', () => done({ confirmed: false }), { once: true })
    dlg.addEventListener('cancel', () => resolve({ confirmed: false }), { once: true })
  })
}

const BF_STATUS_LABELS = { PENDENTE: 'Pendente', CONVERTIDO: 'Convertido', REJEITADO: 'Rejeitado' }

function renderBriefings(briefings) {
  const list = $('#briefingsList')
  if (!list) return
  if (!briefings.length) {
    list.innerHTML = '<p class="muted">Nenhum briefing recebido ainda. Compartilhe o link público com os solicitantes.</p>'
    return
  }
  list.innerHTML = briefings.map(b => {
    const dt = b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
    const isPendente = b.status === 'PENDENTE'
    return `<div class="briefing-item">
      <div class="briefing-item-title">${escapeHtml(b.nome)} · <span style="color:var(--text-muted);font-size:.8rem">${escapeHtml(b.email)}</span></div>
      <div class="briefing-item-meta">
        <span class="briefing-status-badge ${b.status}">${BF_STATUS_LABELS[b.status] || b.status}</span>
        <span>${escapeHtml(b.tipo)}</span>
        ${b.canal ? `<span>${escapeHtml(b.canal)}</span>` : ''}
        ${b.tipo_transmissao ? `<span class="agenda-tx-badge agenda-tx-${b.tipo_transmissao}">${TRANSMISSAO_LABELS[b.tipo_transmissao]||b.tipo_transmissao}</span>` : ''}
        ${b.data_evento ? `<span>📅 ${new Date(b.data_evento).toLocaleDateString('pt-BR')}</span>` : ''}
        <span style="color:var(--text-dim)">${dt}</span>
      </div>
      <div class="briefing-item-desc">${escapeHtml(b.descricao.slice(0,200))}${b.descricao.length>200?'…':''}</div>
      ${b.task_id ? `<div class="briefing-item-meta" style="margin-top:4px"><span style="color:var(--accent);font-size:.8rem;cursor:pointer" data-open-task="${b.task_id}">↗ Ver tarefa criada</span></div>` : ''}
      ${isPendente ? `<div class="briefing-actions">
        <button class="btn-primary btn-sm" data-bf-approve="${b.id}">✓ Converter em tarefa</button>
        <button class="btn-ghost btn-sm" data-bf-reject="${b.id}">✕ Rejeitar</button>
      </div>` : ''}
    </div>`
  }).join('')
  // Link para abrir tarefa já criada
  $$('[data-open-task]', list).forEach(span =>
    span.addEventListener('click', () => {
      navigate('tasks')
      setTimeout(() => openPanel(span.dataset.openTask), 300)
    })
  )
  $$('[data-bf-approve]', list).forEach(btn =>
    btn.addEventListener('click', () => briefingConvertDialogFull_handler(btn.dataset.bfApprove))
  )
  $$('[data-bf-reject]', list).forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!await confirmDialog('Rejeitar este briefing?')) return
      try {
        await api('/briefing/'+btn.dataset.bfReject, { method:'PATCH', body:JSON.stringify({ status:'REJEITADO' }) })
        toast('Briefing rejeitado.','success'); loadBriefings()
      } catch (err) { toast(err.message,'error') }
    })
  )
}
$('#refreshBriefingsBtn')?.addEventListener('click', loadBriefings)

/* ── Campaigns ─────────────────────────────────────────────────── */
function isImageUrl(u) { return /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(u || '') }

async function loadCampaigns() {
  const grid = $('#campaignGrid')
  if (grid) grid.innerHTML = '<div class="app-loader"></div>'
  try {
    const [camps] = await Promise.all([
      api('/campaigns'),
      state.allTasks.length ? Promise.resolve() : api('/tasks/kanban').then(b => { state.allTasks = Object.values(b).flat() }),
    ])
    state.campaigns = camps
    renderCampaignGrid(camps)
  } catch (err) { if (grid) grid.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>` }
}
function renderCampaignGrid(camps) {
  const grid = $('#campaignGrid')
  if (!grid) return
  if (!camps.length) {
    grid.innerHTML = '<div class="empty-state">Nenhuma campanha ainda. Clique em <strong>+ Nova campanha</strong> para agrupar tarefas de um evento.</div>'
    return
  }
  grid.innerHTML = camps.map(c => {
    const cor = c.cor || '#E8743B'
    const total = c.task_count ?? 0, done = c.task_done ?? 0
    const pct = total > 0 ? Math.round((done/total)*100) : 0
    const evt = c.data_evento ? new Date(c.data_evento).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : null
    return `<div class="campaign-card" data-camp="${c.id}" style="--cc-color:${cor}">
      <div class="cc-name">${escapeHtml(c.nome)}</div>
      <div class="cc-meta">
        ${evt ? `<span>📅 ${evt}</span>` : ''}
        ${c.local ? `<span>📍 ${escapeHtml(c.local)}</span>` : ''}
      </div>
      <div class="cc-progress"><div class="cc-progress-fill" style="width:${pct}%"></div></div>
      <div class="cc-footer">
        <span>${done}/${total} concluídas</span>
        <span>${(c.link_assets||[]).length} assets</span>
      </div>
    </div>`
  }).join('')
  $$('.campaign-card', grid).forEach(card => card.addEventListener('click', () => openCampaignPanel(card.dataset.camp)))
}

let currentCampaignId = null
let currentCampaign   = null
async function openCampaignPanel(id) {
  try {
    const c = await api('/campaigns/'+id)
    currentCampaignId = id; currentCampaign = c
    const cor = c.cor || '#E8743B'
    $('#cdpColorDot').style.background = cor
    const nameEl = $('#cdpName')
    nameEl.textContent = c.nome
    nameEl.contentEditable = isAdmin() ? 'plaintext-only' : 'false'
    $('#cdpDataEvento').value = c.data_evento ? c.data_evento.slice(0,10) : ''
    $('#cdpLocal').value      = c.local || ''
    $('#cdpLat').value        = c.lat != null ? c.lat : ''
    $('#cdpLng').value        = c.lng != null ? c.lng : ''
    $('#cdpDescricao').value  = c.descricao || ''
    const tasks = c.tasks || []
    const done  = tasks.filter(t => t.status === 'CONCLUIDO').length
    $('#cdpStats').innerHTML = [
      { val: tasks.length, lbl: 'Tarefas' },
      { val: done,         lbl: 'Concluídas', cls:'success' },
      { val: (c.link_assets||[]).length, lbl: 'Assets' },
    ].map(s => `<div class="tdp-stat-item ${s.cls||''}"><div class="tdp-stat-val">${s.val}</div><div class="tdp-stat-lbl">${s.lbl}</div></div>`).join('')
    const ed = isAdmin()
    ;['#cdpDataEvento','#cdpLocal','#cdpLat','#cdpLng','#cdpDescricao'].forEach(s => $(s).disabled = !ed)
    $('#cdpAssetAddWrap').hidden = !ed
    $('#cdpDeleteBtn').hidden = !ed
    renderCampaignAssets(c.link_assets || [], ed)
    renderCampaignPanelTasks(tasks)
    $('#campaignDetailOverlay').hidden = false
    document.body.style.overflow = 'hidden'
  } catch (err) { toast(err.message, 'error') }
}
function closeCampaignPanel() {
  $('#campaignDetailOverlay').hidden = true
  document.body.style.overflow = ''
  currentCampaignId = null; currentCampaign = null
}
function renderCampaignAssets(assets, editable) {
  const list = $('#cdpAssetList')
  $('#cdpAssetCount').textContent = assets.length || ''
  if (!assets.length) { list.innerHTML = '<p class="muted" style="font-size:.8rem">Nenhum asset compartilhado.</p>'; return }
  list.innerHTML = assets.map((a, i) => `
    <div class="cdp-asset-row">
      <span class="cdp-asset-name">${escapeHtml(a.nome)}</span>
      <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.url)}</a>
      ${editable ? `<button class="cdp-asset-del" data-asset-idx="${i}" title="Remover">×</button>` : ''}
    </div>`).join('')
  if (editable) {
    $$('[data-asset-idx]', list).forEach(btn => btn.addEventListener('click', async () => {
      const idx = +btn.dataset.assetIdx
      const next = (currentCampaign.link_assets || []).filter((_, i) => i !== idx)
      await saveCampaignAssets(next)
    }))
  }
}
async function saveCampaignAssets(assets) {
  try {
    await api('/campaigns/'+currentCampaignId, { method:'PATCH', body: JSON.stringify({ link_assets: assets }) })
    currentCampaign.link_assets = assets
    renderCampaignAssets(assets, isAdmin())
    const cc = state.campaigns.find(c => c.id === currentCampaignId); if (cc) cc.link_assets = assets
    toast('Assets atualizados.', 'success')
  } catch (err) { toast(err.message, 'error') }
}
function renderCampaignPanelTasks(tasks) {
  $('#cdpTaskCount').textContent = tasks.length || ''
  const wrap = $('#cdpTaskList')
  if (!tasks.length) { wrap.innerHTML = '<p class="muted" style="font-size:.8rem">Nenhuma tarefa vinculada.</p>'; return }
  wrap.innerHTML = tasks.map(t => `<div class="tdp-task-row" data-id="${t.id}">
    ${priorityChip(t.prioridade)}
    <span class="tdp-task-title" title="${escapeHtml(t.titulo)}">${escapeHtml(t.titulo)}</span>
    ${statusBadge(t.status)}
  </div>`).join('')
  $$('.tdp-task-row', wrap).forEach(row => row.addEventListener('click', () => { closeCampaignPanel(); navigate('tasks'); openPanel(row.dataset.id) }))
}
$('#cdpAssetAddBtn')?.addEventListener('click', async () => {
  const nome = $('#cdpAssetNome').value.trim()
  const url  = $('#cdpAssetUrl').value.trim()
  if (!nome || !url) { toast('Informe nome e URL do asset.', 'error'); return }
  const next = [...(currentCampaign.link_assets || []), { nome, url }]
  $('#cdpAssetNome').value = ''; $('#cdpAssetUrl').value = ''
  await saveCampaignAssets(next)
})
$('#cdpName')?.addEventListener('blur', async () => {
  if (!isAdmin() || !currentCampaignId) return
  const nome = $('#cdpName').textContent.trim()
  if (!nome || nome.length < 2) return
  try { await api('/campaigns/'+currentCampaignId, { method:'PATCH', body: JSON.stringify({ nome }) })
    const cc = state.campaigns.find(c => c.id === currentCampaignId); if (cc) cc.nome = nome
    toast('Campanha atualizada.', 'success')
  } catch (err) { toast(err.message, 'error') }
})
;[['#cdpDataEvento','data_evento'],['#cdpLocal','local'],['#cdpDescricao','descricao']].forEach(([sel,key]) => {
  $(sel)?.addEventListener('blur', () => {
    if (!isAdmin() || !currentCampaignId) return
    api('/campaigns/'+currentCampaignId, { method:'PATCH', body: JSON.stringify({ [key]: $(sel).value || null }) })
      .then(() => toast('Salvo.','success')).catch(e => toast(e.message,'error'))
  })
})
;['#cdpLat','#cdpLng'].forEach(sel => {
  $(sel)?.addEventListener('blur', () => {
    if (!isAdmin() || !currentCampaignId) return
    const key = sel === '#cdpLat' ? 'lat' : 'lng'
    const val = parseFloat($(sel).value)
    api('/campaigns/'+currentCampaignId, { method:'PATCH', body: JSON.stringify({ [key]: isNaN(val) ? null : val }) })
      .then(() => toast('Salvo.','success')).catch(e => toast(e.message,'error'))
  })
})
$('#closeCampaignPanelBtn')?.addEventListener('click', closeCampaignPanel)
$('#campaignPanelBackdrop')?.addEventListener('click', closeCampaignPanel)
$('#cdpDeleteBtn')?.addEventListener('click', async () => {
  if (!await confirmDialog('Excluir esta campanha? As tarefas serão desvinculadas (não excluídas).')) return
  try {
    await api('/campaigns/'+currentCampaignId, { method:'DELETE' })
    state.campaigns = state.campaigns.filter(c => c.id !== currentCampaignId)
    closeCampaignPanel(); renderCampaignGrid(state.campaigns)
    toast('Campanha excluída.', 'success')
  } catch (err) { toast(err.message, 'error') }
})
$('#newCampaignBtn')?.addEventListener('click', () => {
  $('#campaignFormError').hidden = true
  $('#cNome').value=''; $('#cDescricao').value=''; $('#cDataEvento').value=''; $('#cLocal').value=''; $('#cCor').value='#E8743B'
  $('#campaignDialog').showModal()
})
$('#cancelCampaignBtn')?.addEventListener('click', () => $('#campaignDialog').close())
$('#campaignForm')?.addEventListener('submit', async e => {
  e.preventDefault()
  const body = {
    nome:        $('#cNome').value.trim(),
    descricao:   $('#cDescricao').value.trim() || undefined,
    data_evento: $('#cDataEvento').value || undefined,
    cor:         $('#cCor').value || undefined,
    local:       $('#cLocal').value.trim() || undefined,
  }
  try {
    await api('/campaigns', { method:'POST', body: JSON.stringify(body) })
    $('#campaignDialog').close(); toast('Campanha criada.','success'); loadCampaigns()
  } catch (err) { $('#campaignFormError').textContent = err.message; $('#campaignFormError').hidden = false }
})
function populateCampaignSelect(sel, currentValue) {
  const el = $(sel); if (!el) return
  el.innerHTML = '<option value="">— Sem campanha —</option>' +
    (state.campaigns || []).map(c => `<option value="${c.id}"${c.id===currentValue?' selected':''}>${escapeHtml(c.nome)}</option>`).join('')
}

/* ── Calendar (agenda) ─────────────────────────────────────────── */
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const CAL_COLORS = { tarefa:'#6366f1', campanha:'#E8743B', evento:'#16a34a' }
const calState = { ref: new Date(), events: [], filters: { tarefas:true, campanhas:true, eventos:true, campaignId:'' } }

function ymd(d) { // Date -> 'YYYY-MM-DD' (local)
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
function isoToYmd(iso) { return iso ? String(iso).slice(0,10) : '' }

async function loadCalendar() {
  try {
    if (!(state.allTasks || []).length) { const b = await api('/tasks/kanban'); state.allTasks = b ? Object.values(b).flat() : [] }
    if (!(state.campaigns || []).length) { try { const c = await api('/campaigns'); state.campaigns = Array.isArray(c) ? c : [] } catch {} }
    try { const ev = await api('/events'); calState.events = Array.isArray(ev) ? ev : [] } catch { calState.events = [] }
  } catch (err) { toast(err.message, 'error') }
  populateCampaignSelect('#calFilterCampaign', calState.filters.campaignId)
  // o select de filtro usa "Todas campanhas" como opção vazia
  const cf = $('#calFilterCampaign'); if (cf) cf.options[0].text = 'Todas campanhas'
  renderCalendar()
}

function collectCalendarItems() {
  const items = {} // 'YYYY-MM-DD' -> [{kind,id,title,time,color,campaign_id}]
  const push = (date, item) => { if (!date) return; (items[date] ??= []).push(item) }
  const f = calState.filters
  if (f.tarefas) {
    (state.allTasks || []).forEach(t => {
      if (!t.data_fim_planejado) return
      if (f.campaignId && t.campaign_id !== f.campaignId) return
      push(isoToYmd(t.data_fim_planejado), { kind:'tarefa', id:t.id, title:t.titulo, time:t.hora_publicacao, color:(t.canal && CANAL_COLORS[t.canal]) || CAL_COLORS.tarefa })
    })
  }
  if (f.campanhas) {
    (state.campaigns || []).forEach(c => {
      if (!c.data_evento) return
      if (f.campaignId && c.id !== f.campaignId) return
      push(isoToYmd(c.data_evento), { kind:'campanha', id:c.id, title:c.nome, color:c.cor || CAL_COLORS.campanha })
    })
  }
  if (f.eventos) {
    (calState.events || []).forEach(e => {
      if (f.campaignId && e.campaign_id !== f.campaignId) return
      push(isoToYmd(e.data), { kind:'evento', id:e.id, title:e.titulo, time:e.hora, color:e.cor || CAL_COLORS.evento })
    })
  }
  return items
}

function renderCalendar() {
  const grid = $('#calGrid'); if (!grid) return
  const ref = calState.ref
  $('#calTitle').textContent = `${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`
  const firstOfMonth = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const startDay = firstOfMonth.getDay() // 0=domingo
  const gridStart = new Date(firstOfMonth); gridStart.setDate(1 - startDay)
  const todayYmd = ymd(new Date())
  const items = collectCalendarItems()

  let html = ''
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
    const key = ymd(d)
    const other = d.getMonth() !== ref.getMonth()
    const dayItems = items[key] || []
    const shown = dayItems.slice(0, 3)
    const extra = dayItems.length - shown.length
    html += `<div class="cal-cell ${other?'other-month':''} ${key===todayYmd?'today':''}" data-date="${key}">
      <div class="cal-daynum">${d.getDate()}</div>
      ${isAdmin() ? `<button class="cal-add" data-add="${key}" title="Novo evento">+ evento</button>` : ''}
      <div class="cal-events">
        ${shown.map(it => `<div class="cal-event" data-kind="${it.kind}" data-id="${it.id}" style="--ce-color:${it.color};--ce-bg:${it.color}1a" title="${escapeHtml(it.title)}">
          ${it.time ? `<span class="ce-time">${escapeHtml(it.time)}</span>` : ''}<span>${escapeHtml(it.title)}</span>
        </div>`).join('')}
        ${extra > 0 ? `<span class="cal-more" data-more="${key}">+${extra} mais</span>` : ''}
      </div>
    </div>`
  }
  grid.innerHTML = html

  // clique em item → abre detalhe conforme tipo
  $$('.cal-event', grid).forEach(el => el.addEventListener('click', e => {
    e.stopPropagation(); openCalendarItem(el.dataset.kind, el.dataset.id)
  }))
  // "+N mais" → abre dialog do dia
  $$('[data-more]', grid).forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openDayEvents(el.dataset.more, items[el.dataset.more] || []) }))
  // botão "+ evento" por dia (admin)
  $$('[data-add]', grid).forEach(el => el.addEventListener('click', e => {
    e.stopPropagation(); if (isAdmin()) openEventDialog(null, el.dataset.add)
  }))
}

function openCalendarItem(kind, id) {
  if (kind === 'tarefa')   { navigate('tasks'); openPanel(id) }
  else if (kind === 'campanha') { openCampaignPanel(id) }
  else if (kind === 'evento')   { openEventOpPanel(id) }   // abre painel de operação (checklist)
}

function openDayEvents(dateKey, dayItems) {
  const dlg = $('#dayEventsDialog'); if (!dlg) return
  const d = new Date(dateKey + 'T00:00:00')
  $('#dayEventsTitle').textContent = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })
  $('#dayEventsList').innerHTML = dayItems.map(it =>
    `<div class="day-event-row" data-kind="${it.kind}" data-id="${it.id}" style="--ce-color:${it.color}">
      <span class="de-kind">${it.kind}</span>
      ${it.time ? `<span class="ce-time">${escapeHtml(it.time)}</span>` : ''}
      <span class="de-title">${escapeHtml(it.title)}</span>
    </div>`).join('')
  $$('.day-event-row', dlg).forEach(el => el.addEventListener('click', () => { dlg.close(); openCalendarItem(el.dataset.kind, el.dataset.id) }))
  dlg.showModal()
}
$('#dayEventsClose')?.addEventListener('click', () => $('#dayEventsDialog').close())

/* Navegação de mês + filtros */
$('#calPrev')?.addEventListener('click',  () => { calState.ref = new Date(calState.ref.getFullYear(), calState.ref.getMonth()-1, 1); renderCalendar() })
$('#calNext')?.addEventListener('click',  () => { calState.ref = new Date(calState.ref.getFullYear(), calState.ref.getMonth()+1, 1); renderCalendar() })
$('#calToday')?.addEventListener('click', () => { calState.ref = new Date(); renderCalendar() })
$('#calShowTasks')?.addEventListener('change',     e => { calState.filters.tarefas    = e.target.checked; renderCalendar() })
$('#calShowCampaigns')?.addEventListener('change', e => { calState.filters.campanhas  = e.target.checked; renderCalendar() })
$('#calShowEvents')?.addEventListener('change',    e => { calState.filters.eventos    = e.target.checked; renderCalendar() })
$('#calFilterCampaign')?.addEventListener('change', e => { calState.filters.campaignId = e.target.value; renderCalendar() })

/* CRUD de eventos avulsos */
const TRANSMISSAO_LABELS = { GRAVACAO:'🎬 Apenas gravação', AO_VIVO:'📡 Ao vivo', AMBOS:'🎬📡 Gravação + Live' }

function openEventDialog(ev, prefillDate) {
  const isEdit = !!ev
  $('#eventDialogTitle').textContent = isEdit ? 'Editar evento' : 'Novo evento'
  $('#evId').value        = ev?.id || ''
  $('#evTitulo').value    = ev?.titulo || ''
  $('#evDescricao').value = ev?.descricao || ''
  $('#evData').value      = ev ? isoToYmd(ev.data) : (prefillDate || ymd(new Date()))
  $('#evHora').value      = ev?.hora || ''
  $('#evLocal').value     = ev?.local || ''
  $('#evLat').value       = ev?.lat != null ? ev.lat : ''
  $('#evLng').value       = ev?.lng != null ? ev.lng : ''
  $('#evCor').value       = ev?.cor || '#16a34a'
  populateCampaignSelect('#evCampaign', ev?.campaign_id || '')
  $('#evCalSource').value = ev?.calendar_source || 'COMUNICACAO'
  $('#evTipoTransmissao').value = ev?.tipo_transmissao || ''
  // Cover preview
  const preview = $('#evCoverPreview')
  const placeholder = $('#evCoverPlaceholder')
  if (ev?.cover_url && preview) {
    preview.src = ev.cover_url; preview.hidden = false
    if (placeholder) placeholder.hidden = true
  } else if (preview) {
    preview.src = ''; preview.hidden = true
    if (placeholder) placeholder.hidden = false
  }
  // Reset upload state
  const upStatus = $('#evCoverUploadStatus'); if (upStatus) upStatus.hidden = true
  const fileInput = $('#evCoverFile'); if (fileInput) fileInput.value = ''
  // Store pending cover URL for this edit session
  window._pendingCoverUrl = ev?.cover_url || null
  $('#evDeleteBtn').hidden = !isEdit
  $('#eventFormError').hidden = true
  $('#eventDialog').showModal()
}

// Cover art upload wiring
$('#evCoverDropzone')?.addEventListener('click', () => $('#evCoverFile')?.click())
$('#evCoverDropzone')?.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') })
$('#evCoverDropzone')?.addEventListener('dragleave', e => { e.currentTarget.classList.remove('drag-over') })
$('#evCoverDropzone')?.addEventListener('drop', e => {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over')
  const file = e.dataTransfer?.files?.[0]; if (file) handleCoverFile(file)
})
$('#evCoverFile')?.addEventListener('change', e => {
  const file = e.target.files?.[0]; if (file) handleCoverFile(file)
})

function handleCoverFile(file) {
  if (file.size > 2 * 1024 * 1024) { toast('Imagem muito grande. Máximo: 2 MB.', 'error'); return }
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) { toast('Formato inválido. Use JPG, PNG, WebP ou GIF.', 'error'); return }
  const reader = new FileReader()
  reader.onload = e => {
    const dataUrl = e.target.result
    const preview = $('#evCoverPreview'), ph = $('#evCoverPlaceholder')
    if (preview) { preview.src = dataUrl; preview.hidden = false }
    if (ph) ph.hidden = true
    // Store for upload
    window._pendingCoverFile = { file_base64: dataUrl.split(',')[1], mime_type: file.type, filename: file.name }
    const st = $('#evCoverUploadStatus')
    if (st) { st.textContent = '📸 Nova imagem selecionada — será enviada ao salvar.'; st.hidden = false; st.className = 'ev-cover-upload-status info' }
  }
  reader.readAsDataURL(file)
}
$('#newEventBtn')?.addEventListener('click', () => openEventDialog(null))
$('#cancelEventBtn')?.addEventListener('click', () => $('#eventDialog').close())
$('#eventForm')?.addEventListener('submit', async e => {
  e.preventDefault()
  const id = $('#evId').value
  const body = {
    titulo:            $('#evTitulo').value.trim(),
    descricao:         $('#evDescricao').value.trim() || undefined,
    data:              $('#evData').value,
    hora:              $('#evHora').value || undefined,
    local:             $('#evLocal').value.trim() || undefined,
    lat:               parseFloat($('#evLat').value) || undefined,
    lng:               parseFloat($('#evLng').value) || undefined,
    cor:               $('#evCor').value || undefined,
    campaign_id:       $('#evCampaign').value || undefined,
    calendar_source:   $('#evCalSource').value || 'COMUNICACAO',
    tipo_transmissao:  $('#evTipoTransmissao').value || undefined,
  }
  try {
    let savedId = id
    if (id) await api('/events/'+id, { method:'PATCH', body: JSON.stringify(body) })
    else {
      const created = await api('/events', { method:'POST', body: JSON.stringify(body) })
      savedId = created?.id
    }
    // Upload da capa se houver arquivo novo
    if (savedId && window._pendingCoverFile) {
      const st = $('#evCoverUploadStatus')
      if (st) { st.textContent = '⏳ Enviando capa…'; st.hidden = false; st.className = 'ev-cover-upload-status info' }
      try {
        const res = await api('/events/'+savedId+'/cover', {
          method: 'POST', body: JSON.stringify(window._pendingCoverFile),
        })
        if (res?.cover_url) {
          if (st) { st.textContent = '✓ Capa enviada com sucesso!'; st.className = 'ev-cover-upload-status success' }
        }
      } catch (covErr) {
        toast('Evento salvo, mas a capa não pôde ser enviada: ' + covErr.message, 'error')
      }
      window._pendingCoverFile = null
    }
    $('#eventDialog').close()
    toast(id ? 'Evento atualizado.' : 'Evento criado.', 'success')
    const ev = await api('/events'); calState.events = Array.isArray(ev) ? ev : []
    renderCalendar(); renderAgendaList()
  } catch (err) { $('#eventFormError').textContent = err.message; $('#eventFormError').hidden = false }
})
$('#evDeleteBtn')?.addEventListener('click', async () => {
  const id = $('#evId').value
  if (!id || !await confirmDialog('Excluir este evento?')) return
  try {
    await api('/events/'+id, { method:'DELETE' })
    $('#eventDialog').close(); toast('Evento excluído.', 'success')
    calState.events = (calState.events || []).filter(e => e.id !== id)
    renderCalendar()
  } catch (err) { toast(err.message, 'error') }
})

/* ── Notifications ─────────────────────────────────────────────── */
let _notifTimer = null
function startNotifPolling() {
  if (state.user?.role === 'GUEST') return       // visitantes não recebem notificações
  loadNotifications()
  clearInterval(_notifTimer)
  _notifTimer = setInterval(loadNotifications, 30000)   // polling leve a cada 30s
}
function stopNotifPolling() { clearInterval(_notifTimer); _notifTimer = null }
async function loadNotifications() {
  try {
    const items = await api('/notifications')
    renderNotifications(Array.isArray(items) ? items : [])
  } catch { /* endpoint pode não existir ainda — falha silenciosa */ }
}
function renderNotifications(items) {
  const badge = $('#notifBadge')
  const list  = $('#notifList')
  if (!list) return
  const unread = items.filter(n => !n.lida).length
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : String(unread)
    badge.hidden = unread === 0
  }
  if (!items.length) {
    list.innerHTML = '<div class="notif-empty">Nenhuma notificação.</div>'
    return
  }
  list.innerHTML = items.slice(0, 30).map(n => `
    <div class="notif-item ${n.lida ? '' : 'unread'}" data-notif="${n.id}" ${n.task_id ? `data-task="${n.task_id}"` : ''}>
      <span class="notif-dot"></span>
      <div class="notif-body">
        <div class="notif-msg">${escapeHtml(n.mensagem)}</div>
        <div class="notif-time">${relativeTime(n.created_at)}</div>
      </div>
    </div>`).join('')
  $$('.notif-item', list).forEach(el => el.addEventListener('click', async () => {
    const id = el.dataset.notif, taskId = el.dataset.task
    try { await api('/notifications/'+id+'/read', { method:'PATCH' }) } catch {}
    el.classList.remove('unread')
    loadNotifications()
    if (taskId) { $('#notifDropdown').hidden = true; navigate('tasks'); openPanel(taskId) }
  }))
}
$('#notifBtn')?.addEventListener('click', e => {
  e.stopPropagation()
  const dd = $('#notifDropdown')
  if (dd) { dd.hidden = !dd.hidden; if (!dd.hidden) loadNotifications() }
})
$('#notifMarkAll')?.addEventListener('click', async () => {
  try { await api('/notifications/read-all', { method:'PATCH' }); loadNotifications() }
  catch (err) { toast(err.message, 'error') }
})
document.addEventListener('click', e => {
  if (!$('.notif-wrap')?.contains(e.target)) { const dd = $('#notifDropdown'); if (dd) dd.hidden = true }
})

/* ── Mapa de eventos (Leaflet + OpenStreetMap) ─────────────────── */
let _mapaLeaflet   = null          // singleton Leaflet instance
let _mapaMarkers   = []            // layer group references for cleanup
const mapaFilters  = { tarefas: true, campanhas: true, eventos: true }

async function loadMapa() {
  // Ensure data is loaded
  try {
    if (!(state.allTasks || []).length) {
      const b = await api('/tasks/kanban')
      state.allTasks = b ? Object.values(b).flat() : []
    }
    if (!(state.campaigns || []).length) {
      try { const c = await api('/campaigns'); state.campaigns = Array.isArray(c) ? c : [] } catch {}
    }
    if (!(calState.events || []).length) {
      try { const ev = await api('/events'); calState.events = Array.isArray(ev) ? ev : [] } catch {}
    }
  } catch (err) { toast(err.message, 'error') }

  const container = document.getElementById('mapaContainer')
  if (!container) return

  if (!window.L) {
    // Leaflet not available (e.g. network blocked) — show list only
    container.innerHTML = '<div class="mapa-empty">Mapa indisponível. Usando lista de locais abaixo.</div>'
    renderMapaList()
    return
  }

  // Init map once; invalidate size if container was hidden on init
  if (!_mapaLeaflet) {
    _mapaLeaflet = window.L.map('mapaContainer', {
      center: [-15.78, -47.93],   // centro geográfico do Brasil
      zoom: 5,
      attributionControl: true,
    })
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(_mapaLeaflet)
  } else {
    // Container may have been display:none — force size recalculation
    requestAnimationFrame(() => _mapaLeaflet.invalidateSize())
  }

  renderMapaPins()
  renderMapaList()
}

function buildMapaItems() {
  const items = []
  if (mapaFilters.tarefas) {
    (state.allTasks || []).forEach(t => {
      if (t.lat && t.lng) items.push({ kind: 'tarefa', id: t.id, title: t.titulo, local: t.local || '', lat: +t.lat, lng: +t.lng, color: (t.canal && CANAL_COLORS[t.canal]) || CAL_COLORS.tarefa, sub: CANAL_LABELS[t.canal] || t.canal || '' })
    })
  }
  if (mapaFilters.campanhas) {
    (state.campaigns || []).forEach(c => {
      if (c.lat && c.lng) items.push({ kind: 'campanha', id: c.id, title: c.nome, local: c.local || '', lat: +c.lat, lng: +c.lng, color: c.cor || CAL_COLORS.campanha, sub: c.data_evento ? new Date(c.data_evento).toLocaleDateString('pt-BR') : '' })
    })
  }
  if (mapaFilters.eventos) {
    (calState.events || []).forEach(e => {
      if (e.lat && e.lng) items.push({ kind: 'evento', id: e.id, title: e.titulo, local: e.local || '', lat: +e.lat, lng: +e.lng, color: e.cor || CAL_COLORS.evento, sub: e.data ? new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR') : '' })
    })
  }
  return items
}

function renderMapaPins() {
  if (!_mapaLeaflet || !window.L) return

  // Remove old markers
  _mapaMarkers.forEach(m => m.remove())
  _mapaMarkers = []

  const items = buildMapaItems()
  if (!items.length) return

  const bounds = []
  items.forEach(it => {
    const marker = window.L.circleMarker([it.lat, it.lng], {
      radius: 9, color: '#fff', weight: 2,
      fillColor: it.color, fillOpacity: 0.9,
    })
    const kindLabel = it.kind === 'tarefa' ? 'Tarefa' : it.kind === 'campanha' ? 'Campanha' : 'Evento'
    marker.bindPopup(
      `<span class="pop-kind">${kindLabel}</span>` +
      `<strong>${escapeHtml(it.title)}</strong>` +
      (it.local ? `<div style="color:#6B6359;font-size:.75rem">📍 ${escapeHtml(it.local)}</div>` : '') +
      (it.sub ? `<div style="color:#6B6359;font-size:.75rem">${escapeHtml(it.sub)}</div>` : '') +
      `<a class="pop-link" href="#">Ver detalhes →</a>`,
      { maxWidth: 220 }
    )
    marker.on('popupopen', () => {
      const a = marker.getPopup().getElement()?.querySelector('.pop-link')
      if (a) a.addEventListener('click', ev => { ev.preventDefault(); marker.closePopup(); openMapaItem(it) })
    })
    marker.addTo(_mapaLeaflet)
    _mapaMarkers.push(marker)
    bounds.push([it.lat, it.lng])
  })

  // Fit map to markers if there are any
  if (bounds.length) {
    try { _mapaLeaflet.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 }) } catch {}
  }
}

function openMapaItem(it) {
  if (it.kind === 'tarefa')   { navigate('tasks');    openPanel(it.id) }
  if (it.kind === 'campanha') { openCampaignPanel(it.id) }
  if (it.kind === 'evento')   { navigate('calendar'); setTimeout(() => openEventOpPanel(it.id), 100) }
}

function renderMapaList() {
  const list = document.getElementById('mapaList')
  if (!list) return
  const items = buildMapaItems()
  if (!items.length) {
    list.innerHTML = '<div class="mapa-empty">Nenhuma tarefa, campanha ou evento com localização definida. Preencha o campo <em>Local</em> + coordenadas (lat/lng) nas tarefas, campanhas ou eventos para vê-los aqui.</div>'
    return
  }
  list.innerHTML = '<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">Lista de locais — clique para abrir</div>' +
    items.map(it => {
      const kindLabel = it.kind === 'tarefa' ? 'Tarefa' : it.kind === 'campanha' ? 'Campanha' : 'Evento'
      return `<div class="mapa-list-item" data-kind="${it.kind}" data-id="${it.id}" style="--mi-color:${it.color}">
        <div class="mapa-list-icon" style="background:${it.color}"></div>
        <div class="mapa-list-body">
          <div class="mapa-list-title">${escapeHtml(it.title)}</div>
          <div class="mapa-list-meta">${it.local ? `📍 ${escapeHtml(it.local)}` : ''}${it.sub ? ` · ${escapeHtml(it.sub)}` : ''}</div>
        </div>
        <span class="mapa-list-badge">${kindLabel}</span>
      </div>`
    }).join('')
  list.querySelectorAll('.mapa-list-item').forEach(el =>
    el.addEventListener('click', () => openMapaItem({ kind: el.dataset.kind, id: el.dataset.id }))
  )
}

/* ── Agenda de Eventos (Feature 2: Renamed from Mapa) ────────────────── */
let _agendaSourceFilter = 'ALL'
let _agendaFromDate = null
let _agendaToDate = null

async function loadAgenda() {
  try {
    if (!(calState.events || []).length) {
      const ev = await api('/events')
      calState.events = Array.isArray(ev) ? ev : []
    }
  } catch (err) { toast(err.message, 'error') }
  renderAgendaList()
}

function renderAgendaList() {
  const list = $('#agendaList')
  if (!list) return

  let events = (calState.events || []).filter(e => !e.deleted_at)

  // Filter by source
  if (_agendaSourceFilter !== 'ALL') {
    events = events.filter(e => (e.calendar_source || 'COMUNICACAO') === _agendaSourceFilter)
  }

  // Filter by date range
  if (_agendaFromDate) events = events.filter(e => e.data >= _agendaFromDate)
  if (_agendaToDate) events = events.filter(e => e.data <= _agendaToDate)

  // Sort by date
  events.sort((a, b) => new Date(a.data) - new Date(b.data))

  if (!events.length) {
    list.innerHTML = '<div style="padding:20px;color:var(--text-muted);text-align:center">Nenhum evento encontrado.</div>'
    return
  }

  // Group by month
  const grouped = {}
  events.forEach(e => {
    const date = new Date(e.data + 'T00:00:00')
    const month = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(e)
  })

  const sourceColors = { COMUNICACAO: '#E8743B', CONVENCAO: '#6366f1', GERAL: '#16a34a' }
  const sourceLabels = { COMUNICACAO: '📣 Comunicação', CONVENCAO: '🏛️ Convenção Regional', GERAL: '🌍 Geral' }

  list.innerHTML = Object.entries(grouped).map(([month, monthEvents]) => `
    <div class="agenda-month-group">
      <div class="agenda-month-header">${month}</div>
      ${monthEvents.map(e => {
        const source = e.calendar_source || 'COMUNICACAO'
        const color = e.cor || sourceColors[source]
        const sourceLabel = sourceLabels[source]

        const txBadge = e.tipo_transmissao ? `<span class="agenda-tx-badge agenda-tx-${e.tipo_transmissao}">${TRANSMISSAO_LABELS[e.tipo_transmissao]||e.tipo_transmissao}</span>` : ''
        return `<div class="agenda-event-card" data-event-id="${e.id}">
          ${e.cover_url
            ? `<div class="agenda-event-cover" style="background-image:url(${JSON.stringify(e.cover_url)})"></div>`
            : `<div class="agenda-event-card-color" style="background:${color}"></div>`}
          <div class="agenda-event-card-body">
            <div class="agenda-event-card-title" title="${escapeHtml(e.titulo)}">${escapeHtml(e.titulo)}</div>
            <div class="agenda-event-card-meta">
              <span>📅 ${new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
              ${e.hora ? `<span>⏰ ${e.hora}</span>` : ''}
              ${e.local ? `<span>📍 ${escapeHtml(e.local.slice(0, 30))}</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px">
              <span class="agenda-event-card-source-badge">${sourceLabel}</span>
              ${txBadge}
              ${isAdmin() ? `<button class="btn-ghost btn-xs" data-edit-event="${e.id}" title="Editar evento">✏</button>` : ''}
              <button class="btn-ghost btn-xs" data-open-event="${e.id}" title="Abrir painel de operação">📋 Operação</button>
            </div>
          </div>
        </div>`
      }).join('')}
    </div>
  `).join('')

  // Event handlers
  $$('[data-open-event]', list).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.openEvent
      navigate('calendar')
      setTimeout(() => openEventOpPanel(id), 100)
    })
  })
  $$('[data-edit-event]', list).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editEvent
      const ev = (calState.events || []).find(e => e.id === id)
      if (ev) openEventDialog(ev)
    })
  })
}

// Agenda source filters
$$('.agenda-source-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('.agenda-source-chip').forEach(c => c.classList.remove('active'))
    chip.classList.add('active')
    _agendaSourceFilter = chip.dataset.source
    renderAgendaList()
  })
})

// Agenda date filters
$('#agendaFromDate')?.addEventListener('change', e => {
  _agendaFromDate = e.target.value
  renderAgendaList()
})
$('#agendaToDate')?.addEventListener('change', e => {
  _agendaToDate = e.target.value
  renderAgendaList()
})

// New event button
$('#agendaNewEventBtn')?.addEventListener('click', () => openEventDialog())

/* ── Reuniões (Feature 3: Meeting Transcript AI) ────────────────────── */
function loadReunioes() {
  // Reset the form on load
  $('#meetingContext').value = ''
  $('#meetingTranscript').value = ''
  $('#meetingResultsWrap').hidden = true
  updateMeetingCharCount()
}

$('#meetingTranscript')?.addEventListener('input', updateMeetingCharCount)
function updateMeetingCharCount() {
  const textarea = $('#meetingTranscript')
  const counter = $('#meetingCharCount')
  if (textarea && counter) {
    const len = textarea.value.length
    counter.textContent = `${len} / 50.000 caracteres`
  }
}

$('#analyzeMeetingBtn')?.addEventListener('click', async () => {
  const transcript = $('#meetingTranscript')?.value.trim()
  if (!transcript) { toast('Cole uma transcrição primeiro.', 'error'); return }

  const btn = $('#analyzeMeetingBtn')
  btn.disabled = true
  btn.textContent = '⏳ Analisando…'

  try {
    const result = await api('/ai/meeting-tasks', {
      method: 'POST',
      body: JSON.stringify({
        transcricao: transcript,
        contexto: $('#meetingContext')?.value.trim(),
      }),
    })
    renderMeetingTasks(result.tasks, result.mode)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    btn.disabled = false
    btn.textContent = '🤖 Extrair tarefas'
  }
})

let _selectedMeetingTasks = []

function renderMeetingTasks(tasks, mode) {
  const wrap = $('#meetingResultsWrap')
  const list = $('#meetingTaskList')
  if (!wrap || !list) return

  _selectedMeetingTasks = tasks.map((t, i) => ({ ...t, _idx: i, _checked: true }))

  // Count badge
  $('#meetingTaskCount').textContent = tasks.length

  // Render team picker
  const teamSelect = $('#meetingTeamSelect')
  if (teamSelect && (state.teams || []).length) {
    teamSelect.innerHTML = (state.teams || [])
      .filter(t => !t.deleted_at)
      .map(t => `
        <label class="meeting-team-chip">
          <input type="checkbox" class="meeting-team-checkbox" value="${t.id}" data-team-id="${t.id}" />
          <span>${escapeHtml(t.nome)}</span>
        </label>
      `).join('')
  }

  // Render tasks
  list.innerHTML = tasks.map((task, idx) => `
    <div class="meeting-task-card" data-task-idx="${idx}">
      <input type="checkbox" class="meeting-task-check" data-task-idx="${idx}" checked />
      <div class="meeting-task-body">
        <div class="meeting-task-titulo">
          <input type="text" value="${escapeHtml(task.titulo)}" data-task-field="titulo" data-task-idx="${idx}" />
        </div>
        <div class="meeting-task-badges">
          <label class="meeting-task-badge">
            Prioridade:
            <select data-task-field="prioridade" data-task-idx="${idx}">
              <option value="">—</option>
              <option value="BAIXA" ${task.prioridade === 'BAIXA' ? 'selected' : ''}>Baixa</option>
              <option value="MEDIA" ${task.prioridade === 'MEDIA' ? 'selected' : ''}>Média</option>
              <option value="ALTA" ${task.prioridade === 'ALTA' ? 'selected' : ''}>Alta</option>
            </select>
          </label>
          <label class="meeting-task-badge">
            Canal:
            <select data-task-field="canal" data-task-idx="${idx}">
              <option value="">—</option>
              <option value="INSTAGRAM" ${task.canal === 'INSTAGRAM' ? 'selected' : ''}>Instagram</option>
              <option value="YOUTUBE" ${task.canal === 'YOUTUBE' ? 'selected' : ''}>YouTube</option>
              <option value="TIKTOK" ${task.canal === 'TIKTOK' ? 'selected' : ''}>TikTok</option>
              <option value="LINKEDIN" ${task.canal === 'LINKEDIN' ? 'selected' : ''}>LinkedIn</option>
              <option value="WHATSAPP" ${task.canal === 'WHATSAPP' ? 'selected' : ''}>WhatsApp</option>
              <option value="EMAIL" ${task.canal === 'EMAIL' ? 'selected' : ''}>Email</option>
              <option value="SITE" ${task.canal === 'SITE' ? 'selected' : ''}>Site</option>
              <option value="EVENTO" ${task.canal === 'EVENTO' ? 'selected' : ''}>Evento</option>
            </select>
          </label>
        </div>
        ${task.descricao ? `<div class="meeting-task-descr">
          <textarea data-task-field="descricao" data-task-idx="${idx}" placeholder="Descrição (opcional)">${escapeHtml(task.descricao)}</textarea>
        </div>` : ''}
      </div>
    </div>
  `).join('')

  // Event listeners for task edits
  $$('[data-task-field]', list).forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.taskIdx)
      const field = input.dataset.taskField
      if (_selectedMeetingTasks[idx]) {
        _selectedMeetingTasks[idx][field] = input.value || undefined
      }
    })
  })

  // Checkboxes for selection
  $$('.meeting-task-check', list).forEach(check => {
    check.addEventListener('change', () => {
      const idx = parseInt(check.dataset.taskIdx)
      if (_selectedMeetingTasks[idx]) {
        _selectedMeetingTasks[idx]._checked = check.checked
      }
    })
  })

  wrap.hidden = false
}

$('#selectAllMeetingTasks')?.addEventListener('click', () => {
  const allChecked = $$('.meeting-task-check').every(c => c.checked)
  $$('.meeting-task-check').forEach(c => { c.checked = !allChecked; c.dispatchEvent(new Event('change')) })
})

$('#createSelectedTasksBtn')?.addEventListener('click', async () => {
  const teamCheckboxes = $$('.meeting-team-checkbox:checked')
  const selectedTeamIds = Array.from(teamCheckboxes).map(cb => cb.value)

  if (!selectedTeamIds.length) {
    toast('Selecione pelo menos uma equipe.', 'error')
    return
  }

  const selectedTasks = _selectedMeetingTasks.filter(t => t._checked)
  if (!selectedTasks.length) {
    toast('Selecione pelo menos uma tarefa.', 'error')
    return
  }

  const btn = $('#createSelectedTasksBtn')
  btn.disabled = true
  btn.textContent = '⏳ Criando…'

  let created = 0
  try {
    for (const task of selectedTasks) {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          titulo: task.titulo,
          descricao: task.descricao,
          prioridade: task.prioridade || 'MEDIA',
          canal: task.canal,
          team_ids: selectedTeamIds,
        }),
      })
      created++
    }
    toast(`${created} tarefa${created > 1 ? 's' : ''} criada${created > 1 ? 's' : ''}.`, 'success')
    // Reset form
    $('#meetingContext').value = ''
    $('#meetingTranscript').value = ''
    $('#meetingResultsWrap').hidden = true
    updateMeetingCharCount()
  } catch (err) {
    toast(`Erro ao criar tarefas: ${err.message}`, 'error')
  } finally {
    btn.disabled = false
    btn.textContent = '✓ Criar tarefas selecionadas'
  }
})

/* ── Section reveal on scroll (IntersectionObserver) ───────────── */
const _revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); _revealObserver.unobserve(en.target) } })
}, { threshold: 0.08 })
function observeReveals(root = document) {
  $$('.reveal:not(.is-visible)', root).forEach(el => _revealObserver.observe(el))
}

/* ══════════════════════════════════════════════════════════════════
   ── EVENT OPERATION PANEL (Checklist Pré/Intra/Pós Evento) ──────
   ══════════════════════════════════════════════════════════════════ */
let _eopEventId   = null
let _eopItems     = []
let _eopFaseTab   = 'ALL'
let _eopMyFilter  = false

async function openEventOpPanel(eventId) {
  const ev = (calState.events || []).find(e => e.id === eventId)
  if (!ev) return

  _eopEventId  = eventId
  _eopFaseTab  = 'ALL'
  _eopMyFilter = false

  // Populate header
  const cor = ev.cor || '#16a34a'
  $('#eopColorDot').style.background = cor

  // Cover thumbnail
  const coverThumb = $('#eopCoverThumb')
  if (coverThumb) {
    if (ev.cover_url) {
      coverThumb.style.backgroundImage = `url(${JSON.stringify(ev.cover_url)})`
      coverThumb.hidden = false
    } else {
      coverThumb.hidden = true
    }
  }

  $('#eopTitle').textContent = ev.titulo
  const parts = []
  if (ev.data)  parts.push(new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }))
  if (ev.hora)  parts.push('às ' + ev.hora)
  if (ev.local) parts.push('📍 ' + ev.local)
  if (ev.tipo_transmissao) parts.push(TRANSMISSAO_LABELS[ev.tipo_transmissao] || ev.tipo_transmissao)
  $('#eopMeta').innerHTML = parts.map((p, i) =>
    i === parts.length - 1 && ev.tipo_transmissao && p === (TRANSMISSAO_LABELS[ev.tipo_transmissao] || ev.tipo_transmissao)
      ? `<span class="eop-transmissao-badge eop-tx-${ev.tipo_transmissao}">${escapeHtml(p)}</span>`
      : escapeHtml(p)
  ).join(' · ')

  // Reset filter state
  $('#eopMyDeptFilter').checked = false
  $$('.eop-tab').forEach(t => t.classList.toggle('active', t.dataset.fase === 'ALL'))

  // Show panel
  const overlay = $('#eventOpOverlay')
  overlay.hidden = false
  requestAnimationFrame(() => overlay.classList.add('is-open'))

  // Admin visibility
  $$('.admin-only', $('#eventOpPanel')).forEach(el => el.classList.toggle('hidden-non-admin', !isAdmin()))

  await reloadEopItems()
}

async function reloadEopItems() {
  if (!_eopEventId) return
  try {
    _eopItems = await api('/events/' + _eopEventId + '/checklist')
    renderEopChecklist()
  } catch (err) { toast(err.message, 'error') }
}

function renderEopChecklist() {
  const wrap   = $('#eopChecklistWrap')
  if (!wrap) return

  const userId     = state.user?.id || state.user?.sub
  const userDept   = state.user?.departamento || state.user?.cargo || ''

  let items = _eopItems
  if (_eopFaseTab !== 'ALL') items = items.filter(i => i.fase === _eopFaseTab)
  if (_eopMyFilter && userDept) items = items.filter(i => !i.departamento || i.departamento.toLowerCase() === userDept.toLowerCase())

  // Progress
  const totalAll = _eopItems.length
  const doneAll  = _eopItems.filter(i => i.feito).length
  const pct      = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0
  $('#eopProgressFill').style.width = pct + '%'
  $('#eopProgressLabel').textContent = totalAll > 0 ? `${doneAll} de ${totalAll} itens concluídos (${pct}%)` : 'Sem itens'

  if (!items.length) {
    wrap.innerHTML = `<div class="eop-empty">${_eopFaseTab === 'ALL' ? 'Nenhum item no checklist deste evento ainda.' : 'Nenhum item nesta fase.'}<br><span style="font-size:.78rem;color:var(--text-dim)">Use o formulário abaixo para adicionar (somente administradores).</span></div>`
    return
  }

  const FASE_LABELS = { PRE: '📋 Pré-evento', INTRA: '⚡ Intra-evento', POS: '✅ Pós-evento' }
  const FASE_ORDER  = ['PRE', 'INTRA', 'POS']
  const groups      = {}
  FASE_ORDER.forEach(f => { groups[f] = [] })
  items.forEach(i => { (groups[i.fase] ??= []).push(i) })

  const fasesToShow = _eopFaseTab === 'ALL' ? FASE_ORDER : [_eopFaseTab]
  wrap.innerHTML = fasesToShow.map(fase => {
    const fItems = groups[fase] || []
    if (!fItems.length && _eopFaseTab !== 'ALL') return `<div class="eop-empty">Nenhum item nesta fase.</div>`
    if (!fItems.length) return ''
    const doneF = fItems.filter(i => i.feito).length
    return `
      <div class="eop-phase-group">
        <p class="eop-phase-label">
          ${FASE_LABELS[fase] || fase}
          <span class="eop-phase-count">${doneF}/${fItems.length}</span>
        </p>
        ${fItems.map(item => {
          const isMine = item.responsavel_id === userId
          const prazoLabel = item.prazo ? new Date(item.prazo).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
          const isOverdue  = item.prazo && !item.feito && new Date(item.prazo) < new Date()
          const feitoPorUser = item.feito_por ? (state.users || []).find(u => u.id === item.feito_por) : null
          return `<div class="eop-item ${item.feito ? 'done' : ''} ${isMine ? 'mine' : ''}" data-item-id="${item.id}">
            <button class="eop-check ${item.feito ? 'checked' : ''}" data-check="${item.id}" title="${item.feito ? 'Desmarcar' : 'Marcar como feito'}">
              ${item.feito ? '✓' : ''}
            </button>
            <div class="eop-item-body">
              <div class="eop-item-text ${item.feito ? 'done-text' : ''}">${escapeHtml(item.texto)}</div>
              <div class="eop-item-badges">
                ${item.departamento ? `<span class="eop-badge dept">${escapeHtml(item.departamento)}</span>` : ''}
                ${prazoLabel ? `<span class="eop-badge prazo ${isOverdue ? 'overdue' : ''}">📅 ${prazoLabel}</span>` : ''}
                ${item.feito && feitoPorUser ? `<span class="eop-badge feito-por">✓ ${escapeHtml(feitoPorUser.nome)}</span>` : ''}
              </div>
            </div>
            ${isAdmin() ? `<button class="eop-item-del" data-del="${item.id}" title="Remover">×</button>` : ''}
          </div>`
        }).join('')}
      </div>`
  }).join('')

  // Events
  $$('.eop-check', wrap).forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const itemId = btn.dataset.check
      const item   = _eopItems.find(i => i.id === itemId)
      if (!item) return
      try {
        await api('/events/' + _eopEventId + '/checklist/' + itemId, {
          method: 'PATCH', body: JSON.stringify({ feito: !item.feito }),
        })
        await reloadEopItems()
      } catch (err) { toast(err.message, 'error') }
    })
  )
  $$('.eop-item-del', wrap).forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      if (!await confirmDialog('Remover este item do checklist?')) return
      try {
        await api('/events/' + _eopEventId + '/checklist/' + btn.dataset.del, { method: 'DELETE' })
        await reloadEopItems()
        toast('Item removido.', 'success')
      } catch (err) { toast(err.message, 'error') }
    })
  )
}

// Phase tab clicks
$$('.eop-tab').forEach(tab => tab.addEventListener('click', () => {
  _eopFaseTab = tab.dataset.fase
  $$('.eop-tab').forEach(t => t.classList.toggle('active', t === tab))
  renderEopChecklist()
}))

// "My dept" filter
$('#eopMyDeptFilter')?.addEventListener('change', e => {
  _eopMyFilter = e.target.checked
  renderEopChecklist()
})

// Add item
$('#eopAddBtn')?.addEventListener('click', async () => {
  const texto = $('#eopAddTexto')?.value.trim()
  if (!texto || !_eopEventId) { toast('Informe o texto do item.', 'error'); return }
  try {
    await api('/events/' + _eopEventId + '/checklist', {
      method: 'POST',
      body: JSON.stringify({
        fase:        $('#eopAddFase').value,
        texto,
        departamento: $('#eopAddDept').value.trim() || undefined,
        prazo:        $('#eopAddPrazo').value ? new Date($('#eopAddPrazo').value).toISOString() : undefined,
      }),
    })
    $('#eopAddTexto').value = ''; $('#eopAddDept').value = ''; $('#eopAddPrazo').value = ''
    await reloadEopItems()
    toast('Item adicionado.', 'success')
  } catch (err) { toast(err.message, 'error') }
})
$('#eopAddTexto')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#eopAddBtn').click() } })

// Quick add buttons for common deliverables
$$('.eop-quick-btn[data-quick-add-tipo]').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!_eopEventId) return
    const tipo = btn.dataset.quickAddTipo
    const fase = btn.dataset.quickAddFase
    try {
      await api('/events/' + _eopEventId + '/checklist', {
        method: 'POST',
        body: JSON.stringify({ fase, texto: tipo, tipo_entregavel: tipo }),
      })
      await reloadEopItems()
      toast(`${tipo} adicionado(a).`, 'success')
    } catch (err) { toast(err.message, 'error') }
  })
})

// Template button
$('#eopTemplateBtn')?.addEventListener('click', async () => {
  const templates = {
    'Culto/Domingo': [
      { fase: 'PRE', texto: 'Arte de divulgação', tipo: 'Arte' },
      { fase: 'PRE', texto: 'Story de convite', tipo: 'Story' },
      { fase: 'INTRA', texto: 'Cobertura fotográfica', tipo: 'Fotografia' },
      { fase: 'POS', texto: 'Post retrospectiva', tipo: 'Post retrospectiva' },
    ],
    'Evento Especial': [
      { fase: 'PRE', texto: 'Arte de divulgação', tipo: 'Arte' },
      { fase: 'PRE', texto: 'Reel de convite', tipo: 'Video/Reel de convite' },
      { fase: 'PRE', texto: 'Story de convite', tipo: 'Story' },
      { fase: 'PRE', texto: 'Banner para site', tipo: 'Banner' },
      { fase: 'PRE', texto: 'Email de convite', tipo: 'Texto/Email' },
      { fase: 'INTRA', texto: 'Cobertura fotográfica', tipo: 'Fotografia' },
      { fase: 'INTRA', texto: 'Gravação de vídeo', tipo: 'Vídeo' },
      { fase: 'INTRA', texto: 'Stories ao vivo', tipo: 'Story ao vivo' },
      { fase: 'INTRA', texto: 'Live stream', tipo: 'Live stream' },
      { fase: 'POS', texto: 'Video highlight', tipo: 'Video Highlight' },
      { fase: 'POS', texto: 'Reel de retrospectiva', tipo: 'Reel retrospectiva' },
      { fase: 'POS', texto: 'Post de retrospectiva', tipo: 'Post retrospectiva' },
    ],
    'Conferência': [
      { fase: 'PRE', texto: 'Arte de divulgação', tipo: 'Arte' },
      { fase: 'PRE', texto: 'Reel de convite', tipo: 'Video/Reel de convite' },
      { fase: 'PRE', texto: 'Stories de convite', tipo: 'Story' },
      { fase: 'PRE', texto: 'Banner para site', tipo: 'Banner' },
      { fase: 'PRE', texto: 'Email de convite', tipo: 'Texto/Email' },
      { fase: 'PRE', texto: 'Comunicado via WhatsApp', tipo: 'Texto/Email' },
      { fase: 'INTRA', texto: 'Cobertura fotográfica', tipo: 'Fotografia' },
      { fase: 'INTRA', texto: 'Gravação completa', tipo: 'Vídeo' },
      { fase: 'INTRA', texto: 'Stories ao vivo', tipo: 'Story ao vivo' },
      { fase: 'INTRA', texto: 'Live stream principal', tipo: 'Live stream' },
      { fase: 'INTRA', texto: 'Capturas para reels', tipo: 'Capturas/Reels' },
      { fase: 'POS', texto: 'Video highlight 1', tipo: 'Video Highlight' },
      { fase: 'POS', texto: 'Video highlight 2', tipo: 'Video Highlight' },
      { fase: 'POS', texto: 'Reel de melhores momentos', tipo: 'Reel retrospectiva' },
      { fase: 'POS', texto: 'Post de retrospectiva', tipo: 'Post retrospectiva' },
      { fase: 'POS', texto: 'Relatório de métricas', tipo: 'Relatório de métricas' },
    ],
  }

  const choice = await confirmDialogWithChoice('Selecione um template:', Object.keys(templates))
  if (!choice || !_eopEventId) return

  const items = templates[choice] || []
  let added = 0
  for (const item of items) {
    try {
      await api('/events/' + _eopEventId + '/checklist', {
        method: 'POST',
        body: JSON.stringify({ fase: item.fase, texto: item.texto, tipo_entregavel: item.tipo }),
      })
      added++
    } catch (err) {
      console.error('Erro ao adicionar item:', err)
    }
  }
  if (added > 0) {
    await reloadEopItems()
    toast(`${added} itens adicionados do template.`, 'success')
  }
})

// Helper for template choice dialog
function confirmDialogWithChoice(message, choices) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog')
    dlg.className = 'confirm-dialog'
    dlg.innerHTML = `
      <div class="confirm-body">
        <h3>${escapeHtml(message)}</h3>
        <div style="margin:16px 0;display:flex;flex-direction:column;gap:8px">
          ${choices.map((c, i) => `<button type="button" class="btn-outline choice-btn" data-choice-idx="${i}" style="text-align:left;padding:10px;border-radius:var(--radius)">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn-ghost" id="choiceCancelBtn">Cancelar</button>
        </div>
      </div>`
    function done(val) { dlg.close(); dlg.remove(); resolve(val) }
    dlg.querySelectorAll('.choice-btn').forEach(btn =>
      btn.addEventListener('click', () => done(choices[+btn.dataset.choiceIdx]), { once: true })
    )
    dlg.querySelector('#choiceCancelBtn').addEventListener('click', () => done(null), { once: true })
    dlg.addEventListener('cancel', () => resolve(null), { once: true })
    document.body.appendChild(dlg)
    dlg.showModal()
  })
}

// Close panel
function closeEventOpPanel() {
  const overlay = $('#eventOpOverlay')
  if (!overlay) return
  overlay.classList.remove('is-open')
  setTimeout(() => { overlay.hidden = true }, 300)
  _eopEventId = null
}
$('#closeEventOpBtn')?.addEventListener('click', closeEventOpPanel)
$('#eventOpBackdrop')?.addEventListener('click', closeEventOpPanel)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#eventOpOverlay')?.hidden) closeEventOpPanel() })

// Edit button inside panel → open the form dialog
$('#eopEditBtn')?.addEventListener('click', () => {
  const ev = (calState.events || []).find(e => e.id === _eopEventId)
  if (ev) { closeEventOpPanel(); setTimeout(() => openEventDialog(ev), 100) }
})

// openCalendarItem e openMapaItem já foram atualizados acima para usar openEventOpPanel.

/* ══════════════════════════════════════════════════════════════════
   ── ENHANCED BRIEFING → TASK CONVERSION ─────────────────────────
   ══════════════════════════════════════════════════════════════════ */
function briefingConvertDialogFull(briefing) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog')
    dlg.className = 'bf-convert-dialog'

    const camps = state.campaigns || []
    const teams = state.teams     || []
    const users = state.users     || []

    // Pre-fill from briefing
    const defaultTitulo = `${briefing.tipo || ''} — ${briefing.nome || ''}`.replace(/^ — |— $/, '').slice(0, 200)
    const defaultCanal  = briefing.canal || ''
    const defaultDesc   = briefing.descricao || ''
    const defaultPrazo  = briefing.data_evento ? new Date(briefing.data_evento).toISOString().slice(0, 10) : ''
    const defaultTipo   = briefing.tipo || ''

    dlg.innerHTML = `
      <div class="bf-dlg-header">
        <h3>Converter briefing em tarefa</h3>
        <button type="button" id="bfDlgClose" class="icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="bf-dlg-body">
        <div class="bf-dlg-row single">
          <div class="bf-field">
            <label>Título da tarefa *</label>
            <input type="text" id="bfTitulo" value="${escapeHtml(defaultTitulo)}" maxlength="200" required />
          </div>
        </div>
        <div class="bf-dlg-row">
          <div class="bf-field">
            <label>Prioridade</label>
            <select id="bfPrioridade">
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA" selected>Média</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>
          <div class="bf-field">
            <label>Canal</label>
            <select id="bfCanal">
              <option value="">— Nenhum —</option>
              <option value="INSTAGRAM" ${defaultCanal==='INSTAGRAM'?'selected':''}>Instagram</option>
              <option value="YOUTUBE"   ${defaultCanal==='YOUTUBE'?'selected':''}>YouTube</option>
              <option value="TIKTOK"    ${defaultCanal==='TIKTOK'?'selected':''}>TikTok</option>
              <option value="LINKEDIN"  ${defaultCanal==='LINKEDIN'?'selected':''}>LinkedIn</option>
              <option value="WHATSAPP"  ${defaultCanal==='WHATSAPP'?'selected':''}>WhatsApp</option>
              <option value="SITE"      ${defaultCanal==='SITE'?'selected':''}>Site</option>
              <option value="EMAIL"     ${defaultCanal==='EMAIL'?'selected':''}>E-mail</option>
              <option value="EVENTO"    ${defaultCanal==='EVENTO'?'selected':''}>Evento</option>
              <option value="APRESENTACAO" ${defaultCanal==='APRESENTACAO'?'selected':''}>Apresentação</option>
              <option value="OUTRO"     ${defaultCanal==='OUTRO'?'selected':''}>Outro</option>
            </select>
          </div>
        </div>
        <div class="bf-dlg-row">
          <div class="bf-field">
            <label>Tipo de tarefa</label>
            <input type="text" id="bfTipo" value="${escapeHtml(defaultTipo)}" maxlength="100" />
          </div>
          <div class="bf-field">
            <label>Solicitante</label>
            <input type="text" id="bfSolicitante" value="${escapeHtml(briefing.nome || '')}" maxlength="100" />
          </div>
        </div>
        <div class="bf-dlg-row">
          <div class="bf-field">
            <label>Início planejado</label>
            <input type="date" id="bfInicio" />
          </div>
          <div class="bf-field">
            <label>Prazo</label>
            <input type="date" id="bfPrazo" value="${defaultPrazo}" />
          </div>
        </div>
        <div class="bf-dlg-row single">
          <div class="bf-field">
            <label>Campanha</label>
            <select id="bfCampSel">
              <option value="">— Sem campanha —</option>
              ${camps.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="bf-dlg-row single">
          <div class="bf-field">
            <label>Equipes *</label>
            <div class="chip-picker" id="bfTeamPicker">
              <div class="chip-picker-chips" id="bfTeamChips"></div>
              <div class="chip-picker-addrow">
                <input type="text" id="bfTeamInput" class="chip-picker-input" placeholder="+ Adicionar equipe…" autocomplete="off" />
                <div class="chip-picker-dropdown" id="bfTeamDropdown" hidden></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bf-dlg-row single">
          <div class="bf-field">
            <label>Responsáveis</label>
            <div class="chip-picker" id="bfUserPicker">
              <div class="chip-picker-chips" id="bfUserChips"></div>
              <div class="chip-picker-addrow">
                <input type="text" id="bfUserInput" class="chip-picker-input" placeholder="+ Adicionar responsável…" autocomplete="off" />
                <div class="chip-picker-dropdown" id="bfUserDropdown" hidden></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bf-dlg-row single">
          <div class="bf-field">
            <label>Descrição</label>
            <textarea id="bfDescricao" rows="3" maxlength="2000">${escapeHtml(defaultDesc)}</textarea>
          </div>
        </div>
        <p id="bfDlgError" style="color:var(--danger);font-size:.82rem;margin:0" hidden></p>
      </div>
      <div class="bf-dlg-footer">
        <button type="button" id="bfDlgCancel" class="btn-ghost">Cancelar</button>
        <button type="button" id="bfDlgOk" class="btn-primary">✓ Criar tarefa</button>
      </div>`

    document.body.appendChild(dlg)
    dlg.showModal()

    // Chip pickers — reuse the app's pick infrastructure inline
    const bfTeamIds = [], bfUserIds = []
    function renderBfChips(chips, ids, items, idKey, labelKey, colorFn) {
      chips.innerHTML = ids.map(id => {
        const it = items.find(x => x[idKey] === id)
        if (!it) return ''
        const clr = colorFn(it)
        return `<span class="chip-tag" data-remove-id="${id}" style="--chip-color:${clr}">
          ${escapeHtml(it[labelKey] || it.nome || it.name || '')}
          <button type="button" class="chip-remove" aria-label="Remover">×</button>
        </span>`
      }).join('')
      chips.querySelectorAll('.chip-remove').forEach(btn =>
        btn.addEventListener('click', () => {
          const rid = btn.closest('.chip-tag').dataset.removeId
          const arr = chips === bfTeamChipsEl ? bfTeamIds : bfUserIds
          const idx = arr.indexOf(rid); if (idx > -1) arr.splice(idx, 1)
          renderBfChips(chips, arr, items, idKey, labelKey, colorFn)
        })
      )
    }
    const bfTeamChipsEl = dlg.querySelector('#bfTeamChips')
    const bfUserChipsEl = dlg.querySelector('#bfUserChips')

    function makeDropdown(inputEl, dropdownEl, items, idKey, labelKey, targetIds, chipsEl, colorFn) {
      inputEl.addEventListener('input', () => {
        const q = inputEl.value.toLowerCase()
        const matches = items.filter(x => (x[labelKey]||x.nome||x.name||'').toLowerCase().includes(q) && !targetIds.includes(x[idKey]))
        if (!matches.length) { dropdownEl.hidden = true; return }
        dropdownEl.innerHTML = matches.slice(0, 8).map(x =>
          `<div class="chip-dd-item" data-id="${x[idKey]}">${escapeHtml(x[labelKey]||x.nome||x.name||'')}</div>`
        ).join('')
        dropdownEl.hidden = false
        dropdownEl.querySelectorAll('.chip-dd-item').forEach(item =>
          item.addEventListener('click', () => {
            targetIds.push(item.dataset.id)
            inputEl.value = ''; dropdownEl.hidden = true
            renderBfChips(chipsEl, targetIds, items, idKey, labelKey, colorFn)
          })
        )
      })
      inputEl.addEventListener('keydown', e => { if (e.key === 'Escape') dropdownEl.hidden = true })
    }

    makeDropdown(
      dlg.querySelector('#bfTeamInput'), dlg.querySelector('#bfTeamDropdown'),
      teams, 'id', 'nome', bfTeamIds, bfTeamChipsEl,
      t => t.cor || '#E8743B'
    )
    makeDropdown(
      dlg.querySelector('#bfUserInput'), dlg.querySelector('#bfUserDropdown'),
      users, 'id', 'nome', bfUserIds, bfUserChipsEl,
      () => '#6366f1'
    )
    document.addEventListener('click', e => {
      if (!dlg.querySelector('#bfTeamPicker')?.contains(e.target)) dlg.querySelector('#bfTeamDropdown').hidden = true
      if (!dlg.querySelector('#bfUserPicker')?.contains(e.target)) dlg.querySelector('#bfUserDropdown').hidden = true
    }, { once: false })

    function done(val) { dlg.close(); dlg.remove(); resolve(val) }

    dlg.querySelector('#bfDlgOk').addEventListener('click', () => {
      const titulo = dlg.querySelector('#bfTitulo').value.trim()
      if (!titulo) { dlg.querySelector('#bfDlgError').textContent = 'O título é obrigatório.'; dlg.querySelector('#bfDlgError').hidden = false; return }
      if (!bfTeamIds.length) { dlg.querySelector('#bfDlgError').textContent = 'Adicione ao menos uma equipe.'; dlg.querySelector('#bfDlgError').hidden = false; return }
      const prazoVal = dlg.querySelector('#bfPrazo').value
      const inicioVal = dlg.querySelector('#bfInicio').value
      done({
        confirmed:            true,
        titulo,
        descricao:            dlg.querySelector('#bfDescricao').value.trim() || undefined,
        prioridade:           dlg.querySelector('#bfPrioridade').value,
        canal:                dlg.querySelector('#bfCanal').value || undefined,
        tipo_tarefa:          dlg.querySelector('#bfTipo').value.trim() || undefined,
        solicitante:          dlg.querySelector('#bfSolicitante').value.trim() || undefined,
        campaign_id:          dlg.querySelector('#bfCampSel').value || undefined,
        data_inicio_planejado: inicioVal ? new Date(inicioVal).toISOString() : undefined,
        data_fim_planejado:   prazoVal ? new Date(prazoVal).toISOString() : undefined,
        team_ids:             bfTeamIds,
        user_ids:             bfUserIds,
      })
    }, { once: true })
    dlg.querySelector('#bfDlgCancel').addEventListener('click', () => done({ confirmed: false }), { once: true })
    dlg.querySelector('#bfDlgClose').addEventListener('click',  () => done({ confirmed: false }), { once: true })
    dlg.addEventListener('cancel', () => resolve({ confirmed: false }), { once: true })
  })
}

// Override the old briefingConvertDialog to use the new full form
// (replaces the original function by name in the closure chain)
// The original is called from renderBriefings(); we override it here.
async function briefingConvertDialogFull_handler(bId) {
  // Ensure teams and users are loaded
  if (!state.teams.length) {
    try { state.teams = await api('/teams') } catch {}
  }
  if (!state.users.length) {
    try { state.users = await api('/users') } catch {}
  }
  if (!state.campaigns.length) {
    try { state.campaigns = await api('/campaigns') } catch {}
  }
  const briefing = (state._lastBriefings || []).find(b => b.id === bId) || { nome: 'este solicitante' }
  const result = await briefingConvertDialogFull(briefing)
  if (!result.confirmed) return

  try {
    // 1) Create the task with full details (teams, assignees, dates)
    const taskPayload = {
      titulo:               result.titulo,
      descricao:            result.descricao,
      prioridade:           result.prioridade,
      canal:                result.canal,
      tipo_tarefa:          result.tipo_tarefa,
      solicitante:          result.solicitante,
      campaign_id:          result.campaign_id,
      data_inicio_planejado: result.data_inicio_planejado,
      data_fim_planejado:   result.data_fim_planejado,
      team_ids:             result.team_ids,
      user_ids:             result.user_ids || [],
    }
    const newTask = await api('/tasks', { method: 'POST', body: JSON.stringify(taskPayload) })

    // 2) Mark briefing as converted, passing the pre-created task_id
    const bfBody = { status: 'CONVERTIDO', task_id: newTask.id }
    if (result.campaign_id) bfBody.campaign_id = result.campaign_id
    await api('/briefing/' + bId, { method: 'PATCH', body: JSON.stringify(bfBody) })

    toast('✓ Tarefa criada — clique para abrir', 'success', () => {
      navigate('tasks')
      setTimeout(() => openPanel(newTask.id), 300)
    })
    loadTasks()
    loadBriefings()
  } catch (err) { toast(err.message, 'error') }
}

// renderBriefings já foi atualizado diretamente acima para usar briefingConvertDialogFull_handler.

/* ══════════════════════════════════════════════════════════════════
   ── COMMAND PALETTE (Ctrl + K) ──────────────────────────────────
   ══════════════════════════════════════════════════════════════════ */
let _cmdSelectedIdx = -1

const CMD_ACTIONS = [
  { icon: '➕', title: 'Nova tarefa',      sub: 'Criar uma nova tarefa',           kbd: 'N', action: () => { $('#cmdPaletteDialog').close(); $('#newTaskBtn')?.click() } },
  { icon: '📊', title: 'Dashboard',         sub: 'Ir para o Dashboard',              kbd: '1', action: () => { $('#cmdPaletteDialog').close(); navigate('dashboard') } },
  { icon: '✅', title: 'Tarefas',           sub: 'Ver o quadro Kanban',              kbd: '2', action: () => { $('#cmdPaletteDialog').close(); navigate('tasks') } },
  { icon: '📣', title: 'Campanhas',         sub: 'Gerenciar campanhas',              kbd: '3', action: () => { $('#cmdPaletteDialog').close(); navigate('campaigns') } },
  { icon: '📅', title: 'Calendário',        sub: 'Ver o calendário de eventos',      kbd: '4', action: () => { $('#cmdPaletteDialog').close(); navigate('calendar') } },
  { icon: '🗺️', title: 'Mapa',             sub: 'Mapa de eventos',                  kbd: '5', action: () => { $('#cmdPaletteDialog').close(); navigate('mapa') } },
  { icon: '🌙', title: 'Alternar tema',     sub: 'Claro / Escuro',                   kbd: '',  action: () => { $('#cmdPaletteDialog').close(); toggleTheme() } },
]

function openCmdPalette() {
  const dlg = $('#cmdPaletteDialog')
  if (!dlg) return
  const inp = $('#cmdInput')
  inp.value = ''
  _cmdSelectedIdx = -1
  renderCmdResults('')
  dlg.showModal()
  requestAnimationFrame(() => inp.focus())
}

function renderCmdResults(q) {
  const res = $('#cmdResults')
  if (!res) return
  const ql = q.toLowerCase()

  // Filter actions
  const actions = CMD_ACTIONS.filter(a => !ql || a.title.toLowerCase().includes(ql) || a.sub.toLowerCase().includes(ql))

  // Filter tasks
  const tasks = !ql ? [] : (state.allTasks || [])
    .filter(t => t.titulo?.toLowerCase().includes(ql) || (t.descricao || '').toLowerCase().includes(ql))
    .slice(0, 6)

  if (!actions.length && !tasks.length) {
    res.innerHTML = '<div class="cmd-empty">Nenhum resultado para "<strong>' + escapeHtml(q) + '</strong>".</div>'
    return
  }

  let html = ''
  if (actions.length) {
    html += `<div class="cmd-section-label">Ações</div>`
    html += actions.map((a, i) =>
      `<div class="cmd-item" data-cmd-idx="${i}" role="option">
        <div class="cmd-item-icon">${a.icon}</div>
        <div class="cmd-item-text">
          <div class="cmd-item-title">${escapeHtml(a.title)}</div>
          <div class="cmd-item-sub">${escapeHtml(a.sub)}</div>
        </div>
        ${a.kbd ? `<kbd class="cmd-item-kbd">${a.kbd}</kbd>` : ''}
      </div>`
    ).join('')
  }
  if (tasks.length) {
    html += `<div class="cmd-section-label">Tarefas</div>`
    html += tasks.map((t, i) => {
      const sty = STATUS_STYLE[t.status] || {}
      return `<div class="cmd-item" data-task-id="${t.id}" role="option">
        <div class="cmd-item-icon" style="background:${sty.bg||'var(--surface-3)'};color:${sty.color||'var(--text)'}">✓</div>
        <div class="cmd-item-text">
          <div class="cmd-item-title">${escapeHtml(t.titulo)}</div>
          <div class="cmd-item-sub">${STATUS_LABELS[t.status] || t.status}${t.data_fim_planejado ? ' · ' + new Date(t.data_fim_planejado).toLocaleDateString('pt-BR') : ''}</div>
        </div>
      </div>`
    }).join('')
  }
  res.innerHTML = html

  _cmdSelectedIdx = -1
  $$('.cmd-item', res).forEach(el => {
    el.addEventListener('click', () => execCmdItem(el, actions))
    el.addEventListener('mouseenter', () => {
      $$('.cmd-item', res).forEach(x => x.classList.remove('selected'))
      el.classList.add('selected')
      _cmdSelectedIdx = Array.from(res.querySelectorAll('.cmd-item')).indexOf(el)
    })
  })
}

function execCmdItem(el, actions) {
  if (el.dataset.cmdIdx !== undefined) {
    actions[+el.dataset.cmdIdx]?.action()
  } else if (el.dataset.taskId) {
    $('#cmdPaletteDialog').close()
    navigate('tasks')
    setTimeout(() => openPanel(el.dataset.taskId), 200)
  }
}

$('#cmdInput')?.addEventListener('input', e => renderCmdResults(e.target.value))
$('#cmdInput')?.addEventListener('keydown', e => {
  const res   = $('#cmdResults')
  const items = $$('.cmd-item', res)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    _cmdSelectedIdx = Math.min(_cmdSelectedIdx + 1, items.length - 1)
    items.forEach((x, i) => x.classList.toggle('selected', i === _cmdSelectedIdx))
    items[_cmdSelectedIdx]?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    _cmdSelectedIdx = Math.max(_cmdSelectedIdx - 1, 0)
    items.forEach((x, i) => x.classList.toggle('selected', i === _cmdSelectedIdx))
    items[_cmdSelectedIdx]?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    const sel = items[_cmdSelectedIdx] || items[0]
    if (sel) execCmdItem(sel, CMD_ACTIONS.filter(a => !$('#cmdInput').value || a.title.toLowerCase().includes($('#cmdInput').value.toLowerCase())))
  } else if (e.key === 'Escape') {
    $('#cmdPaletteDialog').close()
  }
})

// Global keyboard shortcuts
document.addEventListener('keydown', e => {
  // Skip when inside input/textarea
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) {
    // Only Ctrl+K works in input context (it's a shortcut that overrides)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCmdPalette() }
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCmdPalette(); return }
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && isAdmin()) { e.preventDefault(); $('#newTaskBtn')?.click(); return }
  if (e.key === 'Escape') {
    if (!$('#cmdPaletteDialog')?.open) return
    $('#cmdPaletteDialog').close()
  }
})

/* ══════════════════════════════════════════════════════════════════
   ── MOBILE BOTTOM NAV ───────────────────────────────────────────
   ══════════════════════════════════════════════════════════════════ */
function initMobileBottomNav() {
  const nav = $('#mobileBottomNav')
  if (!nav) return
  nav.hidden = false

  $$('.mbn-item[data-view]', nav).forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.view))
  )
  $('#mbnNewTask')?.addEventListener('click', () => { if (isAdmin()) $('#newTaskBtn')?.click() })
  $('#mbnNotif')?.addEventListener('click', () => {
    const dd = $('#notifDropdown')
    if (dd) { dd.hidden = !dd.hidden; if (!dd.hidden) loadNotifications() }
  })
}

// navigate já foi atualizado diretamente acima para sincronizar o mobile bottom nav.

// Sync mobile notif badge with sidebar badge
const _notifBadgeObs = new MutationObserver(() => {
  const badge = $('#notifBadge')
  const mbnBadge = $('#mbnNotifBadge')
  if (!badge || !mbnBadge) return
  mbnBadge.hidden = badge.hidden
  mbnBadge.textContent = badge.textContent
})
if ($('#notifBadge')) _notifBadgeObs.observe($('#notifBadge'), { childList: true, characterData: true, subtree: true, attributes: true })

/* ══════════════════════════════════════════════════════════════════
   ── ENVIAR ATA DE REUNIÃO ────────────────────────────────────────
   ══════════════════════════════════════════════════════════════════ */
$('#sendAtaBtn')?.addEventListener('click', async () => {
  // Ensure users are loaded
  if (!state.users.length) {
    try { state.users = await api('/users') } catch {}
  }

  // Build pre-filled ata content from extracted tasks
  const tasks = _selectedMeetingTasks || []
  const context = $('#meetingContext')?.value.trim() || ''
  const defaultTitulo = context ? `Ata — ${context}` : `Ata de reunião`
  const defaultConteudo = [
    context ? `**Reunião:** ${context}` : '',
    `**Data:** ${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}`,
    '',
    '**Tarefas identificadas:**',
    ...tasks.filter(t => t._checked).map((t, i) => `${i+1}. ${t.titulo}${t.responsavel_sugerido ? ` (${t.responsavel_sugerido})` : ''}${t.prazo_sugerido ? ` — prazo: ${t.prazo_sugerido}` : ''}`),
    '',
    '**Observações adicionais:**',
    '',
  ].filter(l => l !== undefined).join('\n')

  const dlg = document.createElement('dialog')
  dlg.className = 'bf-convert-dialog'
  const users = (state.users || []).filter(u => !u.deleted_at)
  dlg.innerHTML = `
    <div class="bf-dlg-header">
      <h3>📄 Enviar Ata de Reunião</h3>
      <button type="button" id="_ataClose" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="bf-dlg-body">
      <div class="bf-field">
        <label>Título da ata</label>
        <input type="text" id="_ataTitulo" value="${escapeHtml(defaultTitulo)}" maxlength="200" />
      </div>
      <div class="bf-field">
        <label>Conteúdo</label>
        <textarea id="_ataConteudo" rows="10" maxlength="20000" style="font-family:monospace;font-size:.82rem">${escapeHtml(defaultConteudo)}</textarea>
      </div>
      <div class="bf-field">
        <label>Destinatários <span style="color:var(--text-muted);font-size:.75rem">(selecione quem deve receber a notificação)</span></label>
        <div class="ata-recipients" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
          ${users.map(u => `
            <label class="ata-recipient-chip">
              <input type="checkbox" class="ata-recip-check" value="${u.id}" />
              <div class="ata-recip-avatar" style="background:${getAvatarColor(u.nome)}">${getInitials(u.nome)}</div>
              <span>${escapeHtml(u.nome)}</span>
            </label>`).join('')}
        </div>
        ${!users.length ? '<p style="color:var(--text-muted);font-size:.82rem">Nenhum usuário cadastrado.</p>' : ''}
      </div>
      <p id="_ataError" style="color:var(--danger);font-size:.82rem;margin:0" hidden></p>
    </div>
    <div class="bf-dlg-footer">
      <button type="button" id="_ataCancel" class="btn-ghost">Cancelar</button>
      <button type="button" id="_ataOk" class="btn-primary">📤 Enviar ata</button>
    </div>`
  document.body.appendChild(dlg)
  dlg.showModal()

  function closeDlg() { dlg.close(); dlg.remove() }
  dlg.querySelector('#_ataClose').addEventListener('click', closeDlg, { once: true })
  dlg.querySelector('#_ataCancel').addEventListener('click', closeDlg, { once: true })
  dlg.addEventListener('cancel', closeDlg, { once: true })

  dlg.querySelector('#_ataOk').addEventListener('click', async () => {
    const titulo   = dlg.querySelector('#_ataTitulo').value.trim()
    const conteudo = dlg.querySelector('#_ataConteudo').value.trim()
    const recipients = Array.from(dlg.querySelectorAll('.ata-recip-check:checked')).map(c => c.value)
    const errEl = dlg.querySelector('#_ataError')

    if (!titulo)              { errEl.textContent = 'Informe o título da ata.'; errEl.hidden = false; return }
    if (!conteudo)            { errEl.textContent = 'O conteúdo não pode estar vazio.'; errEl.hidden = false; return }
    if (!recipients.length)   { errEl.textContent = 'Selecione ao menos um destinatário.'; errEl.hidden = false; return }

    const okBtn = dlg.querySelector('#_ataOk')
    okBtn.disabled = true; okBtn.textContent = '⏳ Enviando…'
    try {
      const res = await api('/meetings/minutes', {
        method: 'POST',
        body: JSON.stringify({ titulo, conteudo, recipient_ids: recipients }),
      })
      toast(`✓ Ata enviada para ${res.sent} pessoa${res.sent !== 1 ? 's' : ''}.`, 'success')
      closeDlg()
    } catch (err) {
      errEl.textContent = err.message; errEl.hidden = false
      okBtn.disabled = false; okBtn.textContent = '📤 Enviar ata'
    }
  }, { once: true })
})

/* ── Init ──────────────────────────────────────────────────────── */
if (state.token && state.user) showApp()
else showLogin()

// Post-init: mobile nav
document.addEventListener('DOMContentLoaded', () => {}, { once: true })
if (document.readyState !== 'loading') initMobileBottomNav()
else document.addEventListener('DOMContentLoaded', initMobileBottomNav, { once: true })
