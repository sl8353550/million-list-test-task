export function createAppState() {
  return {
    baseRange: {
      start: 1,
      end: 1_000_000,
    },

    // Новые элементы, добавленные вручную
    addedIds: new Set(),

    // Выбранные элементы
    selectedIds: new Set(),

    // Порядок элементов в правом списке
    selectedOrder: [],

    // Версия состояния: растет на обычных изменениях данных
    version: 1,

    // Счетчик reset: растет при каждом reset, даже если version был 1
    resetCount: 0,
  }
}

export const appState = createAppState()

// Уникальный id запуска сервера.
// Если процесс перезапустился, bootId будет новый.
export const bootId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function resetAppState() {
  const nextResetCount = appState.resetCount + 1

  appState.baseRange = {
    start: 1,
    end: 1_000_000,
  }
  appState.addedIds = new Set()
  appState.selectedIds = new Set()
  appState.selectedOrder = []
  appState.version = 1
  appState.resetCount = nextResetCount
}