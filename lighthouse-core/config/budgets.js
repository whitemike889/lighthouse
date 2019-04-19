/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

class Budgets {
/**
 * Asserts that obj has no own properties, throwing a nice error message if it does.
 * Plugin and object name are included for nicer logging.
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
 * @param {LH.Budgets.ResourceBudget} resourceBudget
 * @return {LH.Budgets.ResourceBudget}
 */
  static validateResourceBudget(resourceBudget) {
    const {resourceType, budget, ...invalidRest} = resourceBudget;
    Budgets.assertNoExcessProperties(invalidRest, 'Resource Budget');

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
    if (!validResourceTypes.includes(resourceBudget.resourceType)) {
      throw new Error(`Invalid resource type: ${resourceBudget.resourceType}. \n` +
        `Valid resource types are: ${ validResourceTypes.join(', ') }`);
    }
    if (isNaN(resourceBudget.budget)) {
      throw new Error('Invalid budget: ${resourceBudget.budget}');
    }
    return {
      resourceType,
      budget,
    };
  }

  /**
 * @param {LH.Budgets.TimingBudget} timingBudget
 * @return {LH.Budgets.TimingBudget}
 */
  static validateTimingBudget(timingBudget) {
    const {metric, budget, tolerance, ...invalidRest} = timingBudget;
    Budgets.assertNoExcessProperties(invalidRest, 'Timing Budget');

    const validTimingMetrics = [
      'first-contentful-paint',
      'first-cpu-idle',
      'time-to-interactive',
      'first-meaningful-paint',
      'estimated-input-latency',
    ];
    if (!validTimingMetrics.includes(timingBudget.metric)) {
      throw new Error(`Invalid timing metric: ${timingBudget.metric}. \n` +
        `Valid timing metrics are: ${validTimingMetrics.join(', ')}`);
    }
    if (isNaN(timingBudget.budget)) {
      throw new Error('Invalid budget: ${timingBudget.budget}');
    }
    if (timingBudget.tolerance !== undefined && isNaN(timingBudget.tolerance)) {
      throw new Error('Invalid tolerance: ${timingBudget.tolerance}');
    }
    return {
      metric,
      budget,
      tolerance,
    };
  }

  // More info on the Budgets format:
  // https://github.com/GoogleChrome/lighthouse/issues/6053#issuecomment-428385930
  /**
     * @constructor
     * @implements {LH.Budgets.Json}
     * @param {LH.Budgets.Json} budgetsJSON
     */
  constructor(budgetsJSON) {
    /** @type {Array<LH.Budgets.Budget>} */
    this.budgets = [];

    budgetsJSON.budgets.forEach((b) => {
      /** @type {LH.Budgets.Budget} */
      const budget = {};

      const {resourceSizes, resourceCounts, timings, ...invalidRest} = b;
      Budgets.assertNoExcessProperties(invalidRest, 'Budget');

      if (b.resourceSizes !== undefined) {
        budget.resourceSizes = b.resourceSizes.map((r) => {
          return Budgets.validateResourceBudget(r);
        });
      }

      if (b.resourceCounts !== undefined) {
        budget.resourceCounts = b.resourceCounts.map((r) => {
          return Budgets.validateResourceBudget(r);
        });
      }

      if (b.timings !== undefined) {
        budget.timings = b.timings.map((t) => {
          return Budgets.validateTimingBudget(t);
        });
      }
      this.budgets.push({
        resourceSizes,
        resourceCounts,
        timings,
      });
    });
  }
}

module.exports = Budgets;
