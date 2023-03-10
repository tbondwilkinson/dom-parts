export default {
  files: ['test/**/*_test.js'],
  nodeResolve: {
    exportConditions: ['development'],
  },
  testFramework: {
    config: {
      ui: 'bdd',
      timeout: '2000',
    },
  },
  browserLogs: true,
};
