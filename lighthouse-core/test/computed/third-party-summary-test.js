/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const ComputedThirdPartySummary = require('../../computed/third-party-summary.js');
const assert = require('assert');
const networkRecordsToDevtoolsLog = require('../network-records-to-devtools-log.js');

/* eslint-env jest */

function mockArtifacts(networkRecords) {
  return {
    devtoolsLog: networkRecordsToDevtoolsLog(networkRecords),
    URL: {requestedUrl: networkRecords[0].url, finalUrl: networkRecords[0].url},
  };
}

describe('Third Party Summary computed', () => {
  let artifacts;
  let context;
  beforeEach(() => {
    artifacts = mockArtifacts([
      {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
      {url: 'http://cdn.example.com/app.js', resourceType: 'Script', transferSize: 10},
      {url: 'http://my-cdn.com/styles.css', resourceType: 'Stylesheet', transferSize: 25},
      {url: 'http://third-party.com/script.js', resourceType: 'Script', transferSize: 50},
      {url: 'http://third-party.com/file.jpg', resourceType: 'Image', transferSize: 70},
    ]);
    context = {computedCache: new Map(), settings: {}};
  });

  describe('when firstPartyHostnames is not set', () => {
    it('the root domain and all subdomains are considered first-party', async () => {
      context.settings.budgets = null;
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(25 + 50 + 70);
      expect(result.count).toBe(3);
    });

    it('handles second-level TLDs correctly,', async () => {
      artifacts = mockArtifacts([
        {url: 'http://shopping-mall.co.uk/file.html', resourceType: 'Document', transferSize: 30},
        {url: 'http://es.shopping-mall.co.uk/file.html', resourceType: 'Script', transferSize: 7},
        {url: 'http://co.uk', resourceType: 'Script', transferSize: 10},
      ]);
      context.settings.budgets = null;
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(10);
      expect(result.count).toBe(1);
    });
  });

  describe('when firstPartyHostnames is set', () => {
    const allResourcesSize = 30 + 10 + 25 + 50 + 70;
    const allResourcesCount = 5;
    it('handles subdomain hostnames correctly', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          firstPartyHostnames: ['cdn.example.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(allResourcesSize - 10);
      expect(result.count).toBe(allResourcesCount - 1);
    });

    it('handles wildcard expressions correctly', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          // Matches example.com and cdn.example.com
          firstPartyHostnames: ['*.example.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(allResourcesSize - 30 - 10);
      expect(result.count).toBe(allResourcesCount - 2);
    });

    it('handles root domain hostname correctly', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          // Matches example.com; does not match cdn.example.com
          firstPartyHostnames: ['example.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(allResourcesSize - 30);
      expect(result.count).toBe(allResourcesCount - 1);
    });

    it('handles multiple hostnames correctly', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          firstPartyHostnames: ['example.com', 'my-cdn.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(allResourcesSize - 30 - 25);
      expect(result.count).toBe(allResourcesCount - 2);
    });

    it('handles syntactical duplication of hostnames', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          firstPartyHostnames: ['my-cdn.com', 'my-cdn.com', 'my-cdn.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(allResourcesSize - 25);
      expect(result.count).toBe(allResourcesCount - 1);
    });

    it('handles logical duplication of hostnames', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          firstPartyHostnames: ['example.com', '*.example.com', 'cdn.example.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(allResourcesSize - 30 - 10);
      expect(result.count).toBe(allResourcesCount - 2);
    });

    it('handles using top-level domains as firstPartyHostnames correctly', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          firstPartyHostnames: ['*.com'],
        },
      }];
      const result = await ComputedThirdPartySummary.request(artifacts, context);
      expect(result.size).toBe(0);
      expect(result.count).toBe(0);
    });

    /**
     * Data URLs should be ignored to avoid double counting.
     * The filesize of a data URL is reflected in the filesize of the resource that contains it.
     * A data URL does not result in a separate network request.
     */
    it('ignores data URLs', async () => {
      context.settings.budgets = [{
        path: '/',
        options: {
          firstPartyHostnames: ['example.com'],
        },
      }];

      artifacts = mockArtifacts([
        {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
        {url: 'data:image/png;base64,iVBORw0KGgoAA', resourceType: 'Image', transferSize: 10},
      ]);

      const result = await ComputedThirdPartySummary.request(artifacts, context);
      assert.equal(result.count, 0);
      assert.equal(result.size, 0);
    });
  });
});
