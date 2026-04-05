import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { WatcherManager } from '../src/watcher'
import type { Message } from '../src/types'

describe('WatcherManager', () => {
  let manager: WatcherManager

  beforeEach(() => {
    manager = new WatcherManager()
  })

  afterEach(() => {
    manager.stopAll()
  })

  it('starts with no active watchers', () => {
    expect(manager.listWatchers()).toEqual([])
  })

  it('registers a watcher', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    expect(manager.listWatchers()).toEqual(['Alice'])
  })

  it('removes a watcher', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    manager.unwatch('Alice')
    expect(manager.listWatchers()).toEqual([])
  })

  it('does not duplicate watchers for the same contact', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    manager.watch('Alice', callback, 5000)
    expect(manager.listWatchers()).toEqual(['Alice'])
  })

  it('stops all watchers', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    manager.watch('Bob', callback, 10000)
    manager.stopAll()
    expect(manager.listWatchers()).toEqual([])
  })

  it('tracks last known message IDs to detect new messages', () => {
    expect(manager.isNewMessage('Alice', 'msg-1')).toBe(true)
    manager.markSeen('Alice', 'msg-1')
    expect(manager.isNewMessage('Alice', 'msg-1')).toBe(false)
    expect(manager.isNewMessage('Alice', 'msg-2')).toBe(true)
  })
})
