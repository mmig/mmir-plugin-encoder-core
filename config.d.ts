
/* plugin config definition: used by mmir-plugin-exports to generate module-config.gen.js */

import { MediaManagerPluginEntry } from 'mmir-lib';

/**
 * (optional) entry "webAudioInput" in main configuration.json
 * for settings of WebAudioInput module.
 *
 * Some of these settings can also be specified by using the options argument
 * in the ASR functions of {@link MediaManagerWebInput}, e.g.
 * {@link MediaManagerWebInput#recognize} or {@link MediaManagerWebInput#startRecord}
 * (if specified via the options, values will override configuration settings).
 */
export interface PluginConfig {
  webAudioInput?: PluginConfigEntry;
}

export interface PluginConfigEntry extends MediaManagerPluginEntry {

  /** for (simple) end-of-speech detection */
  silenceDetector?: SilenceDetectorPluginConfigEntry;

    //NOT IMPLEMENTED/SUPPORTED, TODO?
    // /** @example  "2000000" */
    // silenceBuffer?: number|string;
}

export interface SilenceDetectorPluginConfigEntry {
  /**
   * @type float of interval [0, 1], or stringified float
   * @default 0.1
   */
  noiseTreshold?: number | string;
  /**
   * @type integer, or stringified integer
   * @default 3
   */
  pauseCount: number | string;
  /**
   * @type integer, or stringified integer
   * @default 15
   */
  resetCount: number | string;
}

/**
 * Known encoders:
 * can be specified via plugin-configuration
 *
 * @exmaple
 *  <pluginName>: {
 *    "encoder": "flac",
 *    ....
 *  }
 *
 * TODO extract this from implementation www/webAudioInput.js::_workerImpl
 */
export enum DefaultEncoders {
  amr = 'mmir-plugin-encoder-amr',
  flac = 'mmir-plugin-encoder-flac',
  wav = 'mmir-plugin-encoder-core/workers/recorderWorkerExt'
  //[TODO] speex = 'mmir-plugin-encoder-speex'
}

/*
 * Know web-audio implementations
 *
 * TODO extract this from implementation www/webAudioInput.js::_defaultWorkerImpl
 */

export type ASRGoogleXHRImplType = 'mmir-plugin-asr-google-xhr.js';
export type ASRNuanceXHRImplType = 'mmir-plugin-asr-nuance-xhr.js';
export type ASRNuanceWSImplType = 'mmir-plugin-asr-nuance-ws.js';


//////////////////////////////////// Config within "mediaManager.plugin.env" ////////////////////
//TODO move (& extend) this? to mmir-lib typings?

export type WebAudioInputNameType = 'mmir-plugin-encoder-core';

export type WebAudioInputImplType = ASRGoogleXHRImplType | ASRNuanceXHRImplType | ASRNuanceWSImplType;

export interface MediaManagerConfigWebAudioInputEntry extends MediaManagerPluginEntry {
  mod: WebAudioInputNameType;
  config?: WebAudioInputImplType | string;
  ctx?: string;
}
