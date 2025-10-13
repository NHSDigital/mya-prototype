/**
 * @param {Environment} env
 */

const registerDateTimeFilters = require("./filters/datetime")

module.exports = function (env) {
  const filters = {}
  registerDateTimeFilters(filters);
  return filters
}

/**
 * @import { Environment } from 'nunjucks'
 */
