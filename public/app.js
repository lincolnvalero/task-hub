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
  token:        localStorage.getItem(TOKEN_KEY),
  user:         JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
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
function toast(msg, type = 'info') {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  $('#toastContainer').appendChild(el)
  setTimeout(() => {
    el.classList.add('toast-out')
    el.addEventListener('animationend', () => el.remove(), { once:true })
  }, 4000)
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

/* ── Session ───────────────────────────────────────────────────── */
function saveSession(token, user) {
  state.token = token; state.user = user
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
function clearSession() {
  state.token = null; state.user = null
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
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
  if (view === 'dashboard') loadDashboard()
  if (view === 'tasks')     loadTasks()
  if (view === 'teams')     loadTeams()
  if (view === 'users')     loadUsers()
  if (view === 'briefings') loadBriefings()
  if (view === 'campaigns') loadCampaigns()
  if (view === 'map')       loadMap()
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
    saveSession(data.token, data.user); showApp()
  } catch (err) {
    $('#loginError').textContent = err.message
    $('#loginError').hidden = false
  }
})
$('#guestBtn').addEventListener('click', async () => {
  $('#loginError').hidden = true
  try {
    const data = await api('/auth/guest', { method:'POST' })
    saveSession(data.token, data.user); showApp()
  } catch (err) {
    $('#loginError').textContent = err.message
    $('#loginError').hidden = false
  }
})
$('#logoutBtn').addEventListener('click', () => { clearSession(); showLogin() })

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
    '#panelGdrive','#panelFrameio','#panelRoteiro']
    .forEach(sel => $(sel).disabled = !editable)
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
  $('#tTeam').innerHTML = state.teams.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('')
  $('#tUsers').innerHTML = state.users.filter(u=>u.role!=='GUEST')
    .map(u => `<option value="${u.id}">${escapeHtml(u.nome)} (${escapeHtml(u.email)})</option>`).join('')
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
  const body = {
    titulo:               $('#tTitulo').value.trim(),
    descricao:            $('#tDescricao').value.trim()||undefined,
    prioridade:           $('#tPrioridade').value,
    canal:                $('#tCanal').value||undefined,
    data_inicio_planejado: $('#tStartDate').value||undefined,
    data_fim_planejado:   $('#tPrazo').value||undefined,
    production_days:      isNaN(_prodDays) ? undefined : _prodDays,
    campaign_id:          $('#tCampaign').value || undefined,
    team_ids:             [$('#tTeam').value],
    user_ids:             Array.from($('#tUsers').selectedOptions).map(o=>o.value),
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
      <span class="tdp-task-title">${escapeHtml(t.titulo)}</span>
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
  $('#uSenhaLabel').hidden = isEdit
  $('#uSenha').required    = !isEdit
  $('#uSenha').value       = ''
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
  try {
    if (id) await api('/users/'+id, { method:'PATCH', body:JSON.stringify(body) })
    else { body.senha = $('#uSenha').value; await api('/users',{ method:'POST', body:JSON.stringify(body) }) }
    $('#userDialog').close()
    toast(id ? 'Usuário atualizado.' : 'Usuário criado.','success')
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
        <div class="gallery-card-title">${escapeHtml(t.titulo)}</div>
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
  const cellDays  = totalDays <= 30 ? 1 : totalDays <= 90 ? 7 : 30
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
// Timeline zoom (simple: reload with a note — full zoom requires more state)
$('#timelineZoomIn')?.addEventListener('click',  () => renderTimelineView())
$('#timelineZoomOut')?.addEventListener('click', () => renderTimelineView())

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
    renderChecklist(task.checklist||[], true)
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
    renderChecklist(task.checklist||[], true)
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
            <button class="approval-act ok"  data-approve="${a.id}">✓ Aprovar</button>
            <button class="approval-act fix" data-fix="${a.id}">↻ Pedir ajustes</button>
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
    nota = prompt('Descreva os ajustes necessários (opcional):') || undefined
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
    renderBriefings(data)
  } catch (err) { list.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>` }
}
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
        <span class="briefing-status-badge ${b.status}">${b.status}</span>
        <span>${escapeHtml(b.tipo)}</span>
        ${b.canal ? `<span>${escapeHtml(b.canal)}</span>` : ''}
        ${b.data_evento ? `<span>📅 ${new Date(b.data_evento).toLocaleDateString('pt-BR')}</span>` : ''}
        <span style="color:var(--text-dim)">${dt}</span>
      </div>
      <div class="briefing-item-desc">${escapeHtml(b.descricao.slice(0,200))}${b.descricao.length>200?'…':''}</div>
      ${isPendente ? `<div class="briefing-actions">
        <button class="btn-primary btn-sm" data-bf-approve="${b.id}">✓ Converter em tarefa</button>
        <button class="btn-ghost btn-sm" data-bf-reject="${b.id}">✕ Rejeitar</button>
      </div>` : ''}
    </div>`
  }).join('')
  $$('[data-bf-approve]', list).forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!await confirmDialog('Converter este briefing em tarefa? O status será marcado como CONVERTIDO.')) return
      try {
        await api('/briefing/'+btn.dataset.bfApprove, { method:'PATCH', body:JSON.stringify({ status:'CONVERTIDO' }) })
        toast('Briefing convertido.','success'); loadBriefings()
      } catch (err) { toast(err.message,'error') }
    })
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
    $('#cdpDescricao').value  = c.descricao || ''
    const tasks = c.tasks || []
    const done  = tasks.filter(t => t.status === 'CONCLUIDO').length
    $('#cdpStats').innerHTML = [
      { val: tasks.length, lbl: 'Tarefas' },
      { val: done,         lbl: 'Concluídas', cls:'success' },
      { val: (c.link_assets||[]).length, lbl: 'Assets' },
    ].map(s => `<div class="tdp-stat-item ${s.cls||''}"><div class="tdp-stat-val">${s.val}</div><div class="tdp-stat-lbl">${s.lbl}</div></div>`).join('')
    const ed = isAdmin()
    ;['#cdpDataEvento','#cdpLocal','#cdpDescricao'].forEach(s => $(s).disabled = !ed)
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
    <span class="tdp-task-title">${escapeHtml(t.titulo)}</span>
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

