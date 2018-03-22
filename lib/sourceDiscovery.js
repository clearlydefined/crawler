// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const _ = require('lodash')
const ghrequestor = require('ghrequestor')
const request = require('requestretry')
// TODO why not parse-github-repo-url (10x more downloads)
const parseGitHubUrl = require('parse-github-url')
const SourceSpec = require('./sourceSpec')

/**
 * Discover the soruce revision corresponding to a set of priority ordered candidata source URLs.
 * For each candidate URL determine if it is a known source repository, then check it has some source
 * related to the given version. If so, return the source control system-specific revision
 * that matches the version.
 *
 * @param version the version to discover
 * @param candidateUrls priority list of candidate URLs
 */

// TODO remove the need for options to be passed in/around like this. Make a "service" facility
// in the crawler and then instantiate source discovery as one of those with its own configuration.
module.exports = async function searchForRevisions(version, candidateUrls, options) {
  if (!candidateUrls || candidateUrls.length === 0) return null

  // TODO rationalize this and don't assume everything is coming from GitHub.
  const resolved = resolveGitHubLocations(_.uniq(candidateUrls))
  for (let candidate of resolved) {
    const revisionInfo = await discoverRevision(version, candidate, options)
    if (revisionInfo) return revisionInfo
  }
  return null
}

async function discoverRevision(version, candidate, options) {
  const provider = getProvider(candidate)
  switch (provider) {
    case 'github': {
      const tag = await discoverFromGitHubTags(version, candidate, options)
      if (!tag) return null
      const url = `https://github.com/${candidate.owner}/${candidate.name}`
      return tag ? new SourceSpec('git', 'github', url, tag.revision) : null
    }
    // TODO add more handlers here (e.g., gitlab, bitbucket, ...)
    default:
      return null
  }
}

function resolveGitHubLocations(locations) {
  const result = locations
    .map(location => {
      var parsedUrl = parseGitHubUrl(location)
      return parsedUrl && parsedUrl.owner && parsedUrl.name ? parsedUrl : null
    })
    .filter(e => e)
  return _.uniqWith(result, (a, b) => a.owner === b.owner && a.name === b.name)
}

// TODO don't use this right now. Leaving here as a backup/record of doing ref based vs tag based lookup.
// tag-based is easier etc but may not be as complete.
async function discoverFromGitHubRefs(version, candidate, options) {
  const headers = {
    'User-Agent': 'clearlydefined/scanning'
  }
  const token = options.githubToken
  if (token) headers.Authorization = 'token ' + token

  const owner = encodeURIComponent(candidate.owner)
  const name = encodeURIComponent(candidate.name)
  const url = `https://api.github.com/repos/${owner}/${name}/git/refs/tags`
  try {
    const refs = await ghrequestor.getAll(url, {
      headers,
      maxAttempts: 3,
      retryDelay: 250,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
      tokenLowerBound: 10,
      json: true
    })
    if (!refs) return null
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      if (ref.ref.endsWith(`/${version}`) || ref.ref.endsWith(`/v${version}`))
        return { url: ref.object.url, revision: ref.object.sha }
    }
    //  TODO have to do more here. Have to deref the ref and see what sha that points to
  } catch (error) {
    // TODO do better here
    console.log(`${url} ${error}`)
  }
}

async function discoverFromGitHubTags(version, candidate, options) {
  const headers = {
    'User-Agent': 'clearlydefined/scanning'
  }
  const token = options.githubToken
  if (token) headers.Authorization = 'token ' + token

  const url = `https://api.github.com/repos/${encodeURIComponent(candidate.owner)}/${encodeURIComponent(
    candidate.name
  )}/tags`
  try {
    const tags = await ghrequestor.getAll(url, {
      headers,
      maxAttempts: 3,
      retryDelay: 250,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
      tokenLowerBound: 10,
      json: true
    })
    if (!tags) return null
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i]
      if (tag.name === version || tag.name === `v${version}`) return { url: tag.commit.url, revision: tag.commit.sha }
    }
    console.log(`Failed to find GitHub tag for ${url}`)
    return null
  } catch (error) {
    // TODO do better here
    console.log(`Failed finding GitHub tag for ${url} ${error}`)
  }
}

function getProvider(location) {
  const lowerUrl = location && location.href ? location.href.toLowerCase() : ''
  if (lowerUrl.includes('github.com')) {
    return 'github'
  }
  // TODO add other source location extractors
  console.log(`SourceDiscovery provider could not be found for ${lowerUrl}`)
  return null
}
