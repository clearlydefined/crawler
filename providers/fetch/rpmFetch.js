// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
// THF
const AbstractFetch = require('./abstractFetch')
const bz2 = require('unbzip2-stream')
const { clone } = require('lodash')
const fs = require('fs')
const memCache = require('memory-cache')
const nodeRequest = require('request')
const { promisify } = require('util')
const sqlite3 = require('sqlite3').verbose()
const sqlite = require('sqlite')
const { spawn } = require('child_process')
const glob = require("glob")
const parseString = promisify(require('xml2js').parseString)
const { DateTime } = require('luxon')

const cacheDuration = 8 * 60 * 60 * 1000 // 8 hours

/**
 * Class for interacting with an RPM repository
 */
class RpmRepo {
  constructor(options) {
    this.cdFileLocation = options.cdFileLocation
    this.repoMdFile = this.cdFileLocation + "/repomd.xml"
    this.baseUrl = options.baseUrl

    if (!fs.existsSync(this.cdFileLocation)) {
      fs.mkdirSync(this.cdFileLocation)
    }
  }

  /**
   * Get the RPM database file, downloading it if necessary
   *
   * @returns the path to the RPM database file
   */
  async _getDbFile() {
    const repoMd = await parseString(fs.readFileSync(this.repoMdFile))
    const dbEntry = repoMd.repomd.data.find(entry => entry.$.type == 'primary_db')
    const location = dbEntry.location[0].$.href
    const location_url = `${this.baseUrl}/${location}`
    const checksum = dbEntry.checksum[0]._
    const dbFile = `${this.cdFileLocation}/${checksum}-primary.sqlite`
    const tmpDbFile = `${dbFile}.tmp`

    if (!fs.existsSync(dbFile)) {
      await new Promise(resolve => {
        nodeRequest
          .get(location_url, (error, response) => {
            if (error) return reject(error)
            if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
          })
          // The database files are bz2 encoded
          .pipe(bz2())
          .pipe(fs.createWriteStream(tmpDbFile).on('finish', () => {
            // Ignore errors - this may be run twice concurrently and
            // one promise may have already moved the tmp file
            try {
              fs.renameSync(tmpDbFile, dbFile)
            } catch (err) { }
            resolve()
          }))
      })
    }
    return dbFile
  }

  /**
   * Query the RPM package db.
   *
   * @param {string} sql - The sql query string
   * @param {Object} params - Parameters for the SQL query
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns Promise that returns an array containing data for the matching RPM (or empty array if there was no match)
   */
  async _dbQuery(sql, params, refreshRepoData = true) {
    if (refreshRepoData) {
      await this._getRepoMetadataFile()
    }
    const dbFile = await this._getDbFile()
    const db = await sqlite.open({ filename: dbFile, driver: sqlite3.cached.Database, mode: sqlite3.OPEN_READONLY });
    return db.all(
      sql,
      params)
  }

  /**
   * Query the RPM package db for a given spec
   *
   * @param {Object} spec - The CD spec to get RPM data for
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns Promise that returns array of package entries that match the spec
   */
  async _getRegistryData(spec, refreshRepodata = true) {
    const { name, epoch, version, release, arch } = _fromSpec(spec)
    return this._dbQuery(
      'SELECT * FROM packages \
        WHERE name=$name AND \
              epoch=$epoch AND \
              version=$version AND \
              release=$release AND \
              arch=$arch \
        ORDER BY time_build DESC',
      { $name: name, $version: version, $epoch: epoch, $release: release, $arch: arch }, refreshRepodata)
  }

  /**
   * Query the RPM package db for the latest RPM (by build date) with a given name
   *
   * @param {string} name - The RPM name to search for
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns Promise that returns an array containing data for the latest matching RPM (or empty array if there was no match)
   */
  async _getLatest(name, refreshRepodata = true) {
    return this._dbQuery(
      'SELECT * FROM packages \
        WHERE name=$name \
        ORDER BY time_build DESC \
        LIMIT 1',
      { $name: name }, refreshRepodata)
  }

  /**
   * Query the RPM package db for an RPM that has the specified location_href.
   *
   * @param {string} location_href - The location_href to search for
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns Promise that returns an array containing data for the matching RPM (or empty array if there was no match)
   */
  async _getRpmWithLocation(location_href, refreshRepodata = true) {
    return this._dbQuery(
      'SELECT * FROM packages \
        WHERE location_href=$location_href \
        ORDER BY time_build DESC \
        LIMIT 1',
      { $location_href: location_href }, refreshRepodata)
  }

