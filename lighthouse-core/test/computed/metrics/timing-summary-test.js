/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const TimingSummary = require('../../../computed/metrics/timing-summary.js');

const trace = require('../../fixtures/traces/progressive-app-m60.json');
const devtoolsLog = require('../../fixtures/traces/progressive-app-m60.devtools.log.json');

/* eslint-env jest */
describe('Timing summary', () => {
  it('contains the correct data', async () => {
    const artifacts = {
      traces: {defaultPass: trace},
      devtoolsLogs: {defaultPass: devtoolsLog},
    };
    const context = {settings: {throttlingMethod: 'simulate'}, computedCache: new Map()};
    const result = await TimingSummary.summarize(artifacts, context);

    expect(result).toMatchSnapshot();
    // Includes performance metrics
    expect(result.firstContentfulPaint).toBeDefined();
    // Includes timestamps from trace of tab
    expect(result.observedFirstContentfulPaint).toBeDefined();
    // Includs visual metrics from Speedline
    expect(result.observedFirstVisualChange).toBeDefined();
  });
});
