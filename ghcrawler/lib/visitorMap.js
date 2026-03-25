// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

/** @type {Record<string, any>} */
const mapList = {}

class VisitorMap {
  /**
   * @param {string} name
   * @param {any} value
   */
  static register(name, value) {
    mapList[name] = VisitorMap.copy(value)
  }

  /** @param {string} name */
  static getCopy(name) {
    return VisitorMap.copy(VisitorMap._getMap(name))
  }

  /**
   * @param {any} node
   * @param {Map<object, object>} [seen]
   */
  static copy(node, seen = new Map()) {
    if (typeof node === 'string' || typeof node === 'function') {
      return node
    }
    if (seen.get(node)) {
      return seen.get(node)
    }
    /** @type {any} */
    const result = Array.isArray(node) ? [] : {}
    seen.set(node, result)
    for (let key in node) {
      const value = node[key]
      if (typeof value === 'function') {
        result[key] = value
      }
      result[key] = VisitorMap.copy(value, seen)
    }
    return result
  }

  /**
   * @param {any} step
   * @param {string} segment
   */
  static resolve(step, segment) {
    return typeof step === 'function' ? step(segment) : step[segment]
  }

  /** @param {string} name */
  static _getMap(name) {
    // the name is [scenario/]map.  The 'default' scenario is used if none is specified
    let [scenario, map] = name.split('/')
    if (!map) {
      map = scenario
      scenario = 'default'
    }
    return mapList[scenario][map]
  }

  /**
   * @param {string} name
   * @param {string} [path]
   */
  static getMap(name, path = '/') {
    return name ? new VisitorMap(name, path) : null
  }

  /**
   * @param {string} name
   * @param {string} [path]
   */
  constructor(name, path = '/') {
    this.name = name
    this.path = path
  }

  /** @param {string} next */
  getNextMap(next) {
    const separator = this.path.endsWith('/') ? '' : '/'
    return this.hasNextStep(next) ? new VisitorMap(this.name, this.path + `${separator}${next}`) : null
  }

  /** @param {string} next */
  getNextStep(next) {
    const current = this.getCurrentStep()
    return this.navigate(current, next)
  }

  /** @param {string | null} [next] */
  hasNextStep(next = null) {
    const current = this.getCurrentStep()
    // arrays trigger the traversal of a collection/relation but not their contents.  Terminal nodes only
    if (Array.isArray(current)) {
      return false
    }
    const props = Object.getOwnPropertyNames(current)
    if (props.length === 0) {
      return false
    }
    return next ? props.includes(next) : true
  }

  getCurrentStep() {
    const map = this.getMap()
    if (!map) {
      throw new Error(`VisitorMap in an invalid state.  Unknown map: ${this.name}`)
    }
    return this.navigate(this.getMap(), this.getPath())
  }

  /**
   * @param {any} map
   * @param {string | string[]} path
   */
  navigate(map, path) {
    if (!map) {
      throw new Error('VisitorMap in an invalid state.  Unknown map.')
    }
    path = this._resolvePath(path)
    let current = map
    let currentPath = []
    for (let i = 0; i < path.length; i++) {
      const segment = path[i]
      currentPath.push(segment)
      current = VisitorMap.resolve(current, segment)
      if (!current) {
        return current
      }
    }
    return current
  }

  getMap() {
    return VisitorMap._getMap(this.name)
  }

  getPath() {
    return this._resolvePath(this.path)
  }

  /** @param {string | string[]} spec */
  _resolvePath(spec) {
    if (Array.isArray(spec)) {
      return spec
    }
    if (spec === '/') {
      return []
    }
    return spec.split('/').slice(spec.startsWith('/') ? 1 : 0)
  }
}

module.exports = VisitorMap
