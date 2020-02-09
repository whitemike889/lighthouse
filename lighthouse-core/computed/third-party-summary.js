/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const makeComputedArtifact = require('./computed-artifact.js');
const NetworkRecords = require('./network-records.js');
const URL = require('../lib/url-shim.js');
const MainResource = require('./main-resource.js');
const Budget = require('../config/budget.js');
const Util = require('../report/html/renderer/util.js');

/** @typedef {{count: number, size: number}} ResourceEntry */
class ThirdPartySummary {
  /**
   * @param {LH.Artifacts.NetworkRequest} mainResource
   * @param {Array<LH.Artifacts.NetworkRequest>} networkRecords
   * @param {LH.Audit.Context} context
   * @return {Promise<{count: number, size: number}>}
   */
  static async summarize(mainResource, networkRecords, context) {
    const budget = Budget.getMatchingBudget(context.settings.budgets, mainResource.url);

    let firstPartyHosts = /** @type {Array<string>} */ ([]);
    if (budget && budget.options && budget.options.firstPartyHostnames) {
      firstPartyHosts = budget.options.firstPartyHostnames;
    } else {
      const rootDomain = Util.getRootDomain(mainResource.url);
      firstPartyHosts = [`*.${rootDomain}`];
    }

    let count = 0;
    let size = 0;
    networkRecords.forEach((record) => {
      const hostname = new URL(record.url).hostname;
      // Ignore data URLs
      if (hostname === '') {
        return false;
      }
      const isFirstParty = firstPartyHosts.find((hostExp) => {
        if (hostExp.startsWith('*.')) {
          return hostname.endsWith(hostExp.slice(2));
        }
        return hostname === hostExp;
      });
      if (!isFirstParty) {
        count += 1;
        size += record.transferSize;
      }
    });
    return {size, count};
  }

  /**
   * @param {{URL: LH.Artifacts['URL'], devtoolsLog: LH.DevtoolsLog}} data
   * @param {LH.Audit.Context} context
   * @return {Promise<{count: number, size: number}>}
   */
  static async compute_(data, context) {
    const [networkRecords, mainResource] = await Promise.all([
      NetworkRecords.request(data.devtoolsLog, context),
      MainResource.request(data, context),
    ]);
    return ThirdPartySummary.summarize(mainResource, networkRecords, context);
  }
}

module.exports = makeComputedArtifact(ThirdPartySummary);
