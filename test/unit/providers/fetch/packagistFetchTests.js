// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
// const sinon = require('sinon')
const PackagistFetch = require('../../../../providers/fetch/packagistFetch')
// const EntitySpec = require('../../../../lib/entitySpec')
// const proxyquire = require('proxyquire')
const Request = require('ghcrawler').request
// const fs = require('fs')

it('can handle the request being attempted', async () => {
  expect(PackagistFetch({}).canHandle(new Request('test', 'cd:/composer/packagist/symfony/polyfill-mbstring/0.3.0'))).to
    .be.true
})

it('succeeds in download of package data', async () => {
  // var data = await PackagistFetch({}).handle(
  //   new Request('test', 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0')
  // )
})
