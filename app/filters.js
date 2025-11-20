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

  filters.padZero = (num, size = 2) => {
    let s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
  }

  filters.formatNumber = ((value, locale = 'en-GB', options = {}) => {
    if (typeof value !== 'number') value = Number(value);
    return new Intl.NumberFormat(locale, options).format(value);
  })

  filters.splitString = (str, separator = ',', index = null) => {
    const parts = String(str).split(separator).map(s => s.trim());
    if (index !== null) {
      return parts[index] || '';
    }
    return parts;
  }

  filters.splitCamelCase = (str) => {
    return String(str).replace(/([a-z])([A-Z])/g, '$1 $2');
  }


  return filters
}

/**
 * @import { Environment } from 'nunjucks'
 */
