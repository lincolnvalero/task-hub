const API = window.location.origin
const TOKEN_KEY = 'taskhub_token'
const USER_KEY = 'taskhub_user'

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user:  JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  teams: [],
  users: [],
}

function saveSession(token, user) {
  state.token = token
  state.user  = user
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  state.token = null
  state.user  = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function api(path, options = {}) {
  const headers = {
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {}),
  }
  if (options.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(API + path, { ...options, headers })
  const text = await res.text()
  const body = text ? safeParse(text) : null
  if (res.status === 401) {
    clearSession()
    render()
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error || body?.message || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return body
}

function safeParse(t) { try { return JSON.parse(t) } catch { return null } }

function showView(name) {
  $$('.view').forEach((el) => (el.hidden = true))
  const view = $('#' + name + 'View')
  if (view) view.hidden = false
}

function setNavActive(view) {
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view))
}

function render() {
  const topbar = $('.topbar')
  if (!state.token || !state.user) {
    topbar.hidden = true
    showView('login')
    return
  }
  topbar.hidden = false
  $('#userBadge').textContent = state.user.nome + ' (' + state.user.role + ')'

  const isAdmin = state.user.role === 'ADMIN' || state.user.role === 'MANAGER'
  $('#adminNav').hidden = !isAdmin

  if (isAdmin) {
    setNavActive('adminTasks')
    showView('adminTasks')
    loadAdminKanban()
  } else {
    showView('user')
    loadKanban('#kanbanBoard', false)
  }
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  $('#loginError').hidden = true
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#email').value.trim(), senha: $('#senha').value }),
    })
    saveSession(data.token, data.user)
    render()
  } catch (err) {
    $('#loginError').textContent = err.message
    $('#loginError').hidden = false
  }
})

$('#guestBtn').addEventListener('click', async () => {
  $('#loginError').hidden = true
  try {
    const data = await api('/auth/guest', { method: 'POST' })
    saveSession(data.token, data.user)
    render()
  } catch (err) {
    $('#loginError').textContent = err.message
    $('#loginError').hidden = false
  }
})

$('#logoutBtn').addEventListener('click', () => {
  clearSession()
  render()
})

/* ============================================================
   NAVEGAÇÃO ADMIN
   ============================================================ */
$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view
    setNavActive(view)
    showView(view)
    if (view === 'adminTasks') loadAdminKanban()
    if (view === 'adminTeams') loadTeams()
    if (view === 'adminUsers') loadUsers()
  })
})

/* ============================================================
   KANBAN
   ============================================================ */
const STATUS_LABELS = {
  BACKLOG: 'Backlog',
  A_FAZER: 'A fazer',
  EM_ANDAMENTO: 'Em andamento',
  REVISAO: 'Revisão',
  CONCLUIDO: 'Concluído',
}

async function loadAdminKanban() { return loadKanban('#adminKanban', true) }

async function loadKanban(target, clickable) {
  const el = $(target)
  el.innerHTML = '<p class="muted">Carregando...</p>'
  try {
    const board = await api('/tasks/kanban')
    el.innerHTML = ''
    for (const status of Object.keys(STATUS_LABELS)) {
      const tasks = board[status] || []
      const col = document.createElement('div')
      col.className = 'column'
      col.innerHTML = '<h3>' + STATUS_LABELS[status] + ' (' + tasks.length + ')</h3>'
      for (const t of tasks) {
        const card = document.createElement('div')
        card.className = 'task-card'
        card.innerHTML =
          '<div class="title"><span class="priority ' + t.prioridade + '">' + t.prioridade + '</span>' +
          escapeHtml(t.titulo) + '</div>' +
          '<div class="meta">' +
          (t.data_fim_planejado ? 'prazo ' + new Date(t.data_fim_planejado).toLocaleDateString('pt-BR') : 'sem prazo') +
          '</div>'
        if (clickable) {
          card.addEventListener('click', () => openStatusDialog(t))
        }
        col.appendChild(card)
      }
      el.appendChild(col)
    }
  } catch (err) {
    el.innerHTML = '<p class="error">' + err.message + '</p>'
  }
}

/* ============================================================
   TAREFAS — criação e mudança de status
   ============================================================ */
$('#newTaskBtn').addEventListener('click', async () => {
  $('#taskFormError').hidden = true
  $('#tTitulo').value = ''
  $('#tDescricao').value = ''
  $('#tPrioridade').value = 'MEDIA'
  $('#tPrazo').value = ''

  try {
    if (state.teams.length === 0) await refreshTeams()
    if (state.users.length === 0) await refreshUsers()
  } catch (err) {
    $('#taskFormError').textContent = err.message
    $('#taskFormError').hidden = false
    return
  }

  if (state.teams.length === 0) {
    alert('Crie ao menos uma equipe antes de cadastrar uma tarefa.')
    setNavActive('adminTeams')
    showView('adminTeams')
    loadTeams()
    return
  }

  const teamSelect = $('#tTeam')
  teamSelect.innerHTML = state.teams.map((t) => '<option value="' + t.id + '">' + escapeHtml(t.nome) + '</option>').join('')

  const userSelect = $('#tUsers')
  userSelect.innerHTML = state.users
    .filter((u) => u.role !== 'GUEST')
    .map((u) => '<option value="' + u.id + '">' + escapeHtml(u.nome) + ' (' + escapeHtml(u.email) + ')</option>')
    .join('')

  $('#taskDialog').showModal()
})

