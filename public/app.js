const API          = window.location.origin
const TOKEN_KEY    = 'taskhub_token'
const USER_KEY     = 'taskhub_user'
const LIST_PAGE_SZ = 20

const STATUS_LABELS = {
  BACKLOG: 'Backlog', A_FAZER: 'A fazer',
  EM_ANDAMENTO: 'Em andamento', REVISAO: 'Revisão', CONCLUIDO: 'Concluído',
}
const STATUS_ORDER = ['BACKLOG','A_FAZER','EM_ANDAMENTO','REVISAO','CONCLUIDO']

const PRIORITY_LABELS = { BAIXA:'Baixa', MEDIA:'Média', ALTA:'Alta', URGENTE:'Urgente' }
const PRIORITY_ORDER  = { URGENTE:0, ALTA:1, MEDIA:2, BAIXA:3 }

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
  currentTaskId: null,
  filters:      { status:'', priority:'', teamId:'' },
  listSort:     { key:'data_fim_planejado', dir:'asc' },
  listPage:     1,
  listView:     'kanban',
  charts:       { status:null, teams:null },
  searchTO:     null,
  dragTaskId:   null,
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
    state.allTasks = Object.values(board).flat()
    renderKpiCards(metrics.resumo)
    renderChartStatus(metrics.tarefas_por_status)
    renderChartTeams(metrics.tarefas_por_equipe)
    renderUpcoming()
  } catch (err) { toast(err.message, 'error') }
}
$('#refreshDashBtn').addEventListener('click', loadDashboard)

