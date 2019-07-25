/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const URL = require('../lib/url-shim.js');

/**
 * @param {unknown} arr
 * @return {arr is Array<Record<string, unknown>>}
 */
function isArrayOfUnknownObjects(arr) {
  return Array.isArray(arr) && arr.every(isObjectOfUnknownProperties);
}

/**
 * @param {unknown} val
 * @return {val is Record<string, unknown>}
 */
function isObjectOfUnknownProperties(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Returns whether `val` is numeric. Will not coerce to a number. `NaN` will
 * return false, however ±Infinity will return true.
 * @param {unknown} val
 * @return {val is number}
 */
function isNumber(val) {
  return typeof val === 'number' && !isNaN(val);
}

class Budget {
  /**
   * Asserts that obj has no own properties, throwing a nice error message if it does.
   * `objectName` is included for nicer logging.
   * @param {Record<string, unknown>} obj
   * @param {string} objectName
   */
  static assertNoExcessProperties(obj, objectName) {
    const invalidKeys = Object.keys(obj);
    if (invalidKeys.length > 0) {
      const keys = invalidKeys.join(', ');
      throw new Error(`${objectName} has unrecognized properties: [${keys}]`);
    }
  }

  /**
   * Asserts that `strings` has no duplicate strings in it, throwing an error if
   * it does. `arrayName` is included for nicer logging.
   * @param {Array<string>} strings
   * @param {string} arrayName
   */
  static assertNoDuplicateStrings(strings, arrayName) {
    const foundStrings = new Set();
    for (const string of strings) {
      if (foundStrings.has(string)) {
        throw new Error(`${arrayName} has duplicate entry of type '${string}'`);
      }
      foundStrings.add(string);
    }
  }

  /**
   * @param {Record<string, unknown>} resourceBudget
   * @return {LH.Budget.ResourceBudget}
   */
  static validateResourceBudget(resourceBudget) {
    const {resourceType, budget, ...invalidRest} = resourceBudget;
    Budget.assertNoExcessProperties(invalidRest, 'Resource Budget');

    /** @type {Array<LH.Budget.ResourceType>} */
    const validResourceTypes = [
      'total',
      'document',
      'script',
      'stylesheet',
      'image',
      'media',
      'font',
      'other',
      'third-party',
    ];
    // Assume resourceType is an allowed string, throw if not.
    if (!validResourceTypes.includes(/** @type {LH.Budget.ResourceType} */ (resourceType))) {
      throw new Error(`Invalid resource type: ${resourceType}. \n` +
        `Valid resource types are: ${ validResourceTypes.join(', ') }`);
    }
    if (!isNumber(budget)) {
      throw new Error(`Invalid budget: ${budget}`);
    }
    return {
      resourceType: /** @type {LH.Budget.ResourceType} */ (resourceType),
      budget,
    };
  }

  /**
   * Validates that path is properly formed. Verifies the quantity and location
   * of the two robot.txt regex characters: $, *
   * @param {unknown} val
   * @return {string}
   */
  static validatePath(val) {
    /*
     * If no path is specified the budget is assumed to apply to all pages. This makes
     * budget.json backwards compatible with earlier API versions that did not include path.
     */

    if ((val === undefined) || (val === null)) {
      return '/';
    }
    const path = /** @type {string} */ (val);
    const hasLeadingSlash = path.startsWith('/');
    const validWildcardQuantity = ((path.match(/\*/g) || []).length <= 1);
    const validDollarSignQuantity = ((path.match(/\$/g) || []).length <= 1);
    const validDollarSignPlacement = !path.includes('$') || path.endsWith('$');

    const isValid = hasLeadingSlash && validWildcardQuantity
      && validDollarSignQuantity && validDollarSignPlacement;

    if (!isValid) {
      throw new Error(`Invalid path ${path}. ` +
        `'Path' should be specified using the 'robots.txt' format.\n` +
        `Learn more about the 'robots.txt' format here:\n` +
        `https://developers.google.com/search/reference/robots_txt#url-matching-based-on-path-values`);
    }
    return path;
  }

  /**
   * Determines whether a URL matches against a robots.txt-style "path".
   * @param {string} url
   * @param {string} pattern
   * @return {boolean}
   */
  static urlMatchesPattern(url, pattern) {
    /*
     * Pattern should use the robots.txt format. E.g. "/*-article.html" or "/". Reference:
     * https://developers.google.com/search/reference/robots_txt#url-matching-based-on-path-values
     */

    const urlObj = new URL(url);
    const urlPath = urlObj.pathname + urlObj.search;

    const hasWildcard = pattern.includes('*');
    const hasDollarSign = pattern.includes('$');

    /**
     * There are 4 different cases of path strings.
     * Paths should have already been validated with #validatePath.
     *
     * Case #1: No special characters
     * Example: "/cat"
     * Behavior: URL should start with given pattern.
     */
    if (!hasWildcard && !hasDollarSign) {
      return urlPath.startsWith(pattern);
    /**
     * Case #2: $ only
     * Example: "/js$"
     * Behavior: URL should be identical to pattern.
     */
    } else if (!hasWildcard && hasDollarSign) {
      return urlPath === pattern.slice(0, -1);
    /**
     * Case #3: * only
     * Example: "/vendor*chunk"
     * Behavior: URL should start with the string pattern that comes before the wildcard
     * & later in the string contain the string pattern that comes after the wildcard.
     */
    } else if (hasWildcard && !hasDollarSign) {
      const [beforeWildcard, afterWildcard] = pattern.split('*');
      const remainingUrl = urlPath.slice(beforeWildcard.length);
      return urlPath.startsWith(beforeWildcard) && remainingUrl.includes(afterWildcard);
      /**
       * Case #4: $ and *
       * Example: "/vendor*chunk.js$"
       * Behavior: URL should start with the string pattern that comes before the wildcard
       * & end with the string pattern that comes after the wildcard.
       */
    } else if (hasWildcard && hasDollarSign) {
      const [beforeWildcard, afterWildcard] = pattern.split('*');
      return urlPath.startsWith(beforeWildcard) && urlPath.endsWith(afterWildcard.slice(0, -1));
    }
    return false;
  }

  /**
   * @param {Record<string, unknown>} timingBudget
   * @return {LH.Budget.TimingBudget}
   */
  static validateTimingBudget(timingBudget) {
    const {metric, budget, tolerance, ...invalidRest} = timingBudget;
    Budget.assertNoExcessProperties(invalidRest, 'Timing Budget');

    /** @type {Array<LH.Budget.TimingMetric>} */
    const validTimingMetrics = [
      'first-contentful-paint',
      'first-cpu-idle',
      'interactive',
      'first-meaningful-paint',
      'max-potential-fid',
    ];
    // Assume metric is an allowed string, throw if not.
    if (!validTimingMetrics.includes(/** @type {LH.Budget.TimingMetric} */ (metric))) {
      throw new Error(`Invalid timing metric: ${metric}. \n` +
        `Valid timing metrics are: ${validTimingMetrics.join(', ')}`);
    }
    if (!isNumber(budget)) {
      throw new Error(`Invalid budget: ${budget}`);
    }
    if (typeof tolerance !== 'undefined' && !isNumber(tolerance)) {
      throw new Error(`Invalid tolerance: ${tolerance}`);
    }
    return {
      metric: /** @type {LH.Budget.TimingMetric} */ (metric),
      budget,
      tolerance,
    };
  }

  /**
   * More info on the Budget format:
   * https://github.com/GoogleChrome/lighthouse/issues/6053#issuecomment-428385930
   * @param {unknown} budgetJson
   * @return {Array<LH.Budget>}
   */
  static initializeBudget(budgetJson) {
    // Clone to prevent modifications of original and to deactivate any live properties.
    budgetJson = JSON.parse(JSON.stringify(budgetJson));
    if (!isArrayOfUnknownObjects(budgetJson)) {
      throw new Error('Budget file is not defined as an array of budgets.');
    }

    const budgets = budgetJson.map((b, index) => {
      /** @type {LH.Budget} */
      const budget = {};

      const {path, resourceSizes, resourceCounts, timings, ...invalidRest} = b;
      Budget.assertNoExcessProperties(invalidRest, 'Budget');

      budget.path = Budget.validatePath(path);

      if (isArrayOfUnknownObjects(resourceSizes)) {
        budget.resourceSizes = resourceSizes.map(Budget.validateResourceBudget);
        Budget.assertNoDuplicateStrings(budget.resourceSizes.map(r => r.resourceType),
          `budgets[${index}].resourceSizes`);
      } else if (resourceSizes !== undefined) {
        throw new Error(`Invalid resourceSizes entry in budget at index ${index}`);
      }

      if (isArrayOfUnknownObjects(resourceCounts)) {
        budget.resourceCounts = resourceCounts.map(Budget.validateResourceBudget);
        Budget.assertNoDuplicateStrings(budget.resourceCounts.map(r => r.resourceType),
          `budgets[${index}].resourceCounts`);
      } else if (resourceCounts !== undefined) {
        throw new Error(`Invalid resourceCounts entry in budget at index ${index}`);
      }

      if (isArrayOfUnknownObjects(timings)) {
        budget.timings = timings.map(Budget.validateTimingBudget);
        Budget.assertNoDuplicateStrings(budget.timings.map(r => r.metric),
          `budgets[${index}].timings`);
      } else if (timings !== undefined) {
        throw new Error(`Invalid timings entry in budget at index ${index}`);
      }

      return budget;
    });

    return budgets;
  }
}

module.exports = Budget;
