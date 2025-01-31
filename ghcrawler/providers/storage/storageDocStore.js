// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line no-unused-vars
const { ContainerClient } = require('@azure/storage-blob')
const memoryCache = require('memory-cache')
const { Readable } = require('stream')
const URL = require('url')

/**
 * @typedef {{[propertyName: string]: string}} BlobMetadata
 */

class AzureStorageDocStore {
  /**
   * @param {ContainerClient} containerClient
   * @param {object} options
   * @param {string} options.blobKey
   * @param {boolean} options.preserveCase
   * @param {string} options.container
   */
  constructor(containerClient, options) {
    this.containerClient = containerClient
    this.options = options
    this._getBlobNameFromKey = this.options.blobKey === 'url' ? this._getBlobNameFromUrl : this._getBlobNameFromUrn
  }

  async connect() {
    await this._createContainer()
  }

  async _createContainer() {
    await this.containerClient.createIfNotExists()
  }

  /**
   * @param {{ _metadata: any; }} document
   */
  async upsert(document) {
    const blobName = this._getBlobNameFromDocument(document)
    /** @type BlobMetadata */
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
    const options = { metadata: blobMetadata, blobHTTPHeaders: { blobContentType: 'application/json' } }
    const dataStream = new Readable()
    dataStream.push(JSON.stringify(document))
    dataStream.push(null)
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    await blockBlobClient.uploadStream(dataStream, 8 << 20, 5, options)
  }

  /**
   * @param {string} type
   * @param {string} key
   */
  async get(type, key) {
    const blobName = this._getBlobNameFromKey(type, key)
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    const downloadBlockBlobResponse = await blockBlobClient.download(0)
    const downloaded = await this._streamToString(downloadBlockBlobResponse.readableStreamBody)
    return JSON.parse(downloaded)
  }

  /**
   * @param {string} type
   * @param {string} key
   */
  async etag(type, key) {
    const blobName = this._getBlobNameFromKey(type, key)
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    const properties = await blockBlobClient.getProperties()
    return properties.etag
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  /**
   * @param {string} type
   * @returns {Promise<BlobMetadata[]>}
   */
  async list(type) {
    this._ensureDeadletter(type)
    let entries = []
    for await (const blob of this.containerClient.listBlobsFlat({ includeMetadata: true })) {
      const blobMetadata = blob.metadata
      if (blobMetadata) {
        entries.push({
          version: blobMetadata.version,
          etag: blobMetadata.etag,
          type: blobMetadata.type,
          url: blobMetadata.url,
          urn: blobMetadata.urn,
          fetchedAt: blobMetadata.fetchedat,
          processedAt: blobMetadata.processedat,
          extra: blobMetadata.extra ? JSON.parse(blobMetadata.extra) : undefined
        })
      }
    }
    return entries
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  /**
   * @param {string} type
   * @param {string} key
   */
  async delete(type, key) {
    this._ensureDeadletter(type)
    const blobName = this._getBlobNameFromKey(type, key)
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    await blockBlobClient.delete()
  }

  // This API can only be used for the 'deadletter' store because we cannot look up documents by type performantly
  /**
   * @param {string} type
   * @param {boolean} [force]
   * @returns {Promise<number>}
   */
  async count(type, force = false) {
    this._ensureDeadletter(type)
    const key = `${this.options.container}:count:${type || ''}`
    if (!force) {
      const cachedCount = memoryCache.get(key)
      if (cachedCount) {
        return cachedCount
      }
    }
    let entryCount = 0
    // TODO check if this is the right way to get the count
    // const properties = await this.containerClient.getProperties()
    // properties.blobCount
    // eslint-disable-next-line no-unused-vars
    for await (const _ of this.containerClient.listBlobsFlat()) {
      entryCount++
    }
    memoryCache.put(key, entryCount, 60000)
    return entryCount
  }

  async close() {
    return
  }

  /**
   * @param {string} type
   */
  _ensureDeadletter(type) {
    if (type !== 'deadletter') {
      throw new Error('This API is only supported for deadletter.')
    }
  }

  /**
   * @param {{ _metadata: any; }} document
   */
  _getBlobNameFromDocument(document) {
    const type = document._metadata.type
    if (this.options.blobKey === 'url') {
      return this._getBlobNameFromUrl(type, document._metadata.url)
    }
    return this._getBlobNameFromUrn(type, document._metadata.links.self.href.toLowerCase())
  }

  /**
   * @param {string} type
   * @param {string} url
   * @returns {string}
   */
  _getBlobNameFromUrl(type, url) {
    if (url.startsWith('urn:')) {
      return url
    }
    const parsed = URL.parse(url, true)
    return `${type}${this.options.preserveCase ? parsed.path : parsed.path?.toLowerCase()}.json`
  }

  /**
   * @param {string} type
   * @param {string} urn
   * @returns {string}
   */
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

  /**
   * @param {string} type
   * @param {string} urn
   */
  _getBlobNameFromUrn(type, urn) {
    if (!urn.startsWith('urn:')) {
      return urn
    }
    return `${this._getBlobPathFromUrn(type, urn)}.json`
  }

  /**
   * @param {NodeJS.ReadableStream | undefined} readableStream
   */
  async _streamToString(readableStream) {
    if (!readableStream) {
      // no stream, no data
      return ''
    }
    return new Promise((resolve, reject) => {
      /** @type {string[]} */
      const chunks = []
      readableStream.on('data', data => {
        chunks.push(data.toString())
      })
      readableStream.on('end', () => {
        resolve(chunks.join(''))
      })
      readableStream.on('error', reject)
    })
  }
}

module.exports = AzureStorageDocStore
