import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:'**/*.spec.mjs',fullyParallel:false,workers:1,
 reporter:[['list']],use:{headless:true,trace:'off',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}]
});
