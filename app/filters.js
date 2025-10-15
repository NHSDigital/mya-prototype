/**
 * @param {Environment} env
 */

const registerDateTimeFilters = require("./filters/datetime")
const util = require("util")

module.exports = function (env) {
  const filters = {}
  registerDateTimeFilters(filters);

  filters.prettyDump = (obj) => {
    return "<pre>" + util.inspect(obj, { depth: null, colors: false }) + "</pre>";
  }
  return filters
}

/**
 * @import { Environment } from 'nunjucks'
 */