  /**
   * Download the latest repomd.xml file for the repository.
   * This will pull at most once every `cacheDuration`
   */
  async _getRepoMetadataFile() {
    const cacheKey = this.baseUrl
    const repoMdUrl = this.baseUrl + '/repodata/repomd.xml'

    // If the repo metadata file doesn't exist, remove the cache entry so we repull it
    // below
    if (!fs.existsSync(this.repoMdFile)) {
      memCache.del(cacheKey)
    }

    if (!memCache.get(cacheKey)) {
      // No cache entry - pull repomd.xml. This could be run concurrently,
      // so pull to a temp file and move it on completion.
      const tmpRepoFile = `${this.repoMdFile}.tmp`
      await new Promise((resolve, reject) => {
        nodeRequest
          .get(repoMdUrl, (error, response) => {
            if (error) {
              memCache.del(cacheKey)
              return reject(error)
            }
            if (response.statusCode !== 200) {
              memCache.del(cacheKey)
              reject(new Error(`${response.statusCode} ${response.statusMessage}`))
            }
          })
          .pipe(fs.createWriteStream(tmpRepoFile).on('finish', () => {
            try {
              fs.renameSync(tmpRepoFile, this.repoMdFile)
            } catch (err) { }
            memCache.put(cacheKey, true, cacheDuration)
            resolve(null)
          }))
      })
    }
  }
}

/**
 * Base class for fetching RPMs.
 * Should be extended for each distro
 */
class RpmFetch extends AbstractFetch {
  constructor(repos, options) {
    super(options)
    this.repos = repos
    this.cdFileLocation = this.options.cdFileLocation
  }

  canHandle(request) {
    return False
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (!spec.revision) spec.revision = await this._getLatestVersion(spec)
    if (!spec.revision) return request.markSkip('Missing  ')
    var registryData = await this._getRegistryData(spec)
    if (registryData == null) return this.markSkip(request)
    request.url = spec.toUrl()
    super.handle(request)
    const { dir, releaseDate, hashes } = await this._getPackage(request, registryData)
    const declaredLicense = await this._getDeclaredLicense(registryData)
    const srcRpmUrl = await this._getSrcRpmUrl(registryData)
    registryData.srcRpmUrl = srcRpmUrl
    request.document = this._createDocument({ dir, registryData, releaseDate, declaredLicense, hashes })
    request.contentOrigin = 'origin'
    request.casedSpec = clone(spec)
    return request
  }

  /**
   * Find the latest RPM from the configured repositories.
   * Uses build date, to avoid implementing RPM version comparison algorithm
   * @param {*} name - RPM name to search for
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns Data for latest matching RPM
   */
  async _getLatestVersion(name, refreshRepodata = true) {
    var entries = await Promise.all(this.repos.map(async fetcher => {
      return await fetcher._getLatest(name, refreshRepodata)
    }))
    entries = entries.flat()
    return entries.reduce((a, b) => {
      if (a.time_build <= b.time_build) {
        return a
      }
      return b
    })
  }

  /**
   * Find the URL of the source RPM for the given RPM data
   * @param {Object} registryData - Registry data for an RPM
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns URL of corresponding source RPM
   */
  async _getSrcRpmUrl(registryData, refreshRepodata = true) {
    var entries = await Promise.all(this.repos.map(async fetcher => {
      var entries = await fetcher._getRpmWithLocation(registryData.rpm_sourcerpm, refreshRepodata)
      entries.forEach(entry => {
        entry.rpmUrl = fetcher.baseUrl + entry.location_href
      })
      return entries
    }))
    entries = entries.flat()
    if (entries.length > 0) {
      return entries[0].rpmUrl
    }
    return null
  }

  _createDocument({ dir, registryData, releaseDate, declaredLicense, hashes }) {
    return { location: dir.name, registryData, releaseDate, declaredLicense, hashes }
  }

  /**
   * Query the RPM repositories for a given spec
   *
   * @param {Object} spec - The CD spec to get RPM data for
   * @param {boolean} refreshRepodata - Whether to update RPM repository data. Should only be false for Unit Tests
   * @returns Data for first matching RPM
   */
  async _getRegistryData(spec, refreshRepodata = true) {
    var entries = await Promise.all(this.repos.map(async fetcher => {
      var entries = await fetcher._getRegistryData(spec, refreshRepodata)
      entries.forEach(entry => {
        entry.rpmUrl = fetcher.baseUrl + entry.location_href
      })
      return entries
    }));
    entries = entries.flat()
    // We may have multiple entries, e.g for "noarch" RPMs present in per-architecture repos.
    if (entries.length > 0) {
      return entries[0]
    }
    return null
  }