/* ── Map view (Leaflet + OpenStreetMap) ────────────────────────── */
let _leafletMap = null, _leafletLoaded = false
function ensureLeaflet() {
  return new Promise((resolve) => {
    if (window.L) { resolve(true); return }
    if (_leafletLoaded) { const t = setInterval(() => { if (window.L) { clearInterval(t); resolve(true) } }, 100); return }
    _leafletLoaded = true
    const css = document.createElement('link')
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}
async function loadMap() {
  try {
    if (!(state.allTasks || []).length) {
      const b = await api('/tasks/kanban')
      state.allTasks = b ? Object.values(b).flat() : []
    }
    if (!(state.campaigns || []).length) {
      try { const c = await api('/campaigns'); state.campaigns = Array.isArray(c) ? c : [] } catch {}
    }

    const tasks = Array.isArray(state.allTasks) ? state.allTasks : []
    const camps = Array.isArray(state.campaigns) ? state.campaigns : []

    // pontos com coordenadas (para o mapa interativo)
    const points = []
    tasks.forEach(t => { if (t && t.lat != null && t.lng != null) points.push({ kind:'tarefa', id:t.id, title:t.titulo, addr:t.local, lat:+t.lat, lng:+t.lng }) })
    camps.forEach(c => { if (c && c.lat != null && c.lng != null) points.push({ kind:'campanha', id:c.id, title:c.nome, addr:c.local, lat:+c.lat, lng:+c.lng }) })
    // itens com endereço (para a lista textual)
    const withAddr = [
      ...tasks.filter(t => t && t.local).map(t => ({ kind:'tarefa', id:t.id, title:t.titulo, addr:t.local })),
      ...camps.filter(c => c && c.local).map(c => ({ kind:'campanha', id:c.id, title:c.nome, addr:c.local })),
    ]

    const list = $('#mapList')
    if (list) {
      list.innerHTML = withAddr.length
        ? withAddr.map(p => `<div class="map-list-item" data-kind="${p.kind}" data-id="${p.id}">
            <svg class="map-list-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <div class="map-list-body"><div class="map-list-title">${escapeHtml(p.title)} <span class="muted" style="font-size:.75rem">· ${p.kind}</span></div>
            <div class="map-list-addr">${escapeHtml(p.addr || 'Sem endereço')}</div></div>
          </div>`).join('')
        : '<div class="empty-state">Nenhuma tarefa ou campanha com endereço definido. Adicione um <strong>Local</strong> (e opcionalmente coordenadas) ao criar/editar.</div>'
      $$('.map-list-item', list).forEach(el => el.addEventListener('click', () => {
        if (el.dataset.kind === 'tarefa') { navigate('tasks'); openPanel(el.dataset.id) }
        else openCampaignPanel(el.dataset.id)
      }))
    }

    // mapa interativo só quando há coordenadas
    const wrap = $('#mapWrap')
    if (!points.length) { if (wrap) wrap.hidden = true; return }
    if (wrap) wrap.hidden = false

    const ok = await ensureLeaflet()
    const canvas = $('#mapCanvas')
    if (!ok || !window.L || !canvas) { if (wrap) wrap.hidden = true; return }
    if (_leafletMap) { _leafletMap.remove(); _leafletMap = null }
    _leafletMap = window.L.map(canvas).setView([points[0].lat, points[0].lng], 11)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(_leafletMap)
    points.forEach(p => {
      window.L.marker([p.lat, p.lng]).addTo(_leafletMap)
        .bindPopup(`<strong>${escapeHtml(p.title)}</strong><br>${escapeHtml(p.addr || '')}`)
    })
    setTimeout(() => { try { _leafletMap && _leafletMap.invalidateSize() } catch {} }, 200)
  } catch (err) {
    toast('Não foi possível carregar o mapa: ' + (err?.message || err), 'error')
  }
}
$('#refreshMapBtn')?.addEventListener('click', loadMap)

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

/* ── Section reveal on scroll (IntersectionObserver) ───────────── */
const _revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); _revealObserver.unobserve(en.target) } })
}, { threshold: 0.08 })
function observeReveals(root = document) {
  $$('.reveal:not(.is-visible)', root).forEach(el => _revealObserver.observe(el))
}

/* ── Init ──────────────────────────────────────────────────────── */
if (state.token && state.user) showApp()
else showLogin()
