/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

class Budgets {
  /**
 * @param {LH.Budgets.ResourceBudget} resourceBudget
 * @return {LH.Budgets.ResourceBudget}
 */
  static validateResourceBudget(resourceBudget) {
    const validResourceTypes = [
      'total',
      'document',
      'script',
      'stylesheet',
      'image',
      'media',
      'font',
      'other',
      'thirdParty',
    ];
    if (!validResourceTypes.includes(resourceBudget.resourceType)) {
      throw new Error(`Invalid resource type: ${resourceBudget.resourceType}. \n` +
        `Valid resource types are: ${ validResourceTypes.join(', ') }`);
    }
    if (isNaN(resourceBudget.budget)) {
      throw new Error('Invalid budget: ${resourceBudget.budget}');
    }
    return resourceBudget;
  }

  /**
 * @param {LH.Budgets.TimingBudget} timingBudget
 * @return {LH.Budgets.TimingBudget}
 */
  static validateTimingBudget(timingBudget) {
    const validTimingMetrics = [
      'firstContentfulPaint',
      'firstCpuIdle',
      'timeToInteractive',
      'firstMeaningfulPaint',
      'estimaatedInputLatency',
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
    return timingBudget;
  }

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
      const validBudgetProperties = ['resourceSizes', 'resourceCounts', 'timings'];
      for (const prop in b) {
        if (!validBudgetProperties.includes(prop)) {
          throw new Error(`Unsupported budget property: ${prop}. \n` +
            `Valid properties are: ${validBudgetProperties.join(', ')}`);
        }
      }
      if (b.resourceSizes !== undefined) {
        budget.resourceSizes = b.resourceSizes.map((r) => {
          return Budgets.validateResourceBudget({
            resourceType: r.resourceType,
            budget: r.budget,
          });
        });
      }

      if (b.resourceCounts !== undefined) {
        budget.resourceCounts = b.resourceCounts.map((r) => {
          return Budgets.validateResourceBudget({
            resourceType: r.resourceType,
            budget: r.budget,
          });
        });
      }

      if (b.timings !== undefined) {
        budget.timings = b.timings.map((t) => {
          if (t.tolerance !== undefined) {
            return Budgets.validateTimingBudget({
              metric: t.metric,
              budget: t.budget,
              tolerance: t.tolerance,
            });
          } else {
            return Budgets.validateTimingBudget({
              metric: t.metric,
              budget: t.budget,
            });
          }
        });
      }
      this.budgets.push(budget);
    });
  }
}

module.exports = Budgets;
