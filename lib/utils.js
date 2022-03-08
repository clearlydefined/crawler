// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const { DateTime } = require('luxon')

const dateTimeFormats = [
  'EEE MMM d HH:mm:ss \'GMT\'ZZ yyyy'   //in pom properties
]

function normalizePath(path) {
  if (!path) return path
  return path.replace(/\\/g, '/')
}

function normalizePaths(paths) {
  if (!Array.isArray(paths)) return paths
  return paths.map(path => normalizePath(path))
}

function trimParents(path, parents) {
  if (!path) return path
  path = normalizePath(path)
  if (!parents) return path
  parents = normalizePath(parents)
  if (!path.startsWith(parents)) return path
  return path.slice(parents.length).replace(/^[/\\]+/, '')
}

function trimAllParents(paths, parents) {
  if (!Array.isArray(paths)) return paths
  return paths.map(path => trimParents(path, parents))
}

function extractDate(dateAndTime, formats = dateTimeFormats) {
  if (!dateAndTime) return dateAndTime
  let luxonResult = DateTime.fromISO(dateAndTime)
  if (!luxonResult.isValid) luxonResult = DateTime.fromRFC2822(dateAndTime)
  if (!luxonResult.isValid) luxonResult = DateTime.fromHTTP(dateAndTime)
  if (!luxonResult.isValid) luxonResult = DateTime.fromSQL(dateAndTime)

  for (let index = 0; !luxonResult.isValid && index < formats.length; index++) {
    luxonResult = DateTime.fromFormat(dateAndTime, formats[index])
  }
  return luxonResult.isValid ? luxonResult : null
}

module.exports = { normalizePath, normalizePaths, trimParents, trimAllParents, extractDate }
