// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const { DateTime } = require('luxon')
const { spawn } = require('child_process')
const { intersection } = require('lodash')

const dateTimeFormats = [
  "EEE MMM d HH:mm:ss 'GMT'ZZ yyyy" //in pom properties
]

/** @param {string} path */
function normalizePath(path) {
  if (!path) return path
  return path.replace(/\\/g, '/')
}

/** @param {string[]} paths */
function normalizePaths(paths) {
  if (!Array.isArray(paths)) return paths
  return paths.map(path => normalizePath(path))
}

/**
 * @param {string} path
 * @param {string} [parents]
 */
function trimParents(path, parents) {
  if (!path) return path
  path = normalizePath(path)
  if (!parents) return path
  parents = normalizePath(parents)
  if (!path.startsWith(parents)) return path
  return path.slice(parents.length).replace(/^[/\\]+/, '')
}

/**
 * @param {string[]} paths
 * @param {string} parents
 */
function trimAllParents(paths, parents) {
  if (!Array.isArray(paths)) return paths
  return paths.map(path => trimParents(path, parents))
}

/** @param {string} file */
function isGitFile(file) {
  if (!file) return false
  const segments = file.split(/[\\/]/g)
  return intersection(segments, ['.git']).length > 0
}

/**
 * @param {string} dateAndTime
 * @param {string[]} [formats]
 */
function extractDate(dateAndTime, formats = dateTimeFormats) {
  if (!dateAndTime) return dateAndTime
  let luxonResult = DateTime.fromISO(dateAndTime)
  if (!luxonResult.isValid) luxonResult = DateTime.fromRFC2822(dateAndTime)
  if (!luxonResult.isValid) luxonResult = DateTime.fromHTTP(dateAndTime)
  if (!luxonResult.isValid) luxonResult = DateTime.fromSQL(dateAndTime)

  for (let index = 0; !luxonResult.isValid && index < formats.length; index++) {
    luxonResult = DateTime.fromFormat(dateAndTime, formats[index])
  }

  if (!luxonResult.isValid) return null

  const instant = luxonResult.until(luxonResult)
  const validStart = DateTime.fromISO('1950-01-01')
  const validEnd = DateTime.now().plus({ days: 30 })
  return instant.isBefore(validStart) || instant.isAfter(validEnd) ? null : luxonResult
}

/**
 * @param {import('child_process').ChildProcess} child
 * @param {(value: string) => void} resolve
 * @param {(reason: Error) => void} reject
 */
function attachListeners(child, resolve, reject) {
  /** @type {string[]} */
  let stdoutData = [],
    /** @type {string[]} */
    stderrData = []

  child.stdout.on('data', chunk => stdoutData.push(chunk))
  child.stderr.on('data', chunk => stderrData.push(chunk))

  child
    .on('error', err => reject(err))
    .on('close', code => {
      if (code === 0) resolve(stdoutData.join(''))
      else {
        /** @type {Error & { code?: any }} */
        const errorFromChild = new Error(stderrData.join(''))
        errorFromChild.code = code
        reject(errorFromChild)
      }
    })
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} [options]
 */
function spawnPromisified(command, args, options) {
  const childProcess = spawn(command, args, options)
  return new Promise((resolve, reject) => {
    attachListeners(childProcess, resolve, reject)
  })
}

module.exports = {
  normalizePath,
  normalizePaths,
  trimParents,
  trimAllParents,
  isGitFile,
  extractDate,
  spawnPromisified
}
