// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

function normalizePath(path) {
  if (!path) return path
  return path.replace(/\\/g, '/')
}

function normalizePaths(paths) {
  if (!Array.isArray(paths)) return paths
  return paths.map(path => normalizePath(path))
}

function trimParents(path, parents) {
  parents = normalizePath(parents)
  path = normalizePath(path)
  if (!path.startsWith(parents)) return path
  return path.slice(parents.length).replace(/^[\/\\]+/, '')
}

function trimAllParents(paths, parents) {
  if (!Array.isArray(paths)) return paths
  return paths.map(path => trimParents(path, parents))
}

module.exports = { normalizePath, normalizePaths, trimParents, trimAllParents }
