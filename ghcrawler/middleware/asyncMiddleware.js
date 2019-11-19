// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

module.exports = func => async (request, response, next) => {
  try {
    await func(request, response, next)
  } catch (error) {
    next(error)
  }
}
