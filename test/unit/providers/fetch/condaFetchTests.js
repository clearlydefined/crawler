const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const { promisify } = require('util')
const CondaFetch = require('../../../../providers/fetch/condaFetch.js')
const Request = require('../../../../ghcrawler/lib/request.js')

describe('condaFetch', () => {
  let fetch
  beforeEach(() => {
    fetch = CondaFetch({ logger: { info: sinon.stub() } })
    fetch._getChannelData = sinon.stub().resolves(
      {
        'channeldata_version': 1,
        'packages': {
          '21cmfast': {
            'activate.d': false,
            'binary_prefix': true,
            'deactivate.d': false,
            'description': '21cmFAST provides a simple and fast simulation package for the cosmological 21cm signal as either coeval cubes or full lightcones.',
            'dev_url': 'https://github.com/21cmFAST/21cmFAST',
            'doc_url': 'https://21cmFAST.readthedocs.io/',
            'home': 'https://github.com/21cmFAST/21cmFAST',
            'license': 'MIT',
            'post_link': false,
            'pre_link': false,
            'pre_unlink': false,
            'run_exports': {},
            'source_url': 'https://pypi.io/packages/source/2/21cmFAST/21cmFAST-3.3.1.tar.gz',
            'subdirs': ['linux-64', 'osx-64'],
            'summary': 'A semi-numerical cosmological simulation code for the 21cm signal',
            'text_prefix': true,
            'timestamp': 1651260314,
            'version': '3.3.1'
          }
        }
      }
    )

    fetch._getRepoData = sinon.stub().resolves(
      {
        'info': {
          'subdir': 'linux-64'
        },
        'packages': {
          '21cmfast-3.0.2-py36h1af98f8_1.tar.bz2': { 'build': 'py36h1af98f8_1', 'build_number': 1, 'depends': ['_openmp_mutex >=4.5', 'astropy >=2.0', 'cached-property', 'cffi >=1.0', 'click', 'fftw >=3.3.8,<4.0a0', 'gsl >=2.6,<2.7.0a0', 'h5py >=2.8.0', 'libblas >=3.8.0,<4.0a0', 'libgcc-ng >=7.5.0', 'matplotlib-base', 'numpy', 'python >=3.6,<3.7.0a0', 'python_abi 3.6.* *_cp36m', 'pyyaml', 'scipy'], 'license': 'MIT', 'license_family': 'MIT', 'md5': 'd65ab674acf3b7294ebacaec05fc5b54', 'name': '21cmfast', 'sha256': '1154fceeb5c4ee9bb97d245713ac21eb1910237c724d2b7103747215663273c2', 'size': 414494, 'subdir': 'linux-64', 'timestamp': 1605110689658, 'version': '3.0.2' },
          '21cmfast-3.0.2-py36h2e3f83d_0.tar.bz2': { 'build': 'py36h2e3f83d_0', 'build_number': 0, 'depends': ['_openmp_mutex >=4.5', 'astropy >=2.0', 'cached-property', 'cffi >=1.0', 'click', 'fftw >=3.3.8,<4.0a0', 'gsl >=2.6,<2.7.0a0', 'h5py >=2.8.0', 'libblas >=3.8.0,<4.0a0', 'libgcc-ng >=7.5.0', 'matplotlib-base', 'numpy', 'python >=3.6,<3.7.0a0', 'python_abi 3.6.* *_cp36m', 'pyyaml', 'scipy'], 'license': 'MIT', 'license_family': 'MIT', 'md5': 'bc13aa58e2092bcb0b97c561373d3905', 'name': '21cmfast', 'sha256': '97ec377d2ad83dfef1194b7aa31b0c9076194e10d995a6e696c9d07dd782b14a', 'size': 411271, 'subdir': 'linux-64', 'timestamp': 1599730372477, 'version': '3.0.2' },
          '21cmfast-3.0.2-py37h48b2cff_0.tar.bz2': { 'build': 'py37h48b2cff_0', 'build_number': 0, 'depends': ['_openmp_mutex >=4.5', 'astropy >=2.0', 'cached-property', 'cffi >=1.0', 'click', 'fftw >=3.3.8,<4.0a0', 'gsl >=2.6,<2.7.0a0', 'h5py >=2.8.0', 'libblas >=3.8.0,<4.0a0', 'libgcc-ng >=7.5.0', 'matplotlib-base', 'numpy', 'python >=3.7,<3.8.0a0', 'python_abi 3.7.* *_cp37m', 'pyyaml', 'scipy'], 'license': 'MIT', 'license_family': 'MIT', 'md5': '8aa1a00af8a99aab03dae85fde9c169a', 'name': '21cmfast', 'sha256': '3a8d86f7ca55c8b966a0861970f6160ddd7f2f3853ad8fc4b47f336eb462054b', 'size': 388716, 'subdir': 'linux-64', 'timestamp': 1599730329470, 'version': '3.0.2' },
          '21cmfast-3.0.2-py37hd45b216_1.tar.bz2': { 'build': 'py37hd45b216_1', 'build_number': 1, 'depends': ['_openmp_mutex >=4.5', 'astropy >=2.0', 'cached-property', 'cffi >=1.0', 'click', 'fftw >=3.3.8,<4.0a0', 'gsl >=2.6,<2.7.0a0', 'h5py >=2.8.0', 'libblas >=3.8.0,<4.0a0', 'libgcc-ng >=7.5.0', 'matplotlib-base', 'numpy', 'python >=3.7,<3.8.0a0', 'python_abi 3.7.* *_cp37m', 'pyyaml', 'scipy'], 'license': 'MIT', 'license_family': 'MIT', 'md5': '41bde8a484725898b237ea2fbd037146', 'name': '21cmfast', 'sha256': 'b80028d25090843243d3a6c30bd195793545d593b7efc08f67b5f486babba396', 'size': 391019, 'subdir': 'linux-64', 'timestamp': 1605110669311, 'version': '3.0.2' }
        },
        'packages.conda': {}
      }
    )

    fetch._downloadPackage = sinon.stub().callsFake((downloadUrl, destination) => {
      expect(downloadUrl).to.contains('https://conda.anaconda.org/conda-forge/')
      expect(downloadUrl).to.contains('21cmfast-3.0.2-py37hd45b216_1.tar.bz2')
      return downloadPackageStub('test/fixtures/conda/21cmfast-3.0.2-py37hd45b216_1.tar.bz2', destination)
    })
  })

  function verifyFetch(result) {
    expect(result.url).to.be.contains('cd:/conda/conda-forge/-/21cmfast/3.0.2')
    expect(result.document.hashes).to.be.deep.equal({
      sha1: '9b2f4958826956be03cf3793dbdb663a53a8a1f1',
      sha256: '1154fceeb5c4ee9bb97d245713ac21eb1910237c724d2b7103747215663273c2'
    })
    expect(result.document.location).to.be.a.string
    expect(result.document.releaseDate).to.contain('Wed, 11 Nov 2020 16:04:29 GM')
    expect(result.document.declaredLicenses).to.equal('MIT')
  }

  it('fetch sourcepackage without version and architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/'))
    verifyFetch(result.fetchResult)
  })

  it('fetch sourcepackage with version and architecture sentinel', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/-_-'))
    verifyFetch(result.fetchResult)
  })

  it('fetch sourcepackage with version and without architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/3.0.2'))
    verifyFetch(result.fetchResult)
  })

  it('fetch sourcepackage with version and null architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/3.0.2_'))
    verifyFetch(result.fetchResult)
  })

  it('fetch sourcepackage with version and architecture sentinel', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/3.0.2_-'))
    verifyFetch(result.fetchResult)
  })

  it('fetch sourcepackage with version and architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/3.0.2_linux-64'))
    verifyFetch(result.fetchResult)
  })

  it('fetch sourcepackage with version, architecture, and build version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/3.0.2_linux-64/py37hd45b216_1'))
    verifyFetch(result.fetchResult)
  })

})

const downloadPackageStub = async (file, destination) => {
  await promisify(fs.copyFile)(file, destination)
}