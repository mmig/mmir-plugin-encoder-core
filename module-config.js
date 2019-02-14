
// <loaded implementation>.getPluginName():
//  * encoder: ["wav" | "flac" | "amr" | <encoder module ID | module-file>]
// "silenceDetector"
//  * noiseTreshold: float [0, 1], DEFAULT: 0.1
//  * pauseCount: integer, DEFAULT: 3
//  * resetCount: integer, DEFAULT: 15

//TODO generate from js sources
modules.export = {
  pluginName: 'webAudioInput',
  defaultEncoders: {
    amr: 'mmir-plugin-encoder-amr',
    flac: 'mmir-plugin-encoder-flac',
    //TODO speex: 'mmir-plugin-encoder-speex',
    wav: 'mmir-plugin-encoder-core/workers/recorderWorkerExt'
  }
};
