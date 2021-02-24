
/**
 * build configuration for the plugin:
 * exported AppConfig variables will be included in generated module-config.gen.js
 */

import { PluginExportBuildConfigCreator } from 'mmir-tooling';

export const buildConfigLibDependencies: PluginExportBuildConfigCreator = function(pluginConfig, _runtimeConfig, _pluginBuildConfigs) {
  if(pluginConfig && pluginConfig.encoder === 'wav'){
    return {
      includeModules: ['mmir-plugin-encoder-core/workers/wavEncoder']
    }
  }
};
