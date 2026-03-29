import { appState } from './state.js'

export function createQueues() {
    return {
        // addQueue: ключ = id, значение = { id }
        addQueue: new Map(),

        // mutateQueue:
        // selection:<id> -> { type: 'select' | 'unselect', id }
        // reorder -> { type: 'reorder', orderedIds: [] }
        mutateQueue: new Map(),
    }
}

export const queues = createQueues()

export function enqueueAdd(id) {
    queues.addQueue.set(id, { id })
}

export function enqueueSelect(id) {
    queues.mutateQueue.set(`selection:${id}`, {
        type: 'select',
        id,
    })
}

export function enqueueUnselect(id) {
    queues.mutateQueue.set(`selection:${id}`, {
        type: 'unselect',
        id,
    })
}

export function enqueueReorder(orderedIds) {
    queues.mutateQueue.set('reorder', {
        type: 'reorder',
        orderedIds,
    })
}

export function flushAddQueue() {
    if (queues.addQueue.size === 0) {
        return {
            applied: 0,
        }
    }

    let applied = 0

    for (const [id] of queues.addQueue) {
        // не даем добавить id из базового диапазона повторно
        const inBaseRange =
            id >= appState.baseRange.start &&
            id <= appState.baseRange.end

        const alreadyAdded = appState.addedIds.has(id)

        if (!inBaseRange && !alreadyAdded) {
            appState.addedIds.add(id)
            applied += 1
        }
    }

    if (applied > 0) {
        appState.version += 1
    }

    queues.addQueue.clear()

    return {
        applied,
    }
}

export function flushMutateQueue() {
    if (queues.mutateQueue.size === 0) {
        return {
            applied: 0,
        }
    }

    let applied = 0

    for (const [, action] of queues.mutateQueue) {
        if (action.type === 'select') {
            if (!appState.selectedIds.has(action.id)) {
                appState.selectedIds.add(action.id)
                appState.selectedOrder.push(action.id)
                applied += 1
            }
        }

        if (action.type === 'unselect') {
            if (appState.selectedIds.has(action.id)) {
                appState.selectedIds.delete(action.id)
                appState.selectedOrder = appState.selectedOrder.filter(
                    (id) => id !== action.id
                )
                applied += 1
            }
        }

        if (action.type === 'reorder') {
            const nextOrder = action.orderedIds.filter((id) =>
                appState.selectedIds.has(id)
            )

            const sameLength =
                nextOrder.length === appState.selectedOrder.length

            const sameOrder =
                sameLength &&
                nextOrder.every((id, index) => id === appState.selectedOrder[index])

            if (!sameOrder) {
                appState.selectedOrder = nextOrder
                applied += 1
            }
        }
    }

    if (applied > 0) {
        appState.version += 1
    }

    queues.mutateQueue.clear()

    return {
        applied,
    }
}

export function resetQueues() {
    queues.addQueue.clear()
    queues.mutateQueue.clear()
}