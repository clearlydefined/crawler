const { expect } = require('chai')
const MavenBasedFetch = require('../../../../providers/fetch/mavenBasedFetch')

describe('MavenBasedFetch', () => {
  describe('find contained file stat', () => {
    it('file contained in root dir', async () => {
      const destination = 'test/fixtures/package1'
      const file = await MavenBasedFetch._findAnyFileStat(destination)
      expect(file.mtime).to.be.ok
      expect(file.mtime.toISOString().includes('2022-02-24'))
    })
    it('file contained in nested dir', async () => {
      const destination = 'test/fixtures/recursivedir'
      const file = await MavenBasedFetch._findAnyFileStat(destination)
      expect(file.mtime).to.be.ok
      expect(file.mtime.toISOString().includes('2022-02-24'))
    })
  })
})