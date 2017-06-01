const log = require('./log');

// Fix the polyfill. See https://github.com/GoogleChrome/lighthouse/issues/73
self.setImmediate = function (callback) {
  const args = [...arguments].slice(1);
  Promise.resolve().then(() => callback(...args));
  return 0;
};

const noop = () => undefined;
const sentryDelegate = module.exports = {
  config() {
    return {install: noop};
  },
  context(data, functionToWrap) {
    if (typeof functionToWrap === 'undefined') {
      functionToWrap = data;
    }

    functionToWrap();
  },
  captureMessage: noop,
  captureException: noop,
  captureBreadcrumb: noop,
  setContext: noop,
  mergeContext: noop,
  init(useSentry, config) {
    if (!useSentry) {
      return;
    }

    config = Object.assign({}, config, {
      allowSecretKey: true,
    });

    try {
      const Sentry = require('raven');
      Sentry.config('https://a6bb0da87ee048cc9ae2a345fc09ab2e:63a7029f46f74265981b7e005e0f69f8@sentry.io/174697', config).install();
      Object.keys(sentryDelegate).forEach(functionName => {
        if (functionName === 'init') {
          return;
        }

        sentryDelegate[functionName] = (...args) => Sentry[functionName](...args);
        sentryDelegate.captureException = (...args) => {
          if (args[0] && args[0].expected) return;
          Sentry.captureException(...args);
        }
      });
    } catch (e) {
      log.warn('sentry', 'Could not load raven library, errors will not be reported.');
    }
  }
}