$('#cancelTaskBtn').addEventListener('click', () => $('#taskDialog').close())

$('#taskForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const body = {
    titulo: $('#tTitulo').value.trim(),
    descricao: $('#tDescricao').value.trim() || undefined,
    prioridade: $('#tPrioridade').value,
    data_fim_planejado: $('#tPrazo').value || undefined,
    team_ids: [$('#tTeam').value],
    user_ids: Array.from($('#tUsers').selectedOptions).map((o) => o.value),
  }
  try {
    await api('/tasks', { method: 'POST', body: JSON.stringify(body) })
    $('#taskDialog').close()
    loadAdminKanban()
  } catch (err) {
    $('#taskFormError').textContent = err.message
    $('#taskFormError').hidden = false
  }
})

let currentTaskForStatus = null
function openStatusDialog(task) {
  currentTaskForStatus = task
  $('#statusTaskTitle').textContent = task.titulo
  const wrap = $('#statusOptions')
  wrap.innerHTML = Object.entries(STATUS_LABELS).map(([key, label]) =>
    '<button type="button" class="status-btn ' + (task.status === key ? 'current' : '') + '" data-status="' + key + '">' +
    label + (task.status === key ? ' (atual)' : '') + '</button>'
  ).join('')
  $$('.status-btn', wrap).forEach((b) => b.addEventListener('click', () => changeStatus(b.dataset.status)))
  $('#statusDialog').showModal()
}

async function changeStatus(newStatus) {
  if (!currentTaskForStatus) return
  try {
    const payload = { status: newStatus }
    if (newStatus === 'CONCLUIDO') payload.data_conclusao_efetiva = new Date().toISOString()
    await api('/tasks/' + currentTaskForStatus.id + '/status', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    $('#statusDialog').close()
    loadAdminKanban()
  } catch (err) {
    alert(err.message)
  }
}

$('#cancelStatusBtn').addEventListener('click', () => $('#statusDialog').close())

$('#deleteTaskBtn').addEventListener('click', async () => {
  if (!currentTaskForStatus) return
  if (!confirm('Excluir esta tarefa? Esta ação faz soft delete.')) return
  try {
    await api('/tasks/' + currentTaskForStatus.id, { method: 'DELETE' })
    $('#statusDialog').close()
    loadAdminKanban()
  } catch (err) {
    alert(err.message)
  }
})

async function refreshTeams() { state.teams = await api('/teams') }
async function refreshUsers() { state.users = await api('/users') }

/* ============================================================
   EQUIPES
   ============================================================ */
async function loadTeams() {
  const wrap = $('#teamList')
  wrap.innerHTML = '<p class="muted">Carregando...</p>'
  try {
    await refreshTeams()
    if (state.teams.length === 0) {
      wrap.innerHTML = '<div class="empty-state">Nenhuma equipe cadastrada. Clique em <strong>+ Nova equipe</strong> para começar.</div>'
      return
    }
    wrap.innerHTML = state.teams.map((t) => {
      const count = (t.collaborators || []).length
      return '<div class="team-row">' +
        '<div><strong>' + escapeHtml(t.nome) + '</strong>' +
        '<div class="meta">' + count + ' colaborador' + (count === 1 ? '' : 'es') + '</div></div>' +
        '<div>' +
        '<button class="btn-ghost" data-manage-team="' + t.id + '">Gerenciar membros</button>' +
        '<button class="btn-danger" data-delete-team="' + t.id + '">Excluir</button>' +
        '</div></div>'
    }).join('')
    $$('[data-manage-team]').forEach((b) =>
      b.addEventListener('click', () => openCollabDialog(b.dataset.manageTeam))
    )
    $$('[data-delete-team]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Excluir esta equipe?')) return
        await api('/teams/' + b.dataset.deleteTeam, { method: 'DELETE' })
        loadTeams()
      })
    )
  } catch (err) {
    wrap.innerHTML = '<p class="error">' + err.message + '</p>'
  }
}

$('#newTeamBtn').addEventListener('click', () => {
  $('#teamNome').value = ''
  $('#teamDialog').showModal()
})
$('#cancelTeamBtn').addEventListener('click', () => $('#teamDialog').close())

