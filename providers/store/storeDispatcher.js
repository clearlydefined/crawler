// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class StoreDispatcher {
  constructor(options, stores) {
    this.options = options
    this.stores = stores
  }

  connect() {
    return this._perform(store => store.connect())
  }

  upsert(document) {
    return this._perform(store => store.upsert(document))
  }

  get(type, key) {
    return this._perform(store => store.get(type, key), true)
  }

  etag(type, key) {
    return this._perform(store => store.etag(type, key), true)
  }

  list(type) {
    return this._perform(store => store.list(type), true)
  }

  count(type) {
    return this._perform(store => store.count(type), true)
  }

  close() {
    return this._perform(store => store.close())
  }

  delete(type, key) {
    return this._perform(store => store.delete(type, key))
  }

  async _perform(operation, first = false) {
    let result = null
    for (let i = 0; i < this.stores.length; i++) {
      const store = this.stores[i]
      const opResult = await operation(store)
      result = result || opResult
      if (result && first) return result
    }
    return result
  }
}

module.exports = (options, names, stores) => new StoreDispatcher(options, names, stores)
