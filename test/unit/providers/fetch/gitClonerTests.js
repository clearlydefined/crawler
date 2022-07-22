const expect = require('chai').expect
const sinon = require('sinon')
const gitCloner = require('../../../../providers/fetch/gitCloner')
const Request = require('../../../../ghcrawler').request

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

describe('fetch result', () => {
  let gitClient
  beforeEach(() => {
    gitClient = gitCloner({ logger: { log: sinon.stub() } })
    gitClient._cloneRepo = sinon.stub().resolves(532)
    gitClient._getRevision = sinon.stub().resolves('deef80a18aa929943e5dab1dba7276c231c84519')
    gitClient._getDate = sinon.stub().resolves(new Date('2021-04-08T13:27:49.000Z'))
  })

  it('fetch success', async () => {
    const request = await gitClient.handle(new Request('licensee', 'cd:git/github/palantir/refreshable/2.0.0'))
    request.fetchResult.copyTo(request)
    expect(request.url).to.be.equal('cd:/git/github/palantir/refreshable/deef80a18aa929943e5dab1dba7276c231c84519')
    expect(request.meta.gitSize).to.be.equal(532)
    expect(request.contentOrigin).to.be.equal('origin')
    expect(request.casedSpec.toUrl()).to.be.equal('cd:/git/github/palantir/refreshable/deef80a18aa929943e5dab1dba7276c231c84519')
    expect(request.document.size).to.be.equal(532)
    expect(request.document.releaseDate.toISOString()).to.be.equal('2021-04-08T13:27:49.000Z')
    expect(request.getTrackedCleanups().length).to.be.equal(0)
  })

  it('fetch failed', async () => {
    gitClient._getDate = sinon.stub().rejects('failed')
    const request = new Request('licensee', 'cd:git/github/palantir/refreshable/2.0.0')
    try {
      await gitClient.handle(request)
    } catch (error) {
      expect(request.fetchResult).to.be.undefined
      expect(request.getTrackedCleanups().length).to.be.equal(1)
    }
  })
})

function spec(type, provider, namespace, name, revision) {
  return { type, provider: provider, namespace, name, revision }
}
