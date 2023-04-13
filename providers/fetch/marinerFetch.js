// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { RpmRepo, RpmFetch } = require('./rpmFetch')

class MarinerFetch extends RpmFetch {
  constructor(options) {
    super([new RpmRepo({
      baseUrl: "https://packages.microsoft.com/cbl-mariner/2.0/prod/base/x86_64/",
      cdFileLocation: options.cdFileLocation + "/mariner-base-2.0-x86"
    }),
    new RpmRepo({
      baseUrl: "https://packages.microsoft.com/cbl-mariner/2.0/prod/base/aarch64/",
      cdFileLocation: options.cdFileLocation + "/mariner-base-2.0-arm"
    }),
    new RpmRepo({
      baseUrl: "https://packages.microsoft.com/cbl-mariner/2.0/prod/base/srpms/",
      cdFileLocation: options.cdFileLocation + "/mariner-base-2.0-sources"
    })], options)
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'mariner'
  }
}

module.exports = options => new MarinerFetch(options)