let currentTeamForCollabs = null
async function openCollabDialog(teamId) {
  currentTeamForCollabs = teamId
  const team = state.teams.find((t) => t.id === teamId)
  $('#collabTitle').textContent = 'Colaboradores · ' + (team?.nome || '')

  const wrap = $('#collabList')
  wrap.innerHTML = '<p class="muted">Carregando...</p>'
  $('#collabDialog').showModal()

  await refreshUsers()
  const memberIds = new Set((team?.collaborators || []).map((c) => c.user_id))

  wrap.innerHTML = state.users
    .filter((u) => u.role !== 'GUEST')
    .map((u) =>
      '<label>' +
      '<input type="checkbox" data-user="' + u.id + '" ' + (memberIds.has(u.id) ? 'checked' : '') + ' />' +
      escapeHtml(u.nome) + ' (' + escapeHtml(u.email) + ')' +
      '</label>'
    ).join('')

  $$('input[data-user]', wrap).forEach((cb) => {
    cb.addEventListener('change', async () => {
      const userId = cb.dataset.user
      try {
        if (cb.checked) {
          await api('/teams/' + teamId + '/collaborators', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
          })
        } else {
          await api('/teams/' + teamId + '/collaborators/' + userId, { method: 'DELETE' })
        }
      } catch (err) {
        alert(err.message)
        cb.checked = !cb.checked
      }
    })
  })
}
$('#closeCollabBtn').addEventListener('click', async () => {
  $('#collabDialog').close()
  await refreshTeams()
  loadTeams()
})
$('#teamForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  try {
    await api('/teams', { method: 'POST', body: JSON.stringify({ nome: $('#teamNome').value.trim() }) })
    $('#teamDialog').close()
    loadTeams()
  } catch (err) {
    alert(err.message)
  }
})

/* ============================================================
   USUÁRIOS
   ============================================================ */
async function loadUsers() {
  const tbody = $('#userList')
  tbody.innerHTML = '<tr><td colspan="5" class="muted">Carregando...</td></tr>'
  try {
    await refreshUsers()
    if (state.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Nenhum usuário cadastrado.</td></tr>'
      return
    }
    tbody.innerHTML = state.users.map((u) =>
      '<tr>' +
      '<td>' + escapeHtml(u.nome) + '</td>' +
      '<td>' + escapeHtml(u.email) + '</td>' +
      '<td>' + escapeHtml(u.cargo || '—') + '</td>' +
      '<td><span class="role-badge ' + u.role + '">' + u.role + '</span></td>' +
      '<td><button class="btn-ghost" data-edit="' + u.id + '">Editar</button>' +
      '<button class="btn-danger" data-delete="' + u.id + '">Excluir</button></td>' +
      '</tr>'
    ).join('')

    $$('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openUserDialog(state.users.find((u) => u.id === b.dataset.edit)))
    )
    $$('[data-delete]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Excluir este usuário?')) return
        await api('/users/' + b.dataset.delete, { method: 'DELETE' })
        loadUsers()
      })
    )
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="error">' + err.message + '</td></tr>'
  }
}

function openUserDialog(user) {
  const isEdit = !!user
  $('#userDialogTitle').textContent = isEdit ? 'Editar usuário' : 'Novo usuário'
  $('#userId').value      = user?.id ?? ''
  $('#uNome').value       = user?.nome ?? ''
  $('#uEmail').value      = user?.email ?? ''
  $('#uTelefone').value   = user?.telefone ?? ''
  $('#uCargo').value      = user?.cargo ?? ''
  $('#uIgreja').value     = user?.igreja ?? ''
  $('#uRole').value       = user?.role ?? 'COLLABORATOR'
  $('#uSenhaLabel').hidden = isEdit
  $('#uSenha').required    = !isEdit
  $('#uSenha').value       = ''
  $('#userFormError').hidden = true
  $('#userDialog').showModal()
}

$('#newUserBtn').addEventListener('click', () => openUserDialog(null))
$('#cancelUserBtn').addEventListener('click', () => $('#userDialog').close())

$('#userForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = $('#userId').value
  const body = {
    nome:     $('#uNome').value.trim(),
    email:    $('#uEmail').value.trim(),
    telefone: $('#uTelefone').value.trim() || undefined,
    cargo:    $('#uCargo').value.trim() || undefined,
    igreja:   $('#uIgreja').value.trim() || undefined,
    role:     $('#uRole').value,
  }
  try {
    if (id) {
      await api('/users/' + id, { method: 'PATCH', body: JSON.stringify(body) })
    } else {
      body.senha = $('#uSenha').value
      await api('/users', { method: 'POST', body: JSON.stringify(body) })
    }
    $('#userDialog').close()
    loadUsers()
  } catch (err) {
    $('#userFormError').textContent = err.message
    $('#userFormError').hidden = false
  }
})

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

render()
