import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addItem,
  fetchAvailable,
  fetchSelected,
  fetchSelectedAll,
  fetchState,
  reorderSelected,
  resetState,
  selectItem,
  unselectItem,
} from '../api'

const PAGE_SIZE = 20
const ENABLE_UI_LOGS = true

function uiLog(message, extra) {
  if (!ENABLE_UI_LOGS) return

  if (extra !== undefined) {
    console.log(`[UI] ${message}`, extra)
  } else {
    console.log(`[UI] ${message}`)
  }
}

export default function MainPage() {
  const [leftQuery, setLeftQuery] = useState('')
  const [rightQuery, setRightQuery] = useState('')
  const [newId, setNewId] = useState('')

  const [availableItems, setAvailableItems] = useState([])
  const [availableTotal, setAvailableTotal] = useState(0)
  const [availableOffset, setAvailableOffset] = useState(0)
  const [availableHasMore, setAvailableHasMore] = useState(false)
  const [availableLoading, setAvailableLoading] = useState(false)
  const [availableAutoLoadEnabled, setAvailableAutoLoadEnabled] = useState(false)

  const [selectedItems, setSelectedItems] = useState([])
  const [selectedTotal, setSelectedTotal] = useState(0)
  const [selectedOffset, setSelectedOffset] = useState(0)
  const [selectedHasMore, setSelectedHasMore] = useState(false)
  const [selectedLoading, setSelectedLoading] = useState(false)

  const [actionLoading, setActionLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const [error, setError] = useState('')
  const [addError, setAddError] = useState('')
  const [statusText, setStatusText] = useState('Готово')

  const [lastSeenVersion, setLastSeenVersion] = useState(null)
  const [lastSeenBootId, setLastSeenBootId] = useState(null)
  const [lastSeenResetCount, setLastSeenResetCount] = useState(null)

  const [isInitialized, setIsInitialized] = useState(false)

  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [isDraggingSelected, setIsDraggingSelected] = useState(false)

  const availableEndRef = useRef(null)
  const selectedEndRef = useRef(null)
  const availableListRef = useRef(null)

  // Сколько элементов available уже открыто на экране.
  const availableVisibleCountRef = useRef(PAGE_SIZE)

  const addValidation = useMemo(() => {
    const raw = String(newId).trim()

    if (!raw) {
      return {
        canAdd: false,
        message: '',
      }
    }

    const id = Number(raw)

    if (!Number.isInteger(id) || id <= 0) {
      return {
        canAdd: false,
        message: 'Введите положительный целый ID',
      }
    }

    if (id >= 1 && id <= 1_000_000) {
      return {
        canAdd: false,
        message: 'ID из базового диапазона уже существует',
      }
    }

    return {
      canAdd: true,
      message: '',
    }
  }, [newId])

  const canAdd = addValidation.canAdd
  const isSelectedFilterActive = rightQuery.trim() !== ''

  async function loadAvailable({
    offset = 0,
    append = false,
    query = leftQuery,
  } = {}) {
    setAvailableLoading(true)
    setError('')

    try {
      const data = await fetchAvailable({
        query,
        offset,
        limit: PAGE_SIZE,
      })

      setAvailableItems((prev) => (append ? [...prev, ...data.items] : data.items))
      setAvailableTotal(data.total)
      setAvailableOffset(offset)
      setAvailableHasMore(data.hasMore)

      uiLog('Загружен available', {
        query,
        offset,
        count: data.items.length,
        total: data.total,
        append,
      })
    } catch (err) {
      setError(err.message || 'Не удалось загрузить левый список')
      uiLog('Ошибка загрузки available', err)
    } finally {
      setAvailableLoading(false)
    }
  }

  async function reloadAvailableVisible(query = leftQuery) {
    const targetCount = availableVisibleCountRef.current
    const pagesToLoad = Math.ceil(targetCount / PAGE_SIZE)

    let mergedItems = []
    let total = 0
    let hasMore = false

    for (let page = 0; page < pagesToLoad; page += 1) {
      const offset = page * PAGE_SIZE

      const data = await fetchAvailable({
        query,
        offset,
        limit: PAGE_SIZE,
      })

      mergedItems = [...mergedItems, ...data.items]
      total = data.total
      hasMore = data.hasMore

      if (!data.hasMore) {
        break
      }
    }

    setAvailableItems(mergedItems)
    setAvailableTotal(total)
    setAvailableOffset(Math.max(0, mergedItems.length - PAGE_SIZE))
    setAvailableHasMore(hasMore)

    uiLog('Пересобран available после sync', {
      query,
      restoredCount: mergedItems.length,
      total,
    })
  }

  async function loadSelected({
    offset = 0,
    append = false,
    query = rightQuery,
  } = {}) {
    setSelectedLoading(true)
    setError('')

    try {
      const data = await fetchSelected({
        query,
        offset,
        limit: PAGE_SIZE,
      })

      setSelectedItems((prev) => (append ? [...prev, ...data.items] : data.items))
      setSelectedTotal(data.total)
      setSelectedOffset(offset)
      setSelectedHasMore(data.hasMore)

      uiLog('Загружен selected', {
        query,
        offset,
        count: data.items.length,
        total: data.total,
        append,
      })
    } catch (err) {
      setError(err.message || 'Не удалось загрузить правый список')
      uiLog('Ошибка загрузки selected', err)
    } finally {
      setSelectedLoading(false)
    }
  }

  async function syncFromServer(force = false) {
    try {
      const state = await fetchState()

      const versionChanged = lastSeenVersion !== state.version
      const bootChanged = lastSeenBootId !== state.bootId
      const resetChanged = lastSeenResetCount !== state.resetCount

      const shouldSync =
        force ||
        !isInitialized ||
        versionChanged ||
        bootChanged ||
        resetChanged

      if (!shouldSync) {
        return
      }

      const isNewServerCycle =
        force ||
        !isInitialized ||
        bootChanged ||
        resetChanged

      if (isNewServerCycle) {
        availableVisibleCountRef.current = PAGE_SIZE
        setAvailableOffset(0)
        setSelectedOffset(0)
        setAvailableAutoLoadEnabled(false)

        if (availableListRef.current) {
          availableListRef.current.scrollTop = 0
        }

        uiLog('Обнаружен новый цикл серверного состояния: сброс глубины списков к первой странице', {
          previousVersion: lastSeenVersion,
          nextVersion: state.version,
          previousBootId: lastSeenBootId,
          nextBootId: state.bootId,
          previousResetCount: lastSeenResetCount,
          nextResetCount: state.resetCount,
          force,
        })
      } else {
        uiLog('Обнаружено изменение серверного состояния без нового цикла', {
          previousVersion: lastSeenVersion,
          nextVersion: state.version,
        })
      }

      if (isDraggingSelected) {
        await reloadAvailableVisible(leftQuery)
        uiLog('Правый список не обновлялся во время drag')
      } else {
        await Promise.all([
          reloadAvailableVisible(leftQuery),
          loadSelected({ offset: 0, append: false, query: rightQuery }),
        ])
      }

      setLastSeenVersion(state.version)
      setLastSeenBootId(state.bootId)
      setLastSeenResetCount(state.resetCount)
      setIsInitialized(true)
    } catch (err) {
      setError(err.message || 'Не удалось синхронизироваться с сервером')
      uiLog('Ошибка syncFromServer', err)
    }
  }

  async function handleAdd() {
    if (!canAdd) return

    setActionLoading(true)
    setAddError('')

    try {
      const id = Number(newId)

      await addItem(id)
      setStatusText(`Добавление поставлено в очередь: #${id}`)
      setNewId('')

      uiLog('Поставлен в очередь add', { id })
    } catch (err) {
      setAddError(err.message || 'Не удалось поставить add в очередь')
      uiLog('Ошибка add', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSelect(id) {
    setActionLoading(true)
    setError('')
    setAddError('')

    try {
      await selectItem(id)
      setStatusText(`Выбор поставлен в очередь: #${id}`)

      uiLog('Поставлен в очередь select', { id })
    } catch (err) {
      setError(err.message || 'Не удалось поставить select в очередь')
      setStatusText('Ошибка выбора')
      uiLog('Ошибка select', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnselect(id) {
    setActionLoading(true)
    setError('')
    setAddError('')

    try {
      await unselectItem(id)
      setStatusText(`Удаление из выбранных поставлено в очередь: #${id}`)

      uiLog('Поставлен в очередь unselect', { id })
    } catch (err) {
      setError(err.message || 'Не удалось поставить unselect в очередь')
      setStatusText('Ошибка удаления из выбранных')
      uiLog('Ошибка unselect', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReset() {
    setResetLoading(true)
    setError('')
    setAddError('')

    try {
      await resetState()
      setStatusText('Сброс состояния выполнен на сервере')

      uiLog('Выполнен reset state')
    } catch (err) {
      setError(err.message || 'Не удалось выполнить reset')
      setStatusText('Ошибка reset')
      uiLog('Ошибка reset', err)
    } finally {
      setResetLoading(false)
    }
  }

  function moveItemInArray(list, fromId, toId) {
    const next = [...list]

    const fromIndex = next.indexOf(fromId)
    const toIndex = next.indexOf(toId)

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return next
    }

    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)

    return next
  }

  async function handleSelectedDrop(targetId) {
    if (isSelectedFilterActive) {
      setDraggedId(null)
      setDragOverId(null)
      setIsDraggingSelected(false)
      return
    }

    if (draggedId == null || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      setIsDraggingSelected(false)
      return
    }

    setError('')

    try {
      const data = await fetchSelectedAll({ query: rightQuery })
      const reordered = moveItemInArray(data.items, draggedId, targetId)

      await reorderSelected(reordered)

      setSelectedItems(reordered.slice(0, Math.max(selectedItems.length, PAGE_SIZE)))
      setStatusText('Новый порядок поставлен в очередь')

      uiLog('Поставлен в очередь reorder', {
        draggedId,
        targetId,
        total: reordered.length,
      })
    } catch (err) {
      setError(err.message || 'Не удалось изменить порядок')
      setStatusText('Ошибка reorder')
      uiLog('Ошибка reorder', err)
    } finally {
      setDraggedId(null)
      setDragOverId(null)
      setIsDraggingSelected(false)
    }
  }

  useEffect(() => {
    if (!isInitialized) return
    loadAvailable({ offset: 0, append: false, query: leftQuery })
  }, [leftQuery, isInitialized])

  useEffect(() => {
    if (!isInitialized) return
    loadSelected({ offset: 0, append: false, query: rightQuery })
  }, [rightQuery, isInitialized])

  useEffect(() => {
    uiLog('Первичная синхронизация интерфейса')
    syncFromServer(true)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      syncFromServer(false)
    }, 1000)

    return () => clearInterval(timer)
  }, [
    lastSeenVersion,
    lastSeenBootId,
    lastSeenResetCount,
    leftQuery,
    rightQuery,
    isDraggingSelected,
    isInitialized,
  ])

  useEffect(() => {
    const el = availableEndRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (
          availableAutoLoadEnabled &&
          entry.isIntersecting &&
          availableHasMore &&
          !availableLoading
        ) {
          loadAvailable({
            offset: availableOffset + PAGE_SIZE,
            append: true,
          })
        }
      },
      {
        root: el.closest('.list'),
        threshold: 0,
        rootMargin: '0px 0px 120px 0px',
      }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [availableOffset, availableHasMore, availableLoading, leftQuery, availableAutoLoadEnabled])

  useEffect(() => {
    const el = selectedEndRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (entry.isIntersecting && selectedHasMore && !selectedLoading) {
          loadSelected({
            offset: selectedOffset + PAGE_SIZE,
            append: true,
          })
        }
      },
      {
        root: el.closest('.list'),
        threshold: 0,
        rootMargin: '0px 0px 120px 0px',
      }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [selectedOffset, selectedHasMore, selectedLoading, rightQuery])

  useEffect(() => {
    availableVisibleCountRef.current = Math.max(availableItems.length, PAGE_SIZE)
  }, [availableItems.length])

  return (
    <div className="dashboard-shell">
      <header className="topbar compact-topbar card">
        <div className="title-block">
          <h1>Million List Test Task</h1>
          <p className="subtitle compact">
            React SPA + Express in-memory backend
          </p>
        </div>

        <div className="toolbar-right compact-toolbar">
          <div className="add-inline-group">
            <div className="add-inline-message">
              {addValidation.message ? (
                <span className="inline-hint">{addValidation.message}</span>
              ) : addError ? (
                <span className="inline-error-text">{addError}</span>
              ) : (
                <span className="inline-placeholder"> </span>
              )}
            </div>

            <input
              type="number"
              placeholder="New ID"
              value={newId}
              onChange={(e) => {
                setNewId(e.target.value)
                setAddError('')
              }}
              className="input compact-input short-input"
            />
          </div>

          <button
            className="btn btn-small"
            onClick={handleAdd}
            disabled={!canAdd || actionLoading}
          >
            Add ID
          </button>

          <button
            className="btn btn-danger btn-small reset-btn"
            onClick={handleReset}
            disabled={resetLoading}
          >
            Reset
          </button>
        </div>
      </header>

      <div className="status-row">
        <span className="status-pill">{statusText}</span>
        {error ? <span className="status-pill status-pill-error">{error}</span> : null}
      </div>

      <main className="dashboard-grid">
        <section className="column card compact-card">
          <div className="column-header compact-header">
            <div>
              <h3>Available</h3>
              <p className="muted compact">All items except selected</p>
            </div>
            <div className="pill">Total: {availableTotal}</div>
          </div>

          <input
            type="text"
            placeholder="Filter by ID"
            value={leftQuery}
            onChange={(e) => setLeftQuery(e.target.value)}
            className="input compact-input"
          />

          <div
            ref={availableListRef}
            className="list compact-list"
            onScroll={(e) => {
              if (!availableAutoLoadEnabled && e.currentTarget.scrollTop > 0) {
                setAvailableAutoLoadEnabled(true)
              }
            }}
          >
            {availableItems.map((id) => (
              <div className="list-row compact-row" key={`available-${id}`}>
                <span className="mono">#{id}</span>
                <button
                  className="btn btn-small"
                  onClick={() => handleSelect(id)}
                  disabled={actionLoading}
                >
                  Select →
                </button>
              </div>
            ))}

            <div ref={availableEndRef} style={{ height: 1 }} />

            {!availableLoading && availableItems.length === 0 ? (
              <div className="empty">No available items</div>
            ) : null}
          </div>

          <div className="column-footer compact-footer">
            <span className="muted compact">
              {availableLoading ? 'Loading...' : `${availableItems.length} shown`}
            </span>
          </div>
        </section>

        <section className="column card compact-card">
          <div className="column-header compact-header">
            <div className="selected-header-left">
              <div>
                <h3>Selected</h3>
                <p className="muted compact">Current selected order</p>
              </div>

              {isSelectedFilterActive ? (
                <div className="header-hint">
                  Reordering is available only when the filter is empty
                </div>
              ) : null}
            </div>

            <div className="pill">Total: {selectedTotal}</div>
          </div>

          <input
            type="text"
            placeholder="Filter by ID"
            value={rightQuery}
            onChange={(e) => setRightQuery(e.target.value)}
            className="input compact-input"
          />

          <div className="list compact-list">
            {selectedItems.map((id) => (
              <div
                className={`list-row compact-row ${draggedId === id ? 'dragging-row' : ''} ${dragOverId === id ? 'drag-over-row' : ''} ${isSelectedFilterActive ? 'drag-disabled-row' : ''}`}
                key={`selected-${id}`}
                draggable={!isSelectedFilterActive}
                onDragStart={(e) => {
                  if (isSelectedFilterActive) {
                    e.preventDefault()
                    return
                  }

                  setDraggedId(id)
                  setIsDraggingSelected(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (draggedId !== id) {
                    setDragOverId(id)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverId === id) {
                    setDragOverId(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleSelectedDrop(id)
                }}
                onDragEnd={() => {
                  setDraggedId(null)
                  setDragOverId(null)
                  setIsDraggingSelected(false)
                }}
              >
                <span className="mono">#{id}</span>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => handleUnselect(id)}
                  disabled={actionLoading}
                >
                  ← Remove
                </button>
              </div>
            ))}

            <div ref={selectedEndRef} style={{ height: 1 }} />

            {!selectedLoading && selectedItems.length === 0 ? (
              <div className="empty">No selected items</div>
            ) : null}
          </div>

          <div className="column-footer compact-footer">
            <span className="muted compact">
              {selectedLoading ? 'Loading...' : `${selectedItems.length} shown`}
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}