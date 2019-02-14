
/**
 * (optional) entry "html5AudioInput" in main configuration.json
 * for settings of WebAudioInput module.
 *
 * Some of these settings can also be specified by using the options argument
 * in the ASR functions of {@link MediaManagerWebInput}, e.g.
 * {@link MediaManagerWebInput#recognize} or {@link MediaManagerWebInput#startRecord}
 * (if specified via the options, values will override configuration settings).
 */
export interface WebAudioInputConfigEntry {
  html5AudioInput?: WebAudioInputConfig;
}

export interface WebAudioInputConfig {

    silenceDetector?: SilenceDetectorConfig;

    //NOT IMPLEMENTED/SUPPORTED, TODO?
    // /** @example  "2000000" */
    // silenceBuffer?: number|string;

    //not used anymore:
    // /** @example  "ws://localhost:9999" */
    // webSocketAddress: string;
    // /** @example  "4096" */
    // soundPackageSize: "4096";
}

export interface SilenceDetectorConfig {
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

  //NOT IMPLEMENTED/SUPPORTED, TODO?
  // /**
  //  * @type integer, or stringified integer
  //  * @default 3
  //  */
  // minimalSpeachCount: number | string;
}
