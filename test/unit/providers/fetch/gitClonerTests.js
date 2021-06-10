const expect = require('chai').expect
const sinon = require('sinon')
const gitCloner = require('../../../../providers/fetch/gitCloner')

const stub = 'https://gitlab.com/'
describe('building git urls', () => {
  it('builds a gitlab url', () => {
    const cloner = gitCloner({})
    expect(cloner._buildUrl(gitlab_spec('git', 'namespace', 'repo', 'abc123'))).to.equal(stub + 'namespace/repo.git')
    expect(cloner._buildUrl(gitlab_spec('git', 'name.space.thing', 'repo', 'abc123'))).to.equal(stub + 'name/space/thing/repo.git')

  })
})

function gitlab_spec(type, namespace, name, revision) {
  return { type, provider: 'gitlab', namespace, name, revision }
}