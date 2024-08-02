// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const express = require('express')
const router = express.Router()

router.get('/', function (req, res) {
  const msg = `{ "status": "OK", "version": "${version}", "sha": "${sha}"`
  res.status(200).send(msg)
})

module.exports = router

let version
let sha
function setup(buildsha, appVersion) {
  version = appVersion
  sha = buildsha
  return router
}
module.exports = setup
