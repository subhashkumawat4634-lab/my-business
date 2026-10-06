const { withAndroidManifest } = require('@expo/config-plugins');

function withCleartextTraffic(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    if (manifest && manifest.application && manifest.application[0]) {
      manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
}

module.exports = withCleartextTraffic;
