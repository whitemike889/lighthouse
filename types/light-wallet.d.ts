/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

declare global {
    module LH {
        module LightWallet {
            export interface Budget {
                cpuThrottling: number;
                connectionType: string;
                requests?: Array<ResourceBudget>;
                pageWeight?: Array<ResourceBudget>;
                timings?: Array<TimingBudget>;
            }

            export interface Json {
                budgets: Array<Budget>;
            }

            export interface ResourceBudget {
                resourceType: string;
                budget: number;
            }

            export interface ResourceResult {
                id: string;
                label: string;
                budget: number;
                difference: number;
                actual: number;
                score: string;
            }

            export interface Result {
                connectionType: ThrottleSetting;
                cpuThrottling?: number;
                timings?: Array<TimingResult>;
                pageWeight?: Array<ResourceResult>;
                requests?: Array<ResourceResult>;
            }

            export interface ThrottleSetting {
                rttMs: number;
                throughputKbps: number;
                requestLatencyMs: number;
                downloadThroughputKbps: number;
                uploadThroughputKbps: number;
                cpuSlowdownMultiplier?: number;
                networkLabel: string;
            }

            export interface TimingBudget {
                metric: string;
                budget: number;
                tolerance?: number;
            }

            export interface TimingResult {
                id: string,
                label: string;
                budget: number;
                tolerance?: number
                actual: number;
                difference: number;
                score: string;
            }
        }
    }
}

// empty export to keep file a module
export { }
