const API = window.location.origin
const TOKEN_KEY = 'taskhub_token'
const USER_KEY = 'taskhub_user'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user:  JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
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
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(body?.error?.message || body?.error || body?.message || res.statusText)
  return body
}

function showView(name) {
  $$('.view').forEach((el) => (el.hidden = true))
  $('#' + name + 'View').hidden = false
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
    showView('adminTasks')
    setNavActive('adminTasks')
    loadKanban('#adminKanban')
  } else {
    showView('user')
    loadKanban('#kanbanBoard')
  }
}

/* ---------- LOGIN ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  $('#loginError').hidden = true
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#email').value.trim(),
        senha: $('#senha').value,
      }),
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

/* ---------- NAV ADMIN ---------- */
$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view
    setNavActive(view)
    showView(view)
    if (view === 'adminTasks') loadKanban('#adminKanban')
    if (view === 'adminUsers') loadUsers()
  })
})

/* ---------- KANBAN ---------- */
const STATUS_LABELS = {
  BACKLOG: 'Backlog',
  A_FAZER: 'A fazer',
  EM_ANDAMENTO: 'Em andamento',
  REVISAO: 'Revisão',
  CONCLUIDO: 'Concluído',
}

async function loadKanban(target) {
  const el = $(target)
  el.innerHTML = '<p class="muted">Carregando...</p>'
  try {
    const board = await api('/tasks/kanban')
    el.innerHTML = ''
    for (const status of Object.keys(STATUS_LABELS)) {
      const col = document.createElement('div')
      col.className = 'column'
      const tasks = board[status] || []
      col.innerHTML =
        '<h3>' + STATUS_LABELS[status] + ' (' + tasks.length + ')</h3>' +
        tasks
          .map(
            (t) =>
              '<div class="task-card"><div class="title">' +
              escapeHtml(t.titulo) +
              '</div><div class="meta">' +
              (t.prioridade || '') +
              (t.data_fim_planejado ? ' · prazo ' + new Date(t.data_fim_planejado).toLocaleDateString('pt-BR') : '') +
              '</div></div>'
          )
          .join('')
      el.appendChild(col)
    }
  } catch (err) {
    el.innerHTML = '<p class="error">' + err.message + '</p>'
  }
}

/* ---------- USERS ---------- */
async function loadUsers() {
  const tbody = $('#userList')
  tbody.innerHTML = '<tr><td colspan="5" class="muted">Carregando...</td></tr>'
  try {
    const users = await api('/users')
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Nenhum usuário cadastrado.</td></tr>'
      return
    }
    tbody.innerHTML = users
      .map(
        (u) =>
          '<tr>' +
          '<td>' + escapeHtml(u.nome) + '</td>' +
          '<td>' + escapeHtml(u.email) + '</td>' +
          '<td>' + escapeHtml(u.cargo || '—') + '</td>' +
          '<td><span class="role-badge ' + u.role + '">' + u.role + '</span></td>' +
          '<td><button class="btn-ghost" data-edit="' + u.id + '">Editar</button>' +
          '<button class="btn-danger" data-delete="' + u.id + '">Excluir</button></td>' +
          '</tr>'
      )
      .join('')

    $$('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openUserDialog(users.find((u) => u.id === b.dataset.edit)))
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
  const dialog = $('#userDialog')
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
  dialog.showModal()
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
