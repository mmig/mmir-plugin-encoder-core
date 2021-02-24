
/*
 * License (MIT)
 *
 * modifications:
 *	Copyright (c) 2013-2021 DFKI GmbH, Deutsches Forschungszentrum fuer Kuenstliche Intelligenz (German Research Center for Artificial Intelligence), https://www.dfki.de
 *
 * based on recorder.js (https://github.com/mattdiamond/Recorderjs)
 *	Copyright (C) 2013 Matt Diamond (MIT License)
 *
 */

define(['mmirf/events'], function(EventEmitter){

	var WORKER_PATH = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? 'mmir-plugin-encoder-core/workers/wavEncoder' : 'mmirf/workers/wavEncoder.js';

	/**
	 *
	 * @param       {MediaStreamTrackAudioSourceNode} source the media stream source for recording (as created by AudioContext.createMediaStreamTrackSource())
	 * @param       {RecorderOptions} [cfg] OPTIONAL configuration for the recorder:
	 * @param       {RecorderOptions} [cfg.bufferSize] {Number} OPTIONAL the buffer size for recording
	 *                                (DEFAULT: 4096)
	 * @param       {RecorderOptions} [cfg.channels] {Number} OPTIONAL the count of channels for recording
	 *                                (DEFAULT: 1)
	 * @param       {RecorderOptions} [cfg.streaming] {Boolean} OPTIONAL if encoding results should be emitted as <code>dataavailable</code> as soon as they become available
	 *                                  Streaming also indicates, if requested data chunks/blobs should be finalized w.r.t. the next audio chunk/blob:
	 *                                  e.g. for streaming FALSE with target type "audio/flac" the created result would finalize the encoder, and the next data chunk/blob would start with a new FLAC header.
	 *                                (DEFAULT: false)
	 * @param       {RecorderOptions} [cfg.resultMode] {"blob" | "merged" | "raw"} OPTIONAL if encoding results should be emitted as <code>dataavailable</code> as soon as they become available
	 *                                (DEFAULT: "blob")
	 * @param       {RecorderOptions} [cfg.targetSampleRate] {Number} OPTIONAL configuration for the recorder
	 *                                (DEFAULT: use same sample rate as the source stream)
	 * @param       {RecorderOptions} [cfg.transferBuffers] {Boolean} OPTIONAL if sent buffers (to/from worker) should be transfered (i.e. transfere ownership; buffers are not usable after sending)
	 *                                (DEFAULT: true)
	 * @param       {RecorderOptions} [cfg.encodingMode] {"onfinish" | "ondata"} OPTIONAL encoding mode: when to apply encoding/transformation operations to the audio data
	 *                                (DEFAULT: "onfinish")
	 * @param       {RecorderOptions} [cfg.detection] {VoiceDetectionOptions} OPTIONAL configuration for the voice detection
	 *                                (DEFAULT: undefined)
	 * @param       {RecorderOptions} [cfg.params] {any} OPTIONAL custom encoder parameter
	 *                                (DEFAULT: undefined)
	 * @param       {RecorderOptions} [cfg.params.mimeType] {String} OPTIONAL the (requested) MIME type for the encoded data
	 *                                (DEFAULT: depends on encoder implementation)
	 * @constructor
	 */
	var Recorder = function Recorder(source, cfg){

		var config = Object.assign({
			bufferSize: 4096,
			channels: 1,
			transferBuffers: true,
		}, cfg || {});

		config.params = config.params || {};

		//DISABLED really depends on the encoder implementation (is )
		// if(!config.params.mime){
		// 	config.params.mime = 'audio/wav';
		// }

		var worker = null;
		var recording = false;

		//NOTE this will not be invoked in context of the Recorder
		//    (i.e. "this" within this method would not access the recorder instance)
		this._doRecordAudio = function(evt){

			if (!recording) return;

			var buffers = new Array(config.channels);

			//DISABLED cannot transfer buffers that originate from audio node(!?)
			// var transfers = config.transferBuffers? new Array(config.channels) : void(0);

			for(var i=0; i < config.channels; ++i){

				buffers[i] = evt.inputBuffer.getChannelData(i);

				// if(transfers){
				// 	transfers[i] = buffers[i].buffer;
				// }
			}

			worker.postMessage({
				cmd: 'encode',
				target: 'encoder',
				buffers: buffers
			});//, transfers);

		};

		// EOS events:
		// * 'speechstart', 'speechend',
		// * 'soundstart', 'soundend',
		// * 'detectionstart', 'detectionend',
		// * 'detectioninitialized', 'silent', 'overflow'
		// * not used/deprecated? 'detectionaudiostart'
		var listener = new EventEmitter(this, void(0), true);

		this.onspeechstart = null;
		this.onspeechend = null;
		this.onsoundstart = null;
		this.onsoundend = null;
		this.ondetectionstart = null;
		this.ondetectionend = null;
		this.ondetectioninitialized = null;
		// this.ondetectionaudiostart = null;//DISABLED depracted
		this.onsilent = null;
		this.onoverflow = null;

		// recorder events
		this.ondataavailable = null;
		this.onpause = null;
		this.onresume = null;
		this.onstart = null;
		this.onstop = null;
		this.onerror = null;

		this.state = 'inactive';// 'inactive' | 'recording' | 'paused'

		/**
		 * list of supported (target) MIME types for recording (depends on used encoder implementation)
		 *
		 * NOTE set/updated upon receiving initialized message from encoder module (worker)
		 *
		 * NOTE not all encoder implementations may support listing of supported types
		 *
		 * @type {Array<string> | false | undefined}
		 */
		this.supportedTypes = void(0);

		//TODO? support MediaRecorder.stream (would need to move the code for creating the audio source from webAudioInput to _init());
		// this.stream = null;

		this.node = null;
		this.processor = null;

		this._initWorker = function(){

			worker = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? __webpack_require__(config.workerPath || WORKER_PATH)() : new Worker(config.workerPath || WORKER_PATH);
			this.processor = worker;
			var selfRef = this;

			worker.onmessage = function(evt){

				var msg = evt.data;
				if(msg.source === 'detection'){

					var eventName = msg.message;
					if(eventName === 'detectioninitialized'){
						selfRef.canDetectSpeech = !!(msg.params && msg.params.canDetectSpeech);
					}
					listener.emit(eventName, {type: eventName, recorder: selfRef, data: msg.data});

				} else if(msg.source === 'encoder'){

					var eventName = msg.message === 'data'? 'dataavailable' : msg.message;
					if(eventName === 'initialized'){
						selfRef.supportedTypes = (msg.params && msg.params.supportedTypes) || false;
					}
					listener.emit(eventName, {type: eventName, recorder: selfRef, data: msg.data});

				} else {

					console.error('VoiceRecorder: received unknown message from worker', evt);
				}

			};
		};

		this._initSource = function(inputSource){

			var context = inputSource.context;

			//if we already had another input-source before, we need to clean up first:
			if(this.node){
				this.node.disconnect();
			}

			//browser backwards compatibility: use older createJavaScriptNode(), if new API function is not available
			var funcName = !context.createScriptProcessor? 'JavaScriptNode' : 'ScriptProcessor';
			var inputChannels = inputSource.channelCount || 2;//input channels
			var outputChannels = config.channels;//output channels
			this.node = context['create'+funcName](config.bufferSize, inputChannels, outputChannels);

			this.node.onaudioprocess = this._doRecordAudio;

			var initConfig = Object.assign({}, config, {
				bufferSize: this.node.bufferSize,           // report actual buffer-size that will be transfered
				sampleRate: inputSource.context.sampleRate, // report actual buffer-size that will be transfered
				channels: config.channels,                  // use requested channel count (e.g. source may provide/transfere 2, but recording/encoding may only require 1)
				// channels: this.node.channelCount            // DISABLED use requested channel count instead of actual channel count (see above)
			});

			worker.postMessage({
				cmd: 'init',
				target: 'encoder',
				params: initConfig
			});

			inputSource.connect(this.node);
			this.node.connect(context.destination);
		}

		this.start = function(){
			recording = true;
			this.state = 'recording';
			listener.emit('start', {recorder: this});
		};

		this.stop = function(){
			recording = false;
			this.state = 'inactive';
			listener.emit('stop', {recorder: this});
		};

		this.clear = function(){
			worker.postMessage({cmd: 'clear', target: 'encoder'});
		};

		/**
		 *
		 * @param  {DataOptions} [options] OPTIONAL options for the requested data
		 * @param  {DataOptions} [options.resultMode] OPTIONAL {"blob" | "merged" | "raw"}, (DEFAULT: "blob")
		 * @param  {DataOptions} [options.finish] OPTIONAL {Boolean}, if encoded data should be "finalized" (DEFAULT: false)
		 * @param  {DataOptions} [options.context] OPTIONAL {any}, custom context/data that will be included in the corresponding 'dataavailable' event (DEFAULT: undefined)
		 */
		this.requestData = function(options){
			worker.postMessage({
				cmd: 'requestData',
				target: 'encoder',
				params: options
			});
		};

		this.reset = function(source){
			// this.destroyed = false;
			this._initSource(source);
		};

		this.release = function(){

			this.stop();
			this.clear();

			if(this.node){
				this.node.disconnect();
				this.node = null;
			}

			// this.destroyed = true;
		};

		/**
		 * indicates whether the detection implementation can dicern between just NOISE and SPEECH
		 * (if FALSE, `onsoundstart`/`onsoundend` should be used instead of `onspeechstart`/`onspeechend`)
		 *
		 * NOTE set/updated upon receiving initialized message from detection module (worker)
		 * @type {Boolean | undefined}
		 */
		this.canDetectSpeech = void(0);

		this.resetDetection = function(cfg){
			worker.postMessage({cmd: 'config', target: 'detection', params: cfg});
		};

		this.startDetection = function(){
			worker.postMessage({cmd: 'start', target: 'detection'});
		};

		this.stopDetection = function(){
			worker.postMessage({cmd: 'stop', target: 'detection'});
		};

		//intialize worker:
		this._initWorker();
		//initialize recorder for source:
		this._initSource(source);
	};

	Recorder.forceDownload = function(blob, filename){
		var url = (window.URL || window.webkitURL).createObjectURL(blob);
		var link = window.document.createElement('a');
		link.href = url;
		link.download = filename || 'output.wav';

		//NOTE: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
		var click = document.createEvent("MouseEvent");
		click.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

		link.dispatchEvent(click);
	}

	return Recorder;
});
