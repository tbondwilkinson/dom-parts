import { summaryReporter } from '@web/test-runner';

export default {
  files: ['test/**/*_test.js'],
  nodeResolve: {
    exportConditions: ['development'],
  },
  // reporters: [summaryReporter()],
  testFramework: {
    config: {
      ui: 'bdd',
      timeout: '2000',
    },
  },
  browserLogs: true,
};
