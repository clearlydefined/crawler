

const run = require('ghcrawler').run;
const config = require('painless-config');
const defaults = require(config.get('CRAWLER_OPTIONS') || './cdConfig');
const searchPath = [require('./providers')];
run(defaults, searchPath);
