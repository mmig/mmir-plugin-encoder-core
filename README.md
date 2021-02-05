# [mmir-plugin-encoder-core][0]

[![MIT license](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/mmig/mmir-plugin-encoder-core/master)](https://github.com/mmig/mmir-plugin-encoder-core)
[![npm](https://img.shields.io/npm/v/mmir-plugin-encoder-core)](https://www.npmjs.com/package/mmir-plugin-encoder-core)
[![API](https://img.shields.io/badge/docs-MediaManager%20API-orange.svg?style=flat)][1]
[![Guides](https://img.shields.io/badge/docs-MMIR%20Speech%20Processing-orange.svg?style=flat)][2]

Cordova plugin for the MMIR framework that provides core functionality for running (JavaScript)
audio encoders via WebWorkers.

The plugin provides a base implementation for handling web-based (HTML5) access to the microphone
and encoding the audio to WAV/PCM or other codecs in a WebWorker.

Specialized implementation modules handle integration into various speech recognition services.

For encoders see
 * [mmir-plugin-encoder-amr][3]
 * [mmir-plugin-encoder-flac][4]
 * [mmir-plugin-encoder-opus][10]
 * [mmir-plugin-encoder-speex][5]

For speech service integrations see
 * [mmir-plugin-asr-cerence-ws][9]
 * [mmir-plugin-asr-google-xhr][6]

-----

> __Archived:__ Outdated speech service integrations
> * ~~[mmir-plugin-asr-nuance-xhr][7]~~ _(the Nuance speech service has been discontinued; use Cerence WS instead)_
> * ~~[mmir-plugin-asr-nuance-ws][8]~~ _(the Nuance speech service has been discontinued; use Cerence WS instead)_


[0]: https://github.com/mmig/mmir-plugin-encoder-core
[1]: https://mmig.github.io/mmir/api/mmir.MediaManager.html
[2]: https://github.com/mmig/mmir/wiki/3.9.2-Speech-Processing-in-MMIR
[3]: https://github.com/mmig/mmir-plugin-encoder-amr
[4]: https://github.com/mmig/mmir-plugin-encoder-flac
[5]: https://github.com/mmig/mmir-plugin-encoder-speex
[6]: https://github.com/mmig/mmir-plugin-asr-google-xhr
[7]: https://github.com/mmig/mmir-plugin-asr-nuance-xhr
[8]: https://github.com/mmig/mmir-plugin-asr-nuance-ws
[9]: https://github.com/mmig/mmir-plugin-asr-cerence-ws
[10]: https://github.com/mmig/mmir-plugin-encoder-opus
