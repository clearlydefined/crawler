// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class StoreDispatcher {
  constructor(options, stores) {
    this.options = options
    this.stores = stores
  }

  connect() {
    return this._perform(store => {
      return store.connect()
    })
  }

  upsert(document) {
    return this._perform(store => {
      return store.upsert(document)
    })
  }

  get(type, key) {
    return this._perform(store => {
      return store.get(type, key)
    })
  }

  etag(type, key) {
    return this._perform(store => {
      return store.etag(type, key)
    })
  }

  list(type) {
    return this._perform(store => {
      return store.list(type)
    })
  }

  count(type) {
    return this._perform(store => {
      return store.count(type)
    })
  }

  close() {
    return this._perform(store => {
      return store.close()
    })
  }

  delete(type, key) {
    return this._perform(store => {
      return store.delete(type, key)
    })
  }

  async _perform(operation) {
    let result = null
    for (let i = 0; i < this.stores.length; i++) {
      const store = this.stores[i]
      const opResult = await operation(store)
      result = opResult || result
    }
    return result
  }
}

module.exports = (options, names, stores) => new StoreDispatcher(options, names, stores)
