import { Router } from 'express'
import { appState, bootId, resetAppState } from './state.js'
import {
  enqueueAdd,
  enqueueSelect,
  enqueueUnselect,
  enqueueReorder,
  queues,
  resetQueues,
} from './queue.js'
import {
  normalizeLimit,
  normalizeOffset,
  normalizeQuery,
  getAvailableItems,
  getSelectedItems,
  itemExists,
} from './items.js'

export const router = Router()

function parseId(value) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'backend is running',
  })
})

router.get('/state', (req, res) => {
  res.json({
    bootId,
    version: appState.version,
    resetCount: appState.resetCount,

    baseRange: appState.baseRange,
    addedCount: appState.addedIds.size,
    selectedCount: appState.selectedIds.size,

    queues: {
      addQueueSize: queues.addQueue.size,
      mutateQueueSize: queues.mutateQueue.size,
    },
  })
})

router.post('/debug/reset', (req, res) => {
  resetAppState()
  resetQueues()

  return res.json({
    ok: true,
    message: 'in-memory state has been reset',
  })
})

router.get('/items/available', (req, res) => {
  const query = normalizeQuery(req.query.query)
  const offset = normalizeOffset(req.query.offset)
  const limit = normalizeLimit(req.query.limit)

  const result = getAvailableItems({
    query,
    offset,
    limit,
  })

  return res.json({
    ok: true,
    ...result,
    query,
  })
})

router.get('/items/selected', (req, res) => {
  const query = normalizeQuery(req.query.query)
  const offset = normalizeOffset(req.query.offset)
  const limit = normalizeLimit(req.query.limit)

  const result = getSelectedItems({
    query,
    offset,
    limit,
  })

  return res.json({
    ok: true,
    ...result,
    query,
  })
})

router.get('/items/selected-all', (req, res) => {
  const query = normalizeQuery(req.query.query)

  const items = query
    ? appState.selectedOrder.filter((id) => String(id).includes(query))
    : appState.selectedOrder

  return res.json({
    ok: true,
    items,
    total: items.length,
    query,
  })
})

router.post('/items/add', (req, res) => {
  const id = parseId(req.body?.id)

  if (id == null) {
    return res.status(400).json({
      ok: false,
      error: 'id must be a positive integer',
    })
  }

  const inBaseRange =
    id >= appState.baseRange.start &&
    id <= appState.baseRange.end

  if (inBaseRange) {
    return res.status(400).json({
      ok: false,
      error: 'ID already exists in base range',
    })
  }

  if (appState.addedIds.has(id)) {
    return res.status(400).json({
      ok: false,
      error: 'ID already added',
    })
  }

  if (queues.addQueue.has(id)) {
    return res.status(400).json({
      ok: false,
      error: 'ID already queued for add',
    })
  }

  enqueueAdd(id)

  return res.json({
    ok: true,
    queued: true,
    type: 'add',
    id,
  })
})

router.post('/items/select', (req, res) => {
  const id = parseId(req.body?.id)

  if (id == null) {
    return res.status(400).json({
      ok: false,
      error: 'id must be a positive integer',
    })
  }

  if (!itemExists(id)) {
    return res.status(400).json({
      ok: false,
      error: 'item does not exist in base range or added items',
    })
  }

  enqueueSelect(id)

  return res.json({
    ok: true,
    queued: true,
    type: 'select',
    id,
  })
})

router.post('/items/unselect', (req, res) => {
  const id = parseId(req.body?.id)

  if (id == null) {
    return res.status(400).json({
      ok: false,
      error: 'id must be a positive integer',
    })
  }

  enqueueUnselect(id)

  return res.json({
    ok: true,
    queued: true,
    type: 'unselect',
    id,
  })
})

router.post('/items/reorder', (req, res) => {
  const orderedIdsRaw = req.body?.orderedIds

  if (!Array.isArray(orderedIdsRaw)) {
    return res.status(400).json({
      ok: false,
      error: 'orderedIds must be an array',
    })
  }

  const orderedIds = orderedIdsRaw.map(parseId)

  if (orderedIds.some((id) => id == null)) {
    return res.status(400).json({
      ok: false,
      error: 'orderedIds must contain only positive integers',
    })
  }

  enqueueReorder(orderedIds)

  return res.json({
    ok: true,
    queued: true,
    type: 'reorder',
    count: orderedIds.length,
  })
})