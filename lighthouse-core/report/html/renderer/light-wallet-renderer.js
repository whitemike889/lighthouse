/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/* globals self, Util, CategoryRenderer */

/** @typedef {import('./dom.js')} DOM */

class LightWalletRenderer extends CategoryRenderer {
  /**
     * @param {LH.ReportResult.Category} category
     * @return {DocumentFragment}
     */
  renderScoreGauge(category) {
    const tmpl = this.dom.cloneTemplate('#tmpl-lh-gauge--light-wallet', this.templateContext);
    const wrapper = /** @type {HTMLAnchorElement} */ (this.dom.find('.lh-lw__gauge-wrapper',
            tmpl));
    wrapper.href = `#${category.id}`;

    const score = category.auditRefs[0].result.displayValue;
    wrapper.classList.add(`lh-gauge__wrapper--${score}`);
    this.dom.find('.lh-lw__gauge-label', tmpl).textContent = category.title;
    return tmpl;
  }

  /**
   *
   * @param {number} value
   * @param {number} maxValue
   * @return {string}
   */
  sparklineWidthStr(value, maxValue) {
    const width = (value * 100 / maxValue) > 2 ? (value * 100 / maxValue) : 2;
    return `${width}%`;
  }

  /**
 *
 * @param {number} difference
 * @return {string}
 */
  plusOrMinusStr(difference) {
    if (difference === 0) return '';
    return difference > 0 ? '+ ' : '- ';
  }

  /**
   * @param {string} rowType
    * @param {LH.LightWallet.ResourceResult} result
    * @param {number} sparklineScale
    * @return {Element}
    */
  renderResourceRow(rowType, result, sparklineScale) {
    if (rowType !== 'pageWeight' && rowType !== 'requests') throw new Error('Invalid row type');

    const tmplForRow = this.dom.cloneTemplate('#tmpl-lw-resources-table', this.templateContext);
    const row = this.dom.find('.lh-metric', tmplForRow);

    row.id = `light-wallet--${result.id}`;

    const titleEl = this.dom.find('.lh-lw__resource-col--description', tmplForRow);
    titleEl.textContent = result.label.charAt(0).toUpperCase() + result.label.slice(1);

    const budgetEl = this.dom.find('.lh-lw__resource-col--budget', tmplForRow);
    budgetEl.textContent = rowType === 'pageWeight' ?
      Util.formatBytesToKB(result.budget) : `${result.budget} requests`;

    const actualEl = this.dom.find('.lh-lw__resource-col--actual', tmplForRow);
    actualEl.textContent = rowType === 'pageWeight' ?
      Util.formatBytesToKB(result.actual) : `${result.actual} requests`;

    if (result.score === 'fail') {
      const width = this.sparklineWidthStr(result.difference, sparklineScale);
      this.dom.find('.lh-sparkline__bar', tmplForRow).style.width = width;
    }

    const differenceEl = this.dom.find('.lh-lw__resource-col--difference', tmplForRow);

    const prefix = this.plusOrMinusStr(result.difference);
    const absDifference = Math.abs(result.difference);
    const formattedNumber = rowType === 'pageWeight' ?
      // TODO Localize
      Util.formatBytesToKB(absDifference) :
      (absDifference !== 1 ? `${absDifference} requests` : `1 request`);
    differenceEl.textContent = `${prefix}${formattedNumber}`;

    row.classList.add(`lh-audit--${result.score}`);

    return row;
  }

  /**
  * @param {LH.LightWallet.TimingResult} result
  * @param {number} sparklineScale
  * @return {Element}
  */
  renderTimingRow(result, sparklineScale) {
    const tmplForRow = this.dom.cloneTemplate('#tmpl-lw-timings-table', this.templateContext);
    const row = this.dom.find('.lh-metric', tmplForRow);

    row.id = `light-wallet--${result.id}`;

    const titleEl = this.dom.find('.lh-lw__timings-col--description', tmplForRow);
    titleEl.textContent = result.label;

    const budgetEl = this.dom.find('.lh-lw__timings-col--budget-value', tmplForRow);
    budgetEl.textContent = Util.formatSeconds(result.budget);

    if (result.tolerance !== undefined) {
      const toleranceEl = this.dom.find('.lh-lw__timings-col--budget-tolerance', tmplForRow);
      // TODO: Localize
      toleranceEl.textContent = Util.formatMilliseconds(result.tolerance) + ' tolerance';
    }

    const actualEl = this.dom.find('.lh-lw__timings-col--actual', tmplForRow);
    actualEl.textContent = Util.formatSeconds(result.actual);

    if (result.score === 'fail') {
      const width = this.sparklineWidthStr(result.difference, sparklineScale);
      this.dom.find('.lh-sparkline__bar', tmplForRow).style.width = width;
    }

    const differenceEl = this.dom.find('.lh-lw__timings-col--difference', tmplForRow);
    const prefix = this.plusOrMinusStr(result.difference);
    const formattedNumber = Util.formatSeconds(Math.abs(result.difference));
    differenceEl.textContent = `${prefix}${formattedNumber}`;

    row.classList.add(`lh-audit--${result.score}`);
    return row;
  }

