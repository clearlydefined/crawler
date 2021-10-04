// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const EntitySpec = require('../../../lib/entitySpec')

describe('entitySpec', () => {
  it('creates an EntitySpec from a url', () => {
    const entityFromUrl = EntitySpec.fromUrl('cd:/go/golang/rsc.io/quote/v3.1.0')
    expect(entityFromUrl.type).to.eq('go')
    expect(entityFromUrl.provider).to.eq('golang')
    expect(entityFromUrl.name).to.eq('quote')
    expect(entityFromUrl.revision).to.eq('v3.1.0')
  })
})