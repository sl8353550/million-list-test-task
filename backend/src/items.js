import { appState } from './state.js'

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 20

export function normalizeLimit(value) {
    const limit = Number(value)

    if (!Number.isInteger(limit) || limit <= 0) {
        return PAGE_SIZE_DEFAULT
    }

    return Math.min(limit, PAGE_SIZE_MAX)
}

export function normalizeOffset(value) {
    const offset = Number(value)

    if (!Number.isInteger(offset) || offset < 0) {
        return 0
    }

    return offset
}

export function normalizeQuery(value) {
    if (value == null) return ''
    return String(value).trim()
}

export function idMatchesQuery(id, query) {
    if (!query) return true
    return String(id).includes(query)
}

export function itemExists(id) {
    const inBaseRange =
        id >= appState.baseRange.start &&
        id <= appState.baseRange.end

    return inBaseRange || appState.addedIds.has(id)
}

function getSortedAddedIds() {
    return [...appState.addedIds].sort((a, b) => a - b)
}

function countSelectedInBaseRange() {
    const { start, end } = appState.baseRange
    let count = 0

    for (const id of appState.selectedIds) {
        if (id >= start && id <= end) {
            count += 1
        }
    }

    return count
}

function collectBaseAvailablePage({ offset, limit }) {
    const items = []
    const { start, end } = appState.baseRange

    let seenAvailable = 0

    for (let id = start; id <= end; id += 1) {
        if (appState.selectedIds.has(id)) {
            continue
        }

        if (seenAvailable >= offset && items.length < limit) {
            items.push(id)
        }

        seenAvailable += 1

        if (items.length >= limit) {
            break
        }
    }

    return items
}

function collectAddedAvailablePage({ offset, limit }) {
    const items = []
    const addedSorted = getSortedAddedIds()

    let seenAvailable = 0

    for (const id of addedSorted) {
        if (appState.selectedIds.has(id)) {
            continue
        }

        if (seenAvailable >= offset && items.length < limit) {
            items.push(id)
        }

        seenAvailable += 1

        if (items.length >= limit) {
            break
        }
    }

    return items
}

function getAvailableItemsWithoutQuery({ offset, limit }) {
    const { start, end } = appState.baseRange
    const baseCount = end - start + 1

    const selectedInBaseRange = countSelectedInBaseRange()
    const baseAvailableTotal = baseCount - selectedInBaseRange

    const addedAvailableTotal = getSortedAddedIds().filter(
        (id) => !appState.selectedIds.has(id)
    ).length

    const total = baseAvailableTotal + addedAvailableTotal

    const items = []

    // Сначала страница из base диапазона
    if (offset < baseAvailableTotal) {
        const baseItems = collectBaseAvailablePage({ offset, limit })
        items.push(...baseItems)
    }

    // Если после base еще есть место, добираем из added
    if (items.length < limit) {
        const remainingLimit = limit - items.length
        const addedOffset = Math.max(0, offset - baseAvailableTotal)

        const addedItems = collectAddedAvailablePage({
            offset: addedOffset,
            limit: remainingLimit,
        })

        items.push(...addedItems)
    }

    return {
        items,
        total,
        offset,
        limit,
        hasMore: offset + items.length < total,
    }
}

function getAvailableItemsWithQuery({ query, offset, limit }) {
    const items = []
    let total = 0

    for (
        let id = appState.baseRange.start;
        id <= appState.baseRange.end;
        id += 1
    ) {
        if (appState.selectedIds.has(id)) {
            continue
        }

        if (!idMatchesQuery(id, query)) {
            continue
        }

        if (total >= offset && items.length < limit) {
            items.push(id)
        }

        total += 1
    }

    const addedSorted = getSortedAddedIds()

    for (const id of addedSorted) {
        if (appState.selectedIds.has(id)) {
            continue
        }

        if (!idMatchesQuery(id, query)) {
            continue
        }

        if (total >= offset && items.length < limit) {
            items.push(id)
        }

        total += 1
    }

    return {
        items,
        total,
        offset,
        limit,
        hasMore: offset + items.length < total,
    }
}

export function getSelectedItems({ query, offset, limit }) {
    const filtered = query
        ? appState.selectedOrder.filter((id) => idMatchesQuery(id, query))
        : appState.selectedOrder

    const total = filtered.length
    const items = filtered.slice(offset, offset + limit)

    return {
        items,
        total,
        offset,
        limit,
        hasMore: offset + items.length < total,
    }
}

export function getAvailableItems({ query, offset, limit }) {
    if (!query) {
        return getAvailableItemsWithoutQuery({ offset, limit })
    }

    return getAvailableItemsWithQuery({ query, offset, limit })
}