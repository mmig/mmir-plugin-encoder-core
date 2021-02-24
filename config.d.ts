
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
  webAudioInput?: PluginConfigEntry | MicrophonePluginConfigEntry;
  /** for (simple) end-of-speech detection */
  silenceDetector?: SilenceDetectorPluginConfigEntry;
}

export interface PluginConfigEntry extends MediaManagerPluginEntry {

  //NOT IMPLEMENTED/SUPPORTED, TODO?
  // /** @example  "2000000" */
  // silenceBuffer?: number|string;

  /**
   * size (~ number of audio chunks) for repeat-buffer:
   *
   * during encoding last n chunks get buffered, and on silence (~> end-of-speech)
   * get prepended to the new audio data
   * (in order to prepend audio that is really the next speech utterance but was
   *  still attached to the previous audio due to delay in end-of-speech detection
   *  )
   *
   * @default 3
   */
  repeatBufferSize?: number;

  /**
   * custom encoder parameters (depends on encoder)
   */
  encoderParams?: EncoderParamsConfigEntry;
}

export interface SilenceDetectorPluginConfigEntry {
  /**
   * @type float from interval [0, 1]
   * @default 0.1
   */
  noiseTreshold?: number | string;
  /**
   * @type integer
   * @default 3
   */
  pauseCount: number | string;
  /**
   * @type integer
   * @default 15
   */
  resetCount: number | string;
  //MOVED & RENAMED -> repeatBufferSize
  // /**
  //  * @type integer
  //  * @default 3
  //  */
  // bufferSize: number | string;
}

export interface MicrophonePluginConfigEntry {
  /**
   * preferred number of channels for capturing/recording audio from microphone
   *
	 * NOTE: may not be supported by environment for capturing the audio,
	 *       but internal recording/encoding will use this setting
	 *
	 * WARNING: currently, only recording/encoding for 1 channel is supported
	 *          (since most speech recognition services require 1 channel/mono audio)
   *
   * @type number
   * @default 1
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints/channelCount
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/channelCount
   */
  channelCount?: number;
  /**
   * preferred sample rate for capturing/recording audio from microphone
   *
   * NOTE: may not be supported by environment
   *
   * @type number
   * @default 44100
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints/sampleRate
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/sampleRate
   */
  sampleRate?: number;
  /**
   * whether or not request _automatic gain (input volume) control_ when capturing/recording audio from microphone
   *
   * NOTE: may not be supported by environment
   *
   * @type boolean
   * @default true
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints/autoGainControl
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/autoGainControl
   */
  autoGainControl?: boolean;
  /**
   * whether or not request _echo cancellation_ when capturing/recording audio from microphone
   *
   * NOTE: may not be supported by environment
   *
   * @type boolean
   * @default false
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints/echoCancellation
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation
   */
  echoCancellation?: boolean;
  /**
   * whether or not request _noise supression_ when capturing/recording audio from microphone
   *
   * NOTE: may not be supported by environment
   *
   * @type boolean
   * @default true
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints/noiseSuppression
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/noiseSuppression
   */
  noiseSuppression?: boolean;
}

export interface EncoderParamsConfigEntry {
  /**
   * MIME type for the encoded audio (depends on encoder)
   * DEFAULT depends on encoder implementation
   */
  mimeType?: string;

  /** custom endoder parameters (depend on specific encoder implementation; will always have a default setting) */
  [field: string]: any;
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
  opus = 'mmir-plugin-encoder-opus',
  speex = 'mmir-plugin-encoder-speex',
  wav = 'mmir-plugin-encoder-core/workers/wavEncoder'
  //[TODO] speex = 'mmir-plugin-encoder-speex'
}

/*
 * Know web-audio implementations
 *
 * TODO extract this from implementation www/webAudioInput.js::_defaultWorkerImpl
 */

export type ASRGoogleXHRImplType = 'mmir-plugin-asr-google-xhr.js';
export type ASRCerenceWSImplType = 'mmir-plugin-asr-cerence-ws.js';
// export type ASRNuanceXHRImplType = 'mmir-plugin-asr-nuance-xhr.js';
// export type ASRNuanceWSImplType = 'mmir-plugin-asr-nuance-ws.js';


//////////////////////////////////// Config within "mediaManager.plugin.env" ////////////////////
//TODO move (& extend) this? to mmir-lib typings?

export type WebAudioInputNameType = 'mmir-plugin-encoder-core';

export type WebAudioInputImplType = ASRGoogleXHRImplType | ASRCerenceWSImplType;// | ASRNuanceXHRImplType | ASRNuanceWSImplType;

export interface MediaManagerConfigWebAudioInputEntry extends MediaManagerPluginEntry {
  mod: WebAudioInputNameType;
  config?: WebAudioInputImplType | string;
  ctx?: string;
}
