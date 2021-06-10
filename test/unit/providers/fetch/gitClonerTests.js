const expect = require('chai').expect
const sinon = require('sinon')
const gitCloner = require('../../../../providers/fetch/gitCloner')

const gitlab_stub = 'https://gitlab.com/'
const github_stub = 'https://github.com/'
const cloner = gitCloner({})
describe('building git urls', () => {
  it('builds a gitlab url', () => {
    expect(cloner._buildUrl(spec('git', 'gitlab', 'namespace', 'repo', 'abc123'))).to.equal(gitlab_stub + 'namespace/repo.git')
    expect(cloner._buildUrl(spec('git', 'gitlab', 'name.space.thing', 'repo', 'abc123'))).to.equal(gitlab_stub + 'name/space/thing/repo.git')
  })

  it('builds a github url', () => {
    expect(cloner._buildUrl(spec('git', 'github', 'namespace', 'repo', 'abc123'))).to.equal(github_stub + 'namespace/repo.git')
  })
})

function spec(type, provider, namespace, name, revision) {
  return { type, provider: provider, namespace, name, revision }
}
