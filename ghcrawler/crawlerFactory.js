// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const Crawler = require('./lib/crawler')
const CrawlerService = require('./lib/crawlerService')
const QueueSet = require('./providers/queuing/queueSet')
const ScopedQueueSets = require('./providers/queuing/scopedQueueSets')
const RefreshingConfig = require('@microsoft/refreshing-config')

let logger = null
let providerSearchPath = null
let finalOptions = null

class CrawlerFactory {
  static createService(defaults, appLogger, searchPath = []) {
    logger = appLogger
    logger.info('appInitStart')
    providerSearchPath = [require('./providers')]
    // initialize the redis provider (if any) ASAP since it is used all over and we want to share the client
    CrawlerFactory._initializeRedis(defaults)

    const optionsProvider = defaults.provider || 'memory'
    const crawlerName = (defaults.crawler && defaults.crawler.name) || 'crawler'
    searchPath.forEach(entry => providerSearchPath.push(entry))
    const subsystemNames = ['crawler', 'filter', 'fetch', 'process', 'queue', 'store', 'deadletter', 'lock']
    const crawlerPromise = CrawlerFactory.createRefreshingOptions(
      crawlerName,
      subsystemNames,
      defaults,
      optionsProvider
    ).then(options => {
      logger.info('created all refreshingOptions')
      finalOptions = options
      const crawler = CrawlerFactory.createCrawler(options)
      return [crawler, options]
    })
    return new CrawlerService(crawlerPromise)
  }

  static _initializeRedis(defaults) {
    if (defaults.redis && defaults.redis.provider)
      CrawlerFactory._getProvider(defaults.redis || {}, defaults.redis.provider, 'redis')
  }

  static _decorateOptions(key, options) {
    if (!options.logger) options.logger = logger
  }

  static createCrawler(
    options,
    {
      queues = null,
      store = null,
      deadletters = null,
      locker = null,
      filter = null,
      fetchers = null,
      processors = null
    } = {}
  ) {
    logger.info('creating crawler')
    queues = queues || CrawlerFactory.createScopedQueueSets(options.queue)
    store = store || CrawlerFactory.createStore(options.store)
    deadletters = deadletters || CrawlerFactory.createDeadLetterStore(options.deadletter)
    locker = locker || CrawlerFactory.createLocker(options.lock)
    processors = processors || CrawlerFactory.createProcessors(options.process)
    filter = filter || CrawlerFactory.createFilter(options.filter, processors)
    fetchers = fetchers || CrawlerFactory.createFetchers(options.fetch, store, processors, filter)
    // The crawler is not "provided" so ensure the options are decorated as necessary (e.g., logger)
    CrawlerFactory._decorateOptions('crawler', options.crawler)
    const result = new Crawler(queues, store, deadletters, locker, fetchers, processors, options.crawler)
    result.initialize = CrawlerFactory._initialize.bind(result)
    return result
  }

  static async _initialize() {
    await this.queues.subscribe()
    await this.store.connect()
    await this.deadletters.connect()
  }

  static async createRefreshingOptions(crawlerName, subsystemNames, defaults, refreshingProvider = 'memory') {
    logger.info(`creating refreshing options with crawlerName:${crawlerName}`)
    const result = {}
    refreshingProvider = refreshingProvider.toLowerCase()
    await Promise.all(
      subsystemNames.map(subsystemName => {
        // Any given subsytem may have a provider or may be a list of providers. If a particular provider is
        // identified then hook up just that set of options for refreshing.
        logger.info(`creating refreshing options ${subsystemName} with provider ${refreshingProvider}`)
        let config = null
        const subDefaults = defaults[subsystemName] || {}
        const subProvider = subDefaults && subDefaults.provider
        // const uniqueName = `${subsystemName}${subProvider ? '-' + subProvider : ''}`
        if (refreshingProvider === 'memory') {
          config = CrawlerFactory.createInMemoryRefreshingConfig()
        } else {
          throw new Error(`Invalid refreshing provider setting ${refreshingProvider}`)
        }
        return config.getAll().then(values => {
          logger.info(`got refreshingOption values for ${subsystemName}`)
          // grab the right defaults. May need to drill down a level if the subsystem has a provider
          const trueDefaults = subProvider ? subDefaults[subProvider] || {} : subDefaults
          return CrawlerFactory.initializeSubsystemOptions(values, trueDefaults).then(() => {
            logger.info(`${subsystemName} options initialized`)
            // Hook the refreshing options into the right place in the result structure.
            // Be sure to retain the 'provider' setting
            if (subProvider) result[subsystemName] = { provider: subProvider, [subProvider]: values }
            else result[subsystemName] = values
          })
        })
      })
    )
    return result
  }

