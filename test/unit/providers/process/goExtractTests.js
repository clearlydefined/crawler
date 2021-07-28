const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const GoExtract = require('../../../../providers/process/goExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')

async function setup() {
  const processor = GoExtract({ logger: {} }, () => { })
}