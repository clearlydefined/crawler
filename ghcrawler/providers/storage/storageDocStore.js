// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const azure = require('azure-storage')
const memoryCache = require('memory-cache')
const { Readable } = require('stream')
const URL = require('url')

class AzureStorageDocStore {
  constructor(blobService, name, options) {
    this.service = blobService
    this.name = name
    this.options = options
    this._getBlobNameFromKey = this.options.blobKey === 'url' ? this._getBlobNameFromUrl : this._getBlobNameFromUrn
  }

  async connect() {
    return this._createContainer(this.name)
  }

  async _createContainer(name) {
    return new Promise((resolve, reject) => {
      this.service.createContainerIfNotExists(name, error => {
        if (error) {
          return reject(error)
        }
        resolve(this.service)
      })
    })
  }

  async upsert(document) {
    const blobName = this._getBlobNameFromDocument(document)
    const blobMetadata = {
      version: document._metadata.version,
      etag: document._metadata.etag,
      type: document._metadata.type,
      url: document._metadata.url,
      urn: document._metadata.links.self.href,
      fetchedat: document._metadata.fetchedAt,
      processedat: document._metadata.processedAt
    }
    if (document._metadata.extra) {
      blobMetadata.extra = JSON.stringify(document._metadata.extra)
    }
    const options = { metadata: blobMetadata, contentSettings: { contentType: 'application/json' } }
    const dataStream = new Readable()
    dataStream.push(JSON.stringify(document))
    dataStream.push(null)
    return new Promise((resolve, reject) => {
      dataStream
        .pipe(this.service.createWriteStreamToBlockBlob(this.name, blobName, options))
        .on('error', error => {
          return reject(error)
        })
        .on('finish', () => {
          resolve(blobName)
        })
    })
  }

  // TODO: Consistency on whether key is a URL or URN
  async get(type, key) {
    const blobName = this._getBlobNameFromKey(type, key)
    return new Promise((resolve, reject) => {
      this.service.getBlobToText(this.name, blobName, (error, text) => {
        if (error) {
          return reject(error)
        }
        const result = JSON.parse(text)
        resolve(result)
      })
    })
  }

  // TODO: Consistency on whether key is a URL or URN
  async etag(type, key) {
    const blobName = this._getBlobNameFromKey(type, key)
    return new Promise(resolve => {
      this.service.getBlobMetadata(this.name, blobName, (error, blob) => {
        resolve(error ? null : blob.metadata.etag)
      })
    })
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  async list(type) {
    this._ensureDeadletter(type)
    let entries = []
    let continuationToken = null
    do {
      const result = await new Promise((resolve, reject) => {
        this.service.listBlobsSegmented(
          this.name,
          continuationToken,
          {
            include: azure.BlobUtilities.BlobListingDetails.METADATA,
            location: azure.StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY
          },
          (error, response) => {
            if (error) {
              continuationToken = null
              reject(error)
            }
            return resolve(response)
          })
      })
      entries = entries.concat(
        result.entries.map(entry => {
          const blobMetadata = entry.metadata
          return {
            version: blobMetadata.version,
            etag: blobMetadata.etag,
            type: blobMetadata.type,
            url: blobMetadata.url,
            urn: blobMetadata.urn,
            fetchedAt: blobMetadata.fetchedat,
            processedAt: blobMetadata.processedat,
            extra: blobMetadata.extra ? JSON.parse(blobMetadata.extra) : undefined
          }
        })
      )
    } while (continuationToken && entries.length < 10000)
    return entries
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  async delete(type, key) {
    this._ensureDeadletter(type)
    const blobName = this._getBlobNameFromKey(type, key)
    return new Promise((resolve, reject) => {
      this.service.deleteBlob(this.name, blobName, error => {
        if (error) {
          return reject(error)
        }
        resolve(true)
      })
    })
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  async count(type, force = false) {
    this._ensureDeadletter(type)
    const key = `${this.name}:count:${type || ''}`
    if (!force) {
      const cachedCount = memoryCache.get(key)
      if (cachedCount) {
        return cachedCount
      }
    }
    let entryCount = 0
    let continuationToken = null
    do {
      const result = await new Promise((resolve, reject) => {
        this.service.listBlobsSegmented(
          this.name,
          continuationToken,
          { location: azure.StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY },
          (error, response) => {
            if (error) {
              continuationToken = null
              reject(error)
            }
            return resolve(response)
          })
      })
      entryCount += result.entries.length
    } while (continuationToken)
    memoryCache.put(key, entryCount, 60000)
    return entryCount
  }

  async close() {
    return
  }

  _ensureDeadletter(type) {
    if (type !== 'deadletter') {
      throw new Error('This API is only supported for deadletter.')
    }
  }

  _getBlobNameFromDocument(document) {
    const type = document._metadata.type
    if (this.options.blobKey === 'url') {
      return this._getBlobNameFromUrl(type, document._metadata.url)
    }
    return this._getBlobNameFromUrn(type, document._metadata.links.self.href.toLowerCase())
  }

  _getBlobNameFromUrl(type, url) {
    if (url.startsWith('urn:')) {
      return url
    }
    const parsed = URL.parse(url, true)
    return `${type}${this.options.preserveCase ? parsed.path : parsed.path.toLowerCase()}.json`
  }

  _getBlobPathFromUrn(type, urn) {
    if (!urn) {
      return ''
    }
    if (!urn.startsWith('urn:')) {
      return urn
    }
    const pathed = urn.startsWith('urn:') ? urn.slice(4) : urn
    const replaced = pathed.replace(/:/g, '/')
    return this.options.preserveCase ? replaced : replaced.toLowerCase()
  }

  _getBlobNameFromUrn(type, urn) {
    if (!urn.startsWith('urn:')) {
      return urn
    }
    return `${this._getBlobPathFromUrn(type, urn)}.json`
  }
}

module.exports = AzureStorageDocStore
