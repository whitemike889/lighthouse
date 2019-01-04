/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/** @type {LH.LightWallet.Json} */
const lightWalletConfig = {
  budgets: [{
    cpuThrottling: 1,
    connectionType: 'wifi',
    pageWeight: [
      {
        resourceType: 'total',
        budget: 750,
      },
      {
        resourceType: 'script',
        budget: 300,
      },
      {
        resourceType: 'image',
        budget: 250,
      },
      {
        resourceType: 'font',
        budget: 100,
      },
      {
        resourceType: 'stylesheet',
        budget: 50,
      },
      {
        resourceType: 'document',
        budget: 50,
      },
    ],
  },
  ],
};

module.exports = lightWalletConfig;