  /**
  * @param {LH.LightWallet.Result} result
  * @return {Element}
  */
  renderSectionHeader(result) {
    const tmpl = this.dom.cloneTemplate('#tmpl-lw-section-header', this.templateContext);
    const header = this.dom.find('.lh-lw__section-header', tmpl);
    // TODO: Localize
    const ordinal = result.cpuThrottling === 1 ? 'No' : `${result.cpuThrottling}x`;
    header.textContent = `${result.connectionType.networkLabel}; ${ordinal} CPU Throttling`;
    return header;
  }

  /**
* @param {Array<LH.LightWallet.TimingResult>} timingResults
* @return {Element}
*/
  renderTimingsTable(timingResults) {
    const table = this.dom.createElement('div', 'lh-lw__timings-table');
    const tmpl = this.dom.cloneTemplate('#tmpl-lw-timings-table', this.templateContext);
    const header = this.dom.find('.lh-lw__timings-header', tmpl);
    table.appendChild(header);

    const maxDifference = this.maxDifference(timingResults);
    for (const result of timingResults) {
      const row = this.renderTimingRow(result, maxDifference);
      table.appendChild(row);
    }
    return table;
  }

  /**
* @param {Array<LH.LightWallet.ResourceResult>} weights
* @return {Element}
*/
  renderPageWeightTable(weights) {
    const table = this.dom.createElement('div', 'lh-lw__resources-table');
    const tmpl = this.dom.cloneTemplate('#tmpl-lw-resources-table', this.templateContext);
    const header = this.dom.find('.lh-lw__resources-header', tmpl);
    table.appendChild(header);

    const maxDifference = this.maxDifference(weights);
    for (const result of weights) {
      const row = this.renderResourceRow('pageWeight', result, maxDifference);
      table.appendChild(row);
    }
    return table;
  }

  /**
* @param {Array<LH.LightWallet.ResourceResult>} results
* @return {number}
*/
  maxDifference(results) {
    let max = 0;
    for (const result of results) {
      if (result.difference > max) max = result.difference;
    }
    return max;
  }

  /**
* @param {Array<LH.LightWallet.ResourceResult>} results
* @return {Element}
*/
  renderRequestsTable(results) {
    const table = this.dom.createElement('div', 'lh-lw__resources-table');
    const tmpl = this.dom.cloneTemplate('#tmpl-lw-resources-table', this.templateContext);
    const tableHeader = this.dom.find('.lh-lw__resources-header', tmpl);
    table.appendChild(tableHeader);

    const maxDifference = this.maxDifference(results);
    for (const result of results) {
      const row = this.renderResourceRow('requests', result, maxDifference);
      table.appendChild(row);
    }
    return table;
  }

  /**
     * @param {LH.ReportResult.Category} category
     * @param {Object<string, LH.Result.ReportGroup>} groups
     * @return {Element}
     * @override
     */
  render(category, groups) {
    const categoryElement = this.dom.createElement('div', 'lh-category');
    this.createPermalinkSpan(categoryElement, category.id);
    categoryElement.appendChild(this.renderCategoryHeader(category, groups));

    const lightWalletAudit = category.auditRefs[0];
    const lightWalletEl = this.dom.createChildOf(categoryElement, 'div', 'lh-lw');

    console.log(lightWalletAudit.result);
    for (const profile of lightWalletAudit.result.details) {
      lightWalletEl.appendChild(this.renderSectionHeader(profile));

      if (profile.pageWeight && profile.pageWeight.length > 0) {
        lightWalletEl.appendChild(this.renderPageWeightTable(profile.pageWeight));
      }

      if (profile.requests && profile.requests.length > 0) {
        lightWalletEl.appendChild(this.renderRequestsTable(profile.requests));
      }

      if (profile.timings && profile.timings.length > 0) {
        lightWalletEl.appendChild(this.renderTimingsTable(profile.timings));
      }
    }
    return categoryElement;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightWalletRenderer;
} else {
  self.LightWalletRenderer = LightWalletRenderer;
}
