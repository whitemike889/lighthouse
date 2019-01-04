/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const defaultLightWalletBudget = require('./default-light-wallet-budget.js');

class LightWalletBudget {
  /**
     * @constructor
     * @implements {LH.LightWallet.Json}
     */
  constructor() {
    /** @type {LH.LightWallet.Json} */
    let budgetsJSON;

    if (fs.existsSync('./budgets.json')) {
      try {
        budgetsJSON = JSON.parse(fs.readFileSync('./budgets.json', {encoding: 'utf8'}));
      } catch (err) {
        throw new Error(`Invalid budgets.json. ${err}`);
      }
    } else {
      budgetsJSON = JSON.parse(JSON.stringify(defaultLightWalletBudget));
    }

    /** @type {Array<LH.LightWallet.Budget>} */
    this.budgets = [];

    if (budgetsJSON.budgets === undefined) {
      throw new Error('Invalid budgets.json');
    }

    budgetsJSON.budgets.forEach((b) => {
      const cpuThrottling = b.cpuThrottling;

      if (typeof cpuThrottling !== 'number' || cpuThrottling < 1 || cpuThrottling > 4) {
        throw new Error('A valid CPU Throttling must be specified.');
      }

      const connectionTypes = [
        'slow3G',
        'regular3G',
        'fast3G',
        'slow4G',
        'regular4G',
        'wifi',
      ];

      if (b.connectionType === undefined) {
        throw new Error('A connection type must be specified.');
      } else if (connectionTypes.indexOf(b.connectionType) === -1) {
        throw new Error(`Invalid connection type: ${b.connectionType}`);
      }

      /** @type {LH.LightWallet.Budget} */
      const budget = {
        cpuThrottling: cpuThrottling,
        connectionType: b.connectionType,
      };

      const resourceTypes = [
        'total',
        'document',
        'script',
        'stylesheet',
        'image',
        'media',
        'font',
        'other',
        'thirdParty'
      ];

      if (b.pageWeight !== undefined) {
        /** @type {Array<LH.LightWallet.ResourceBudget>} */
        budget.pageWeight = b.pageWeight.map((r) => {
          if (resourceTypes.indexOf(r.resourceType) === -1) {
            throw new Error(`Invalid resource type: ${r.resourceType}`);
          }
          return {
            resourceType: r.resourceType,
            budget: r.budget,
          };
        });
      }

      if (b.requests !== undefined) {
        /** @type {Array<LH.LightWallet.ResourceBudget>} */
        budget.requests = b.requests.map((r) => {
          if (resourceTypes.indexOf(r.resourceType) === -1) {
            throw new Error(`Invalid resource type: ${r.resourceType}`);
          }
          return {
            resourceType: r.resourceType,
            budget: r.budget,
          };
        });
      }

      const metrics = [
        'firstContentfulPaint',
        'firstCpuIdle',
        'timeToInteractive',
        'firstMeaningfulPaint',
      ];

      if (b.timings !== undefined) {
        /** @type {Array<LH.LightWallet.TimingBudget>} */
        budget.timings = b.timings.map((t) => {
          if (metrics.indexOf(t.metric) === -1) {
            throw new Error(`Invalid timing metric: ${t.metric}`);
          }

          if (t.budget === undefined) {
            throw new Error(`Missing budget for: ${t.metric}`);
          }

          if (t.tolerance !== undefined) {
            return {
              metric: t.metric,
              budget: t.budget,
              tolerance: t.tolerance,
            };
          } else {
            return {
              metric: t.metric,
              budget: t.budget,
            };
          }
        });
      }
      this.budgets.push(budget);
    });
  }
}

module.exports = LightWalletBudget;
