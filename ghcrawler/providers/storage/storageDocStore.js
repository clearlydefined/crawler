// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const async = require('async')
const azure = require('azure-storage')
const memoryCache = require('memory-cache')
const Q = require('q')
const { Readable } = require('stream')
const URL = require('url')

class AzureStorageDocStore {
  constructor(blobService, name, options) {
    this.service = blobService
    this.name = name
    this.options = options
    this._getBlobNameFromKey = this.options.blobKey === 'url' ? this._getBlobNameFromUrl : this._getBlobNameFromUrn
  }

  connect() {
    return this._createContainer(this.name)
  }

  _createContainer(name) {
    const deferred = Q.defer()
    this.service.createContainerIfNotExists(name, error => {
      if (error) {
        return deferred.reject(error)
      }
      deferred.resolve(this.service)
    })
    return deferred.promise
  }

  upsert(document) {
    const deferred = Q.defer()
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
    dataStream
      .pipe(this.service.createWriteStreamToBlockBlob(this.name, blobName, options))
      .on('error', error => {
        return deferred.reject(error)
      })
      .on('finish', () => {
        deferred.resolve(blobName)
      })
    return deferred.promise
  }

  // TODO: Consistency on whether key is a URL or URN
  get(type, key) {
    const deferred = Q.defer()
    const blobName = this._getBlobNameFromKey(type, key)
    this.service.getBlobToText(this.name, blobName, (error, text) => {
      if (error) {
        return deferred.reject(error)
      }
      const result = JSON.parse(text)
      deferred.resolve(result)
    })
    return deferred.promise
  }

  // TODO: Consistency on whether key is a URL or URN
  etag(type, key) {
    const deferred = Q.defer()
    const blobName = this._getBlobNameFromKey(type, key)
    this.service.getBlobMetadata(this.name, blobName, (error, blob) => {
      deferred.resolve(error ? null : blob.metadata.etag)
    })
    return deferred.promise
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  list(type) {
    this._ensureDeadletter(type)
    var entries = []
    var continuationToken = null
    const deferred = Q.defer()
    async.doWhilst(
      callback => {
        this.service.listBlobsSegmented(
          this.name,
          continuationToken,
          {
            include: azure.BlobUtilities.BlobListingDetails.METADATA,
            location: azure.StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY
          },
          function(err, result) {
            // metricsClient.trackDependency(url.parse(blobService.host.primaryHost).hostname, 'listBlobsSegmented', (new Date().getTime() - started), !err, "Http", { 'Container name': 'download', 'Continuation token present': result == null ? false : (result.continuationToken != null), 'Blob count': result == null ? 0 : result.entries.length });

            if (err) {
              continuationToken = null
              // metricsClient.trackError(err);
              callback(err)
            }
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
            callback(null)
          }
        )
      },
      function() {
        return continuationToken !== null && entries.length < 10000
      },
      function(err) {
        if (err) {
          return deferred.reject(err)
        }
        deferred.resolve(entries)
      }
    )
    return deferred.promise
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  delete(type, key) {
    this._ensureDeadletter(type)
    const deferred = Q.defer()
    const blobName = this._getBlobNameFromKey(type, key)
    this.service.deleteBlob(this.name, blobName, error => {
      if (error) {
        return deferred.reject(error)
      }
      deferred.resolve(true)
    })
    return deferred.promise
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  count(type, force = false) {
    this._ensureDeadletter(type)
    const key = `${this.name}:count:${type || ''}`
    if (!force) {
      const cachedCount = memoryCache.get(key)
      if (cachedCount) {
        return Q(cachedCount)
      }
    }
    var entryCount = 0
    var continuationToken = null
    const deferred = Q.defer()
    async.doWhilst(
      callback => {
        this.service.listBlobsSegmented(
          this.name,
          continuationToken,
          { location: azure.StorageUtilities.LocationMode.PRIMARY_THEN_SECONDARY },
          function(err, result) {
            if (err) {
              continuationToken = null
              callback(err)
            }
            entryCount += result.entries.length
            callback(null)
          }
        )
      },
      function() {
        return continuationToken !== null
      },
      function(err) {
        if (err) {
          return deferred.reject(err)
        }
        memoryCache.put(key, entryCount, 60000)
        deferred.resolve(entryCount)
      }
    )
    return deferred.promise
  }

  close() {
    return Q()
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
