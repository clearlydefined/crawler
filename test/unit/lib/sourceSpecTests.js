// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const SourceSpec = require('../../../lib/sourceSpec')

describe('sourceSpec', () => {
  it('creates maven url/urn', () => {
    const spec = new SourceSpec('maven', 'mavencentral', 'com.group', 'a1', '1.0.0')
    expect(spec.toUrl()).to.eq('https://search.maven.org/remotecontent?filepath=com/group/a1/1.0.0/a1-1.0.0.jar')
    expect(spec.toUrn()).to.eq('urn:maven:mavencentral:com.group:a1:revision:1.0.0')
  })

  it('creates maven url/urn', () => {
    const spec = new SourceSpec('maven', 'mavengoogle', 'androidx.activity', 'activity', '1.3.0-alpha05')
    expect(spec.toUrl()).to.eq('https://dl.google.com/android/maven2/androidx/activity/activity/1.3.0-alpha05/activity-1.3.0-alpha05.jar')
    expect(spec.toUrn()).to.eq('urn:maven:mavengoogle:androidx.activity:activity:revision:1.3.0-alpha05')
  })

  it('creates github url/urn', () => {
    const spec = new SourceSpec('git', 'github', 'org', 'repo', '123456')
    expect(spec.toUrl()).to.eq('https://github.com/org/repo.git')
    expect(spec.toUrn()).to.eq('urn:git:github:org:repo:revision:123456')
  })

  it('creates gitlab url/urn', () => {
    const spec = new SourceSpec('git', 'gitlab', 'org', 'repo', '123456')
    expect(spec.toUrl()).to.eq('https://gitlab.com/org/repo.git')
    expect(spec.toUrn()).to.eq('urn:git:gitlab:org:repo:revision:123456')
  })

  it('returns null urls for unsupported providers', () => {
    const spec = new SourceSpec('git', 'unsupport', 'org', 'repo', '123456')
    expect(spec.toUrl()).to.be.null
  })
})
