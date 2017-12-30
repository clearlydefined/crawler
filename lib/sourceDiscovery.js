// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const _ = require('lodash');
const ghrequestor = require('ghrequestor');
const request = require('requestretry');
// TODO why not parse-github-repo-url (10x more downloads)
const parseGitHubUrl = require('parse-github-url');
const SourceSpec = require('./sourceSpec');

/**
 * Discover the soruce revision corresponding to a set of priority ordered candidata source URLs.
 * For each candidate URL determine if it is a known source repository, then check it has some source
 * related to the given version. If so, return the source control system-specific revision
 * that matches the version.
 *
 * @param version the version to discover
 * @param candidateUrls priority list of candidate URLs
 */
module.exports = async function searchForRevisions(version, candidateUrls) {
  if (!candidateUrls || candidateUrls.length === 0)
    return null;

  for (let candidate of _.uniq(candidateUrls)) {
    const revisionInfo = await discoverRevision(version, candidate);
    if (revisionInfo)
      return revisionInfo;
  }
  return null;
}

async function discoverRevision(version, candidate) {
  const provider = getProvider(candidate)
  switch (provider) {
    case 'github': {
      var parsedUrl = parseGitHubUrl(candidate);
      if (!(parsedUrl && parsedUrl.owner && parsedUrl.name))
        return null;
      const ref = await discoverFromGitHub(version, parsedUrl);
      if (!ref)
        return null;
      const result = new SourceSpec('git', 'github', candidate, ref.revision);
      // Stash provider-specific info on the source spec for easier future processing.
      // TODO consider getting the numeric id of the repo for durability
      result.github = { owner: parsedUrl.owner, name: parsedUrl.name };
      return result;
    }
    // TODO add more handlers here (e.g., gitlab, bitbucket, ...)
    default:
      return null;
  }
}

async function discoverFromGitHub(version, parsedUrl) {
  try {
    const headers = {
      'User-Agent': 'clearlydefined/scanning',
    };
    const token = config.get('CRAWLER_GITHUB_TOKEN');
    if (token)
      headers.Authorization = 'token ' + token;

    const refs = await ghrequestor.getAll(`https://api.github.com/repos/${encodeURIComponent(parsedUrl.owner)}/${encodeURIComponent(parsedUrl.name)}/git/refs`, {
      headers,
      maxAttempts: 3,
      retryDelay: 250,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
      tokenLowerBound: 10,
      json: true
    });
    if (!refs)
      return null;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.ref.endsWith(`/${version}`) || ref.ref.endsWith(`/v${version}`))
        return { url: ref.object.url, revision: ref.object.sha };
    }
  }
  catch (error) {
    console.log(error);
  }
}

function getProvider(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.indexOf('github.com'))
    return 'github';
  // TODO add other source location extractors
  return null
}