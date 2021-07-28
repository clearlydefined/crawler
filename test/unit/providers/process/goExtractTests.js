const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const CrateExtract = require('../../../../providers/process/crateExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')

async function setup() {
  const processor = CrateExtract({ logger: {} }, () => { })
}