  static async initializeSubsystemOptions(config, defaults) {
    if (Object.getOwnPropertyNames(config).length > 1) {
      return config
    }
    await Promise.all(
      Object.getOwnPropertyNames(defaults).map(optionName => {
        return config._config.set(optionName, defaults[optionName])
      })
    )
    return config._config.getAll()
  }

  static createInMemoryRefreshingConfig(values = {}) {
    logger.info('creating in memory refreshing config')
    const configStore = new RefreshingConfig.InMemoryConfigStore(values)
    const config = new RefreshingConfig.RefreshingConfig(configStore).withExtension(
      new RefreshingConfig.InMemoryPubSubRefreshPolicyAndChangePublisher()
    )
    return config
  }

  static getProvider(namespace, ...params) {
    const provider = finalOptions[namespace]
    if (!provider) return null
    for (let i = 0; i < providerSearchPath.length; i++) {
      const entry = providerSearchPath[i]
      const result = entry[namespace] && entry[namespace][provider]
      if (result) return result(...params)
    }
    return require(provider)(...params)
  }

  static _getProvider(options, provider, namespace, ...params) {
    const subOptions = options[provider] || {}
    CrawlerFactory._decorateOptions(namespace, subOptions)
    subOptions.logger.info(`creating ${namespace}:${provider}`)
    for (let i = 0; i < providerSearchPath.length; i++) {
      const entry = providerSearchPath[i]
      const result = entry[namespace] && entry[namespace][provider]
      if (result) return result(subOptions, ...params)
    }
    return require(provider)(subOptions, ...params)
  }

  static _getAllProviders(options, namespace, ...params) {
    return CrawlerFactory._getNamedProviders(options, namespace, Object.getOwnPropertyNames(options), ...params)
  }

  static _getNamedProviders(options, namespace, names, ...params) {
    return names
      .filter(key => !['_config', 'logger', 'dispatcher', options.dispatcher].includes(key))
      .map(name => CrawlerFactory._getProvider(options, name, namespace, ...params))
  }

  static createFilter(options, processors) {
    return CrawlerFactory._getProvider(options, options.provider, 'filter', processors)
  }

  static createStore(options, provider = options.provider) {
    if (provider) return CrawlerFactory._getProvider(options, provider, 'store')
    const names = options.dispatcher.split('+')
    const stores = CrawlerFactory._getNamedProviders(options, 'store', names.slice(1))
    const dispatcher = names[0]
    return dispatcher ? CrawlerFactory._getProvider(options, dispatcher, 'store', stores) : stores
  }

  static createDeadLetterStore(options, provider = options.provider) {
    return CrawlerFactory._getProvider(options, provider, 'store')
  }

  static createFetchers(options, store, processors, filter) {
    const fetchers = CrawlerFactory._getAllProviders(options, 'fetch', store, processors, filter)
    return options.dispatcher
      ? [CrawlerFactory._getProvider(options, options.dispatcher, 'fetch', store, fetchers, processors, filter)]
      : fetchers
  }

  static createProcessors(options) {
    const processors = CrawlerFactory._getAllProviders(options, 'process')
    return options.dispatcher
      ? [CrawlerFactory._getProvider(options, options.dispatcher, 'process', processors)]
      : processors
  }

  static createLocker(options, provider = options.provider || 'memory') {
    return CrawlerFactory._getProvider(options, provider, 'lock')
  }

  static createNolock() {
    return { lock: () => null, unlock: () => { } }
  }

  static createQueues(options, provider = options.provider) {
    return CrawlerFactory._getProvider(options, provider, 'queue')
  }

  static createQueueSet(manager, options) {
    const immediate = manager.createQueueChain('immediate', options)
    const soon = manager.createQueueChain('soon', options)
    const normal = manager.createQueueChain('normal', options)
    const later = manager.createQueueChain('later', options)
    return new QueueSet([immediate, soon, normal, later], options)
  }

  static createScopedQueueSets(queueOptions) {
    const globalQueues = CrawlerFactory.createQueues(queueOptions)
    const memoryOpts = { provider: 'memory', memory: queueOptions[queueOptions.provider] }
    const localQueues = CrawlerFactory.createQueues(memoryOpts)
    return new ScopedQueueSets(globalQueues, localQueues)
  }
}

module.exports = CrawlerFactory
