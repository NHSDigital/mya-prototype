/**
 * @param {Environment} env
 */

const registerDateTimeFilters = require("./filters/datetime")
const util = require("util")


module.exports = function (env) {
  const filters = {}
  registerDateTimeFilters(filters);

  // Pretty print an object for debugging
  filters.prettyDump = (obj) => {
    return "<pre>" + util.inspect(obj, { depth: null, colors: false }) + "</pre>";
  }

  // Format an NHS number as 123 456 7890
  filters.nhsNumber = (digits) => {
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6);

    // Use non-breaking spaces (&nbsp;) to stop wrapping
    return `${part1}&nbsp;${part2}&nbsp;${part3}`;
  }


  return filters
}

/**
 * @import { Environment } from 'nunjucks'
 */