  async _getDeclaredLicense(registryData) {
    // Normalize various license names to their SPDX identifier
    var license = registryData.rpm_license
      .replace(/\bASL 2.0\b/ig, "Apache-2.0")
      .replace(/\bLGPLv2\+/ig, "LGPL-2.0-or-later")
      .replace(/\bLGPLv2\b/ig, "LGPL-2.0-only")
      .replace(/\bLGPLv3\+/ig, "LGPL-3.0-or-later")
      .replace(/\bLGPLv3\b/ig, "LGPL-3.0-only")
      .replace(/\bGPLv2\b/ig, "GPL-2.0-only")
      .replace(/\bGPL2\b/ig, "GPL-2.0-only")
      .replace(/\bGPLv2\+/ig, "GPL-2.0-or-later")
      .replace(/\bGPLv3\+/ig, "GPL-3.0-or-later")
      .replace(/\bGPLv3\b/ig, "GPL-3.0-only")
      .replace(/\bBSD\b/ig, "BSD-3-Clause")
      .replace(/\bBoost\b/ig, "BSL-1.0")
      .replace(/\bIBM\b/ig, "IPL-1.0")
    return license
  }

  /**
   * Extract an RPM file
   *
   * @param {string} file - Path to RPM file
   * @param {string} dir - Path to where the RPM should be extracted
   * @returns
   */
  async _extractRpm(file, dir) {
    return new Promise((resolve, reject) => {
      const rpm2cpio = spawn('rpm2cpio', [file]);
      const cpio = spawn('cpio', ['-id', '--quiet'], { cwd: dir });

      rpm2cpio.stdout.on('data', (data) => {
        cpio.stdin.write(data);
      });

      rpm2cpio.stderr.on('data', (data) => {
        console.error(`rpm2cpio stderr: ${data}`);
      });

      rpm2cpio.on('close', (code) => {
        if (code !== 0) {
          console.log(`rpm2cpio process exited with code ${code}`);
        }
        cpio.stdin.end();
      });

      cpio.stderr.on('data', (data) => {
        console.error(`cpio stderr: ${data}`);
      });

      cpio.on('close', (code) => {
        if (code !== 0) {
          console.log(`cpio process exited with code ${code}`);
          reject()
        } else {
          resolve()
        }
      });
    })
  }

  /**
   * Get the package for the given request
   */
  async _getPackage(request, registryData) {
    const file = this.createTempFile(request)
    await this._download(registryData.rpmUrl, file.name)
    const dir = this.createTempDir(request)
    const hashes = await this.computeHashes(file.name)
    await this._extractRpm(file.name, dir.name)

    // attempt to decompress any archives, as source RPMS typically contain the source code
    // in an archive named ${name}-${version}.tar.gz.
    // Remove leading directory in this case, to surface the LICENSE/COPYING files
    // at the top level directory here, as that factors into the overall score.
    const archives = glob.sync(`${dir.name}/{*.xz,*.zip,*.gz}`);
    for (let index = 0; index < archives.length; index++) {
      var archive = archives[index];
      await this.decompress(archive, dir.name, file => {
        var regex = new RegExp(`^${registryData.name}-${registryData.version}\/`);
        file.path = file.path.replace(regex, "");
        return file;
      })
    }

    const releaseDate = DateTime.fromSeconds(registryData.time_build).toJSDate().toISOString();
    const rpmUrl = registryData.rpmUrl
    return { dir, releaseDate, hashes, rpmUrl }
  }
}

/**
 * Determine name, epoch, version, release and architecture of an RPM from a CD spec
 */
function _fromSpec(spec) {
  const { name } = spec
  var remaining
  var epoch
  var decoded_revision = decodeURIComponent(spec.revision)
  if (decoded_revision.includes(':')) {
    [epoch, remaining] = decoded_revision.split(':')
  } else {
    epoch = "0";
    remaining = decoded_revision
  }

  var [version, remaining] = remaining.split('-')
  var parts = remaining.split(".")
  const arch = parts.pop()
  const release = parts.join(".")
  return { name, epoch, version, release, arch }
}

module.exports = { RpmFetch, RpmRepo }
