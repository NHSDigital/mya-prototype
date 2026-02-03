/**
 * @param {Environment} env
 */

const { DateTime } = require("luxon");

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

  filters.randomNumber = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  filters.featureType = (value) => {
    if (value === null || value === undefined) return "empty";

    if (Array.isArray(value)) return "json";

    const t = typeof value;

    if (t === "boolean") return "boolean";
    if (t === "number") return Number.isInteger(value) ? "int" : "number";
    if (t === "object") return "json";

    if (t === "string") {
      // ISO date heuristic: yyyy-mm-dd
      const dt = DateTime.fromISO(value, { zone: "utc" });
      if (dt.isValid && value.length === 10) return "date";
      return "string";
    }

    return "string";
  }


  return filters
}

/**
 * @import { Environment } from 'nunjucks'
 */
