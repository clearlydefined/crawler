// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { uniq, uniqWith } = require('lodash')
const ghrequestor = require('ghrequestor')
const request = require('requestretry')
const geit = require('geit')
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
  const resolved = resolveGitHubLocations(uniq(candidateUrls))
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
      const sha = await discoverFromGitHubTags(version, candidate, options)
      if (!sha) return null
      return new SourceSpec('git', 'github', candidate.owner, candidate.name, sha)
    }
    // TODO add more handlers here (e.g., gitlab, bitbucket, ...)
    default:
      return null
  }
}

function resolveGitHubLocations(locations) {
  const result = locations
    .map(location => {
      var parsedUrl = location ? parseGitHubUrl(location) : null
      return parsedUrl && parsedUrl.owner && parsedUrl.name ? parsedUrl : null
    })
    .filter(e => e)
  return uniqWith(result, (a, b) => a.owner === b.owner && a.name === b.name)
}

// TODO don't use this right now. Leaving here as a backup/record of doing ref based vs tag based lookup.
// tag-based is easier etc but may not be as complete.
// eslint-disable-next-line no-unused-vars
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

async function discoverFromGitHubTags(version, candidate) {
  const repo = geit(
    `https://github.com/${encodeURIComponent(candidate.owner)}/${encodeURIComponent(candidate.name)}.git`
  )
  const refs = await repo.refs()
  return (
    refs[`refs/tags/${version}^{}`] ||
    refs[`refs/tags/v${version}^{}`] ||
    refs[`refs/tags/${version}`] ||
    refs[`refs/tags/v${version}`]
  )
}

function getProvider(location) {
  const lowerUrl = location && location.href ? location.href.toLowerCase() : ''
  if (lowerUrl.includes('github')) {
    return 'github'
  }
  // TODO add other source location extractors
  console.log(`SourceDiscovery provider could not be found for ${lowerUrl}`)
  return null
}