function renderKpiCards(r) {
  $('#kpiGrid').innerHTML = [
    { label:'Tarefas ativas',     value: r.total_tarefas,           cls:'primary' },
    { label:'Eficiência no prazo', value: r.eficiencia_prazo_pct+'%', cls:'success' },
    { label:'Atrasadas',          value: r.tarefas_atrasadas,        cls:'danger'  },
    { label:'Pend. candidatura',  value: r.candidaturas_pendentes,   cls:''        },
  ].map(k => `
    <div class="kpi-card ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value ?? 0}</div>
    </div>`).join('')
}
function renderChartStatus(data) {
  const ctx = $('#chartStatus')
  if (!ctx) return
  if (state.charts.status) state.charts.status.destroy()
  const COLORS = { BACKLOG:'#6b7280', A_FAZER:'#6366f1', EM_ANDAMENTO:'#8b5cf6', REVISAO:'#f59e0b', CONCLUIDO:'#22c55e' }
  state.charts.status = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: data.map(d => STATUS_LABELS[d.status]||d.status),
      datasets:[{ data: data.map(d=>d.total), backgroundColor: data.map(d=>COLORS[d.status]||'#6366f1'), borderWidth:0, hoverOffset:8 }],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ color:'#e2e4ee', padding:16, font:{family:'Inter',size:12} } } },
    },
  })
}
function renderChartTeams(data) {
  const ctx = $('#chartTeams')
  if (!ctx) return
  if (state.charts.teams) state.charts.teams.destroy()
  state.charts.teams = new Chart(ctx, {
    type:'bar',
    data:{
      labels: data.map(d=>d.team),
      datasets:[{ data: data.map(d=>d.total), backgroundColor:'#6366f1', borderRadius:6, borderSkipped:false }],
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{ color:'#2d3040' }, ticks:{ color:'#7b8194', font:{family:'Inter'} } },
        y:{ grid:{ display:false },   ticks:{ color:'#e2e4ee', font:{family:'Inter'} } },
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
      <span class="upcoming-title">${escapeHtml(t.titulo)}</span>
      <span class="upcoming-meta">${deadlineChip(t.data_fim_planejado)}</span>
    </div>`).join('')
  $$('.upcoming-item').forEach(el => el.addEventListener('click', () => { navigate('tasks'); openPanel(el.dataset.id) }))
}

/* ── Tasks: load + filter ──────────────────────────────────────── */
async function loadTasks() {
  try {
    const promises = [api('/tasks/kanban')]
    if (!state.teams.length) promises.push(api('/teams').then(t => { state.teams = t }))
    const [board] = await Promise.all(promises)
    state.allTasks = Object.values(board).flat()
    applyFiltersAndRender()
    populateTeamFilter()
  } catch (err) { toast(err.message, 'error') }
}
function getFilteredTasks() {
  let t = state.allTasks
  const { status, priority, teamId } = state.filters
  if (status)   t = t.filter(x => x.status === status)
  if (priority) t = t.filter(x => x.prioridade === priority)
  if (teamId)   t = t.filter(x => (x.assignments||[]).some(a => a.team_id === teamId))
  return t
}
function applyFiltersAndRender() {
  state.listView === 'list' ? renderListView() : renderKanban()
}
function populateTeamFilter() {
  const sel = $('#filterTeam')
  const cur = sel.value
  sel.innerHTML = '<option value="">Equipe</option>' +
    state.teams.map(t => `<option value="${t.id}"${t.id===cur?' selected':''}>${escapeHtml(t.nome)}</option>`).join('')
}

/* ── Kanban render ─────────────────────────────────────────────── */
function renderKanban() {
  const board = $('#kanbanBoard')
  const filtered = getFilteredTasks()
  const byStatus = Object.fromEntries(STATUS_ORDER.map(s => [s,[]]))
  filtered.forEach(t => { if (byStatus[t.status]) byStatus[t.status].push(t) })
  board.innerHTML = ''
  for (const status of STATUS_ORDER) {
    const tasks = byStatus[status]
    const col = document.createElement('div')
    col.className = 'kanban-col'
    col.dataset.status = status
    col.innerHTML = `
      <div class="col-header">
        <span class="col-title">${STATUS_LABELS[status]}</span>
        <span class="col-count">${tasks.length}</span>
      </div>
      <div class="col-body"></div>`
    const body = col.querySelector('.col-body')
    if (tasks.length === 0) {
      body.innerHTML = '<div class="col-empty">Sem tarefas</div>'
    } else {
      tasks.forEach(t => body.appendChild(buildCard(t)))
    }
    if (isAdmin()) setupDropZone(col)
    board.appendChild(col)
  }
}
function buildCard(task) {
  const card = document.createElement('div')
  card.className = 'task-card'
  card.dataset.id       = task.id
  card.dataset.priority = task.prioridade
  card.draggable        = isAdmin()
  const avatars = (task.assignments||[]).filter(a=>a.user).slice(0,3).map(a => {
    const n = a.user.nome||'?'
    return `<span class="avatar-chip" style="background:${getAvatarColor(n)}" title="${escapeHtml(n)}">${getInitials(n)}</span>`
  }).join('')
  const commentN = (task.comments||[]).length
  card.innerHTML = `
    <div class="card-title">${escapeHtml(task.titulo)}</div>
    <div class="card-meta">
      <div style="display:flex;gap:4px;align-items:center">
        ${priorityChip(task.prioridade)}
        ${commentN ? `<span style="font-size:.7rem;color:var(--text-muted)">💬${commentN}</span>` : ''}
      </div>
      ${deadlineChip(task.data_fim_planejado)}
    </div>
    ${avatars ? `<div class="card-assignees" style="margin-top:8px">${avatars}</div>` : ''}`
  card.addEventListener('click', () => openPanel(task.id))
  if (isAdmin()) {
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
  tbody.innerHTML = page.length
    ? page.map(t => `<tr data-id="${t.id}">
        <td>${escapeHtml(t.titulo)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${priorityChip(t.prioridade)}</td>
        <td>${escapeHtml(t.assignments?.[0]?.user?.nome||'—')}</td>
        <td>${deadlineChip(t.data_fim_planejado)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="muted" style="text-align:center;padding:2rem">Nenhuma tarefa encontrada.</td></tr>'
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
$('#btnViewKanban').addEventListener('click', () => {
  state.listView = 'kanban'
  $('#btnViewKanban').classList.add('active'); $('#btnViewList').classList.remove('active')
  $('#kanbanBoard').hidden = false; $('#listViewWrap').hidden = true
  renderKanban()
})
$('#btnViewList').addEventListener('click', () => {
  state.listView = 'list'
  $('#btnViewList').classList.add('active'); $('#btnViewKanban').classList.remove('active')
  $('#kanbanBoard').hidden = true; $('#listViewWrap').hidden = false
  renderListView()
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
  state.listPage = 1; applyFiltersAndRender()
}))
$('#filterPriority').addEventListener('change', () => {
  state.filters.priority = $('#filterPriority').value; state.listPage=1; applyFiltersAndRender()
})
$('#filterTeam').addEventListener('change', () => {
  state.filters.teamId = $('#filterTeam').value; state.listPage=1; applyFiltersAndRender()
})

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
  statusSel.innerHTML = STATUS_ORDER.map(k =>
    `<option value="${k}"${task.status===k?' selected':''}>${STATUS_LABELS[k]}</option>`).join('')
  const ss = STATUS_STYLE[task.status]||{}
  Object.assign(statusSel.style, { background:ss.bg||'', color:ss.color||'', borderColor:ss.color||'' })

  const titleEl = $('#panelTitle')
  titleEl.textContent    = task.titulo
  titleEl.contentEditable = isAdmin() ? 'plaintext-only' : 'false'

  $('#panelPriority').value    = task.prioridade || 'MEDIA'
  $('#panelTipo').value        = task.tipo_tarefa || ''
  $('#panelStartDate').value   = toDateInput(task.data_inicio_planejado)
  $('#panelDueDate').value     = toDateInput(task.data_fim_planejado)
  $('#panelSolicitante').value = task.solicitante || ''
  $('#panelDescricao').value   = task.descricao || ''

  const editable = isAdmin()
  ;['#panelPriority','#panelTipo','#panelStartDate','#panelDueDate','#panelSolicitante','#panelDescricao']
    .forEach(sel => $(sel).disabled = !editable)
  $('#panelDeleteBtn').hidden = !editable

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

  renderComments(task.comments||[])
}
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
;[['#panelTipo','tipo_tarefa'],['#panelSolicitante','solicitante']].forEach(([sel,key]) => {
  $(sel).addEventListener('blur', () => { if (isAdmin()) patchCurrentTask({ [key]: $(sel).value.trim()||undefined }) })
})
;[['#panelStartDate','data_inicio_planejado'],['#panelDueDate','data_fim_planejado']].forEach(([sel,key]) => {
  $(sel).addEventListener('change', () => { if (isAdmin()) patchCurrentTask({ [key]: $(sel).value||undefined }) })
})
$('#panelDescricao').addEventListener('blur', () => {
  if (isAdmin()) patchCurrentTask({ descricao: $('#panelDescricao').value.trim()||undefined })
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
  $('#tTitulo').value=''; $('#tDescricao').value=''; $('#tPrioridade').value='MEDIA'; $('#tPrazo').value=''
  try {
    if (!state.teams.length) state.teams = await api('/teams')
    if (!state.users.length) state.users  = await api('/users')
  } catch (err) { toast(err.message,'error'); return }
  if (!state.teams.length) { toast('Crie ao menos uma equipe primeiro.','error'); navigate('teams'); return }
  $('#tTeam').innerHTML = state.teams.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('')
  $('#tUsers').innerHTML = state.users.filter(u=>u.role!=='GUEST')
    .map(u => `<option value="${u.id}">${escapeHtml(u.nome)} (${escapeHtml(u.email)})</option>`).join('')
  $('#taskDialog').showModal()
})
$('#cancelTaskBtn').addEventListener('click', () => $('#taskDialog').close())
$('#taskForm').addEventListener('submit', async e => {
  e.preventDefault()
  const body = {
    titulo:            $('#tTitulo').value.trim(),
    descricao:         $('#tDescricao').value.trim()||undefined,
    prioridade:        $('#tPrioridade').value,
    data_fim_planejado: $('#tPrazo').value||undefined,
    team_ids:          [$('#tTeam').value],
    user_ids:          Array.from($('#tUsers').selectedOptions).map(o=>o.value),
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
})

/* ── Init ──────────────────────────────────────────────────────── */
if (state.token && state.user) showApp()
else showLogin()
