// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const EntitySpec = require('../../../lib/entitySpec')

describe('entitySpec', () => {
  it('creates an EntitySpec from a url', () => {
    const entityFromUrl = EntitySpec.fromUrl('cd:/go/golang/rsc.io/quote/v3.1.0')

    expect(entityFromUrl.type).to.eq('go')
    expect(entityFromUrl.provider).to.eq('golang')
    expect(entityFromUrl.namespace).to.eq('rsc.io')
    expect(entityFromUrl.name).to.eq('quote')
    expect(entityFromUrl.revision).to.eq('v3.1.0')
  })

  it('creates an EntitySpec from a url without a revision', () => {
    const entityFromUrl = EntitySpec.fromUrl('cd:/go/golang/rsc.io/quote')

    expect(entityFromUrl.type).to.eq('go')
    expect(entityFromUrl.provider).to.eq('golang')
    expect(entityFromUrl.namespace).to.eq('rsc.io')
    expect(entityFromUrl.name).to.eq('quote')
    expect(entityFromUrl.revision).to.be.null
  })

  it('creates an EntitySpec from a complex go url', () => {
    const entityFromUrl = EntitySpec.fromUrl('cd:/go/golang/gopkg.in/natefinch/lumberjack.v2/v2.2.1')

    expect(entityFromUrl.type).to.eq('go')
    expect(entityFromUrl.provider).to.eq('golang')
    expect(entityFromUrl.namespace).to.eq('gopkg.in')
    expect(entityFromUrl.name).to.eq('natefinch/lumberjack.v2')
    expect(entityFromUrl.revision).to.eq('v2.2.1')
  })

  it('creates an EntitySpec from a complex go url without a revision', () => {
    const entityFromUrl = EntitySpec.fromUrl('cd:/go/golang/gopkg.in/natefinch/lumberjack.v2')

    expect(entityFromUrl.type).to.eq('go')
    expect(entityFromUrl.provider).to.eq('golang')
    expect(entityFromUrl.namespace).to.eq('gopkg.in')
    expect(entityFromUrl.name).to.eq('natefinch/lumberjack.v2')
    expect(entityFromUrl.revision).to.be.null
  })

  it('creates an EntitySpec from a Maven url', () => {
    const entityFromUrl = EntitySpec.fromUrl(
      'cd:/maven/mavencentral/org.eclipse.xtext/org.eclipse.xtext.common.types/2.25.0'
    )

    expect(entityFromUrl.namespace).to.eq('org.eclipse.xtext')
    expect(entityFromUrl.name).to.eq('org.eclipse.xtext.common.types')
    expect(entityFromUrl.revision).to.eq('2.25.0')
  })
})
