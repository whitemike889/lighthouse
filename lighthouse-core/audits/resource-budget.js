/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit.js');
const ResourceSummary = require('../computed/resource-summary.js');
const i18n = require('../lib/i18n/i18n.js');

const UIStrings = {
  /** Imperative title of a Lighthouse audit that tells the user to minimize the size and quantity of resources used to load the page. */
  title: 'Keep request counts low and file sizes small',
  /** Description of a Lighthouse audit that tells the user that they can setup a budgets for the quantity and size of page resources. No character length limits. */
  description: 'To set budgets for the quantity and size of page resources,' +
    ' add a budget.json file.',
  /** [ICU Syntax] Label identifying the number of requests*/
  requestCount: `{count, plural,
    =1 {1 request}
    other {# requests}
   }`,
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

/** @typedef {{count: number, size: number}} ResourceEntry */

class ResourceBudget extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'resource-budget',
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      requiredArtifacts: ['devtoolsLogs', 'URL'],
    };
  }

  /**
   * @param {LH.Budget | undefined} budget
   * @return {LH.Audit.Details.Table['headings']}
   */
  static tableHeadings(budget) {
    /** @type {LH.Audit.Details.Table['headings']} */
    const headers = [
      {key: 'label', itemType: 'text', text: 'Resource Type'},
      {key: 'requestCount', itemType: 'numeric', text: 'Requests'},
      {key: 'size', itemType: 'bytes', text: 'Transfer Size'},
    ];

    /** @type {LH.Audit.Details.Table['headings']} */
    const budgetHeaders = [
      {key: 'countOverBudget', itemType: 'text', text: ''},
      {key: 'sizeOverBudget', itemType: 'bytes', text: 'Over Budget'},
    ];
    return budget ? headers.concat(budgetHeaders) : headers;
  }

  /**
   * @param {LH.Budget.ResourceType} resourceType
   * @return {string}
   */
  static rowLabel(resourceType) {
    /** @type {Record<LH.Budget.ResourceType,string>} */
    const strMappings = {
      'total': str_(i18n.UIStrings.totalResourceType),
      'document': str_(i18n.UIStrings.documentResourceType),
      'script': str_(i18n.UIStrings.scriptResourceType),
      'stylesheet': str_(i18n.UIStrings.stylesheetResourceType),
      'image': str_(i18n.UIStrings.imageResourceType),
      'media': str_(i18n.UIStrings.mediaResourceType),
      'font': str_(i18n.UIStrings.fontResourceType),
      'other': str_(i18n.UIStrings.otherResourceType),
      'third-party': str_(i18n.UIStrings.thirdPartyResourceType),
    };
    return strMappings[resourceType];
  }

  /**
   * @param {Record<LH.Budget.ResourceType,ResourceEntry>} summary
   * @return {Array<{resourceType: LH.Budget.ResourceType, label: string, requestCount: number, size: number}>}
   */
  static defaultTable(summary) {
    const types = /** @type {Array<LH.Budget.ResourceType>} */ (Object.keys(summary));
    const rows = types.map(type => {
      return {
        resourceType: type,
        label: this.rowLabel(type),
        requestCount: summary[type].count,
        size: summary[type].size,
      };
    });
    // Force third-party to be last, descending by size otherwise
    const thirdPartyRow = rows.find(r => r.resourceType === 'third-party') || [];
    const otherRows = rows.filter(r => r.resourceType !== 'third-party')
      .sort((a, b) => {
        return b.size - a.size;
      });
    return otherRows.concat(thirdPartyRow);
  }

  /**
   * @param {LH.Budget} budget
   * @param {Record<LH.Budget.ResourceType,ResourceEntry>} summary
   * @return {Array<{resourceType: LH.Budget.ResourceType, label: string, requestCount: number, size: number, sizeOverBudget: number | undefined, countOverBudget: string | undefined}>}
   */
  static budgetTable(budget, summary) {
    const resourceTypes = /** @type {Array<LH.Budget.ResourceType>} */ (Object.keys(summary));
    return resourceTypes.map((type) => {
      const resourceType = type;
      const label = this.rowLabel(type);
      const requestCount = summary[type].count;
      const size = summary[type].size;

      let sizeOverBudget;
      let countOverBudget;

      if (budget.resourceSizes) {
        const sizeBudget = budget.resourceSizes.find(b => b.resourceType === type);
        if (sizeBudget && (size > (sizeBudget.budget * 1024))) {
          sizeOverBudget = size - (sizeBudget.budget * 1024);
        }
      }
      if (budget.resourceCounts) {
        const countBudget = budget.resourceCounts.find(b => b.resourceType === type);
        if (countBudget && (requestCount > countBudget.budget)) {
          const requestDifference = requestCount - countBudget.budget;
          countOverBudget = str_(UIStrings.requestCount, {count: requestDifference});
        }
      }
      return {
        resourceType,
        label,
        requestCount,
        size,
        countOverBudget,
        sizeOverBudget,
      };
    }).filter((row) => {
      // Only resources with budgets should be included in the table
      if (budget.resourceSizes) {
        if (budget.resourceSizes.find(b => b.resourceType === row.resourceType)) return true;
      }
      if (budget.resourceCounts) {
        if (budget.resourceCounts.find(b => b.resourceType === row.resourceType)) return true;
      }
      return false;
    }).sort((a, b) => {
      return (b.sizeOverBudget || 0) - (a.sizeOverBudget || 0);
    });
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];

    /** @type {Record<LH.Budget.ResourceType,{count:number, size:number}>} */
    const summary = await ResourceSummary.request({devtoolsLog, URL: artifacts.URL}, context);

    /** @type {LH.Budget | undefined} */
    const budget = context.settings.budgets ? context.settings.budgets[0] : undefined;

    const headings = ResourceBudget.tableHeadings(budget);
    const tableItems = budget ? this.budgetTable(budget, summary) : this.defaultTable(summary);

    return {
      details: Audit.makeTableDetails(headings, tableItems),
      score: 1,
    };
  }
}

module.exports = ResourceBudget;
module.exports.UIStrings = UIStrings;
