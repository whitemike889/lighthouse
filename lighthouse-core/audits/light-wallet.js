/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit');
const throttlingSettings = require('../config/constants').lightWalletThrottling;
const NetworkRecords = require('../computed/network-records.js');
const ComputedFcp = require('../computed/metrics/first-contentful-paint.js');
const ComputedFci = require('../computed/metrics/first-cpu-idle.js');
const ComputedFmp = require('../computed/metrics/first-meaningful-paint.js');
const Interactive = require('../computed/metrics/interactive.js');
const i18n = require('../lib/i18n/i18n.js');
const MainResource = require('../computed/main-resource.js');
const URL = require('../lib/url-shim');
const LightWalletBudget = require('../config/light-wallet-budget');

const UIStrings = {
  /** LightWallet is the name of Lighthouse's performance budget feature. The name dervices from "Lighthouse" & "Wallet", because financial budgets are somewhat similar to performance budgets. */
  title: 'LightWallet',
  /** Description of the LightWallet section, which evaluates whether the resources and page load times fall within the budgets set for the page. This is displayed under the LightWallet heading. No character length limits. */
  description: 'A performance budget sets thresholds for the resource sizes' +
    ' and/or loading metrics of a page. This helps achieve and maintain performance goals.',
  /** The name of the metric that marks the time at which the first text or image is painted by the browser. Shown to users as the label for the numeric metric value. Ideally fits within a ~40 character limit. */
  firstContentfulPaint: 'First Contentful Paint',
  /** The name of the metric that marks when the page has displayed content and the CPU is not busy executing the page's scripts. Shown to users as the label for the numeric metric value. Ideally fits within a ~40 character limit. */
  firstCpuIdle: 'First CPU Idle',
  /** The name of the metric that marks the time at which the page is fully loaded and is able to quickly respond to user input (clicks, taps, and keypresses feel responsive). Shown to users as the label for the numeric metric value. Ideally fits within a ~40 character limit. */
  timeToInteractive: 'Time to Interactive',
  /** The name of the metric that marks the time at which a majority of the content has been painted by the browser. Shown to users as the label for the numeric metric value. Ideally fits within a ~40 character limit. */
  firstMeaningfulPaint: 'First Meaningful Paint',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

class LightWallet extends Audit {
  /**
     * @return {LH.Audit.Meta}
     */
  static get meta() {
    return {
      id: 'light-wallet',
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      requiredArtifacts: ['devtoolsLogs'],
    };
  }

  /**
   * @param {LH.Artifacts.NetworkRequest} record
   * @return string
   */
  static determineResourceType(record) {
    switch (record.resourceType) {
      case 'Stylesheet':
      case 'Image':
      case 'Media':
      case 'Font':
      case 'Script':
      case 'Document':
        // budgets.json uses lowercase for resource types, unlike NetworkRequest.resourceType
        return record.resourceType.toLowerCase();
      default:
        return 'other';
    }
  }

  /**
   * @param {Array<LH.LightWallet.Result>} results
   * @return string
   */
  static getScore(results) {
    let hasWarnings = false;
    for (const environment of results) {
      const sections = [environment.timings, environment.requests, environment.pageWeight];
      for (const section of sections) {
        for (const result of section || []) {
          if (result.score === 'fail') return 'fail';
          if (result.score === 'warn') hasWarnings = true;
        }
      }
    }
    return hasWarnings ? 'warn' : 'pass';
  }

  /**
     * @param {LH.LightWallet.TimingBudget} timingBudget
     * @param {LH.Config.Settings} settings
     * @param {LH.Artifacts} artifacts
     * @param {LH.Audit.Context} context
     * @return {Promise<LH.LightWallet.TimingResult>}
     */
  static async auditTimingMetric(timingBudget, settings, artifacts, context) {
    let fn;
    let id;
    let label;
    let timingMeasurement;
    let score;

    switch (timingBudget.metric) {
      case 'firstContentfulPaint':
        fn = ComputedFcp.request;
        id = 'fcp';
        label = str_(UIStrings.firstContentfulPaint);
        break;
      case 'firstCpuIdle':
        fn = ComputedFci.request;
        id = 'fci';
        label = str_(UIStrings.firstCpuIdle);
        break;
      case 'timeToInteractive':
        fn = Interactive.request;
        id = 'tti';
        label = str_(UIStrings.timeToInteractive);
        break;
      case 'firstMeaningfulPaint':
        fn = ComputedFmp.request;
        id = 'fmp';
        label = str_(UIStrings.firstMeaningfulPaint);
        break;
      default:
        throw new Error('Timing metric not found');
    }

    try {
      const trace = artifacts.traces[Audit.DEFAULT_PASS];
      const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
      const metricComputationData = {trace, devtoolsLog, settings};

      timingMeasurement = (await fn(metricComputationData, context)).timing;
    } catch (err) {
      throw new Error(err);
    }

    switch (true) {
      case (timingMeasurement < timingBudget.budget):
        score = 'pass';
        break;
      case (timingMeasurement < timingBudget.budget + (timingBudget.tolerance || 0)):
        score = 'average';
        break;
      default:
        score = 'fail';
        break;
    }

    /** @type {LH.LightWallet.TimingResult} */
    const result = {
      id: id,
      label: label,
      budget: timingBudget.budget,
      actual: timingMeasurement,
      difference: timingMeasurement - timingBudget.budget,
      score: score,
    };

    if (timingBudget.tolerance !== undefined) {
      result.tolerance = timingBudget.tolerance;
    }

    return result;
  }

  /**
   * @param {Array<LH.Artifacts.NetworkRequest>} networkRecords
   * @param {string} mainResourceURL
   * @return {Map<String, number>}
   */
  static requestCountsByResourceType(networkRecords, mainResourceURL) {
    /** @type {Map<string,number>} */
    const summary = new Map();
    networkRecords.forEach(record => {
      const type = this.determineResourceType(record);
      summary.set(type, (summary.get(type) || 0) + 1);
      summary.set('total', (summary.get('total') || 0) + 1);
      if (!URL.rootDomainsMatch(record.url, mainResourceURL)) {
        summary.set('thirdParty', (summary.get('thirdParty') || 0) + 1);
      }
    });
    return summary;
  }

  /**
 * @param {Array<LH.Artifacts.NetworkRequest>} networkRecords
 * @param {string} mainResourceURL
 * @return {Map<String, number>}
 */
  static pageWeightByResourceType(networkRecords, mainResourceURL) {
    /** @type {Map<string,number>} */
    const summary = new Map();
    networkRecords.forEach(record => {
      const type = this.determineResourceType(record);
      const size = (summary.get(type) || 0) + record.transferSize;
      summary.set(type, size);
      const total = (summary.get('total') || 0) + record.transferSize;
      summary.set('total', total);
      if (!URL.rootDomainsMatch(record.url, mainResourceURL)) {
        const thirdParty = (summary.get('thirdParty') || 0) + record.transferSize;
        summary.set('thirdParty', thirdParty);
      }
    });
    return summary;
  }

  /**
 * @param {Array<LH.LightWallet.ResourceBudget>} pageWeightBudgets
 * @param {Map<String,number>} bytesSummary
 * @return {Array<LH.LightWallet.ResourceResult>|Array}
 */
  static pageWeightAnalysis(pageWeightBudgets, bytesSummary) {
    /** @type {Array<LH.LightWallet.ResourceResult>} */
    return pageWeightBudgets.map(pageWeightBudget => {
      // TODO: Double-check x1024 vs. x1000
      const budget = (pageWeightBudget.budget || 0) * 1024;
      const actual = bytesSummary.get(pageWeightBudget.resourceType) || 0;
      return {
        id: pageWeightBudget.resourceType,
        label: pageWeightBudget.resourceType,
        budget: budget,
        actual: actual,
        difference: actual - budget,
        score: actual > budget ? 'fail' : 'pass',
      };
    }).sort(function(a, b) {
      return b.difference - a.difference;
    });
  }

  /**
   * @param {Array<LH.LightWallet.ResourceBudget>} requestBudgets
   * @param {Map<String, number>} requestCounts
   * @return {Array<LH.LightWallet.ResourceResult>|Array}
   */
  static requestAnalysis(requestBudgets, requestCounts) {
    /** @type {Array<LH.LightWallet.ResourceResult>} */
    return requestBudgets.map(requestBudget => {
      const actual = requestCounts.get(requestBudget.resourceType) || 0;
      return {
        id: requestBudget.resourceType,
        // TODO: Localize?
        label: requestBudget.resourceType,
        budget: requestBudget.budget,
        actual: actual,
        difference: actual - requestBudget.budget,
        score: actual > requestBudget.budget ? 'fail' : 'pass',
      };
    }).sort(function(a, b) {
      return b.difference - a.difference;
    });
  }

  /**
  * @param {Array<LH.LightWallet.TimingBudget>} timingBudgets
  * @param {LH.Config.Settings} settings
  * @param {LH.Artifacts} artifacts
  * @param {LH.Audit.Context} context
  * @return {Promise<Array<LH.LightWallet.TimingResult>>}
  */
  static async timingAnalysis(timingBudgets, settings, artifacts, context) {
    /** @type {Array<LH.LightWallet.TimingResult>} */
    const results = await Promise.all(timingBudgets.map(async (timingBudget) => {
      return (await this.auditTimingMetric(timingBudget, settings, artifacts, context));
    }));
    return results.sort(function(a, b) {
      return b.difference - a.difference;
    });
  }

  /**
     * @param {LH.LightWallet.Budget} budget
     * @param {LH.Artifacts} artifacts
     * @param {LH.Audit.Context} context
     * @return {Promise<LH.LightWallet.Result>}
     */
  static async performanceAudit(budget, artifacts, context) {
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);
    const mainResource = await (MainResource.request({devtoolsLog, URL: artifacts.URL}, context));

    /** @type {LH.LightWallet.Result} */
    const result = {
      cpuThrottling: budget.cpuThrottling,
      connectionType: throttlingSettings[budget.connectionType],
    };
    if (budget.timings !== undefined) {
      const throttling = throttlingSettings[budget.connectionType];
      throttling.cpuSlowdownMultiplier = budget.cpuThrottling;

      const settingOverrides = {throttlingMethod: 'simulate', throttling: throttling};
      const settings = Object.assign({}, context.settings, settingOverrides);

      result.timings = await this.timingAnalysis(budget.timings, settings, artifacts, context);
    }

    if (budget.requests !== undefined) {
      const requestSummary = this.requestCountsByResourceType(networkRecords, mainResource.url);
      result.requests = this.requestAnalysis(budget.requests, requestSummary);
    }

    if (budget.pageWeight !== undefined) {
      const pageWeightSummary = this.pageWeightByResourceType(networkRecords, mainResource.url);
      result.pageWeight = this.pageWeightAnalysis(budget.pageWeight, pageWeightSummary);
    }
    return result;
  }

  /**
     * @param {LH.Artifacts} artifacts
     * @param {LH.Audit.Context} context
     * @return {Promise<LH.Audit.Product>}
     */
  static async audit(artifacts, context) {
    /** @type { LH.LightWallet.Json } */
    const config = new LightWalletBudget();

    /** @type {Array<LH.LightWallet.Result>} */
    const results = await Promise.all(config.budgets.map(async (budget) => {
      return await this.performanceAudit(budget, artifacts, context);
    }));

    return {
      rawValue: null,
      displayValue: this.getScore(results),
      details: results,
    };
  }
}

module.exports = LightWallet;
