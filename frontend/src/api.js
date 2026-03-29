const API_BASE = 'http://localhost:3001/api'

async function readJson(response) {
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'Request failed')
  }

  return data
}

async function get(path, paramsObj = null) {
  const url = new URL(`${API_BASE}${path}`)

  if (paramsObj) {
    for (const [key, value] of Object.entries(paramsObj)) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url.toString())
  return readJson(response)
}

async function post(path, body = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  return readJson(response)
}

export async function fetchState() {
  return get('/state')
}

export async function fetchAvailable({ query = '', offset = 0, limit = 20 }) {
  return get('/items/available', {
    query,
    offset,
    limit,
  })
}

export async function fetchSelected({ query = '', offset = 0, limit = 20 }) {
  return get('/items/selected', {
    query,
    offset,
    limit,
  })
}

export async function fetchSelectedAll({ query = '' } = {}) {
  return get('/items/selected-all', {
    query,
  })
}

export async function addItem(id) {
  return post('/items/add', { id })
}

export async function selectItem(id) {
  return post('/items/select', { id })
}

export async function unselectItem(id) {
  return post('/items/unselect', { id })
}

export async function reorderSelected(orderedIds) {
  return post('/items/reorder', { orderedIds })
}

export async function resetState() {
  return post('/debug/reset')
}