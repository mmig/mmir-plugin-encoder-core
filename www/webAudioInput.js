/*
 * 	Copyright (C) 2012-2016 DFKI GmbH
 * 	Deutsches Forschungszentrum fuer Kuenstliche Intelligenz
 * 	German Research Center for Artificial Intelligence
 * 	http://www.dfki.de
 *
 * 	Permission is hereby granted, free of charge, to any person obtaining a
 * 	copy of this software and associated documentation files (the
 * 	"Software"), to deal in the Software without restriction, including
 * 	without limitation the rights to use, copy, modify, merge, publish,
 * 	distribute, sublicense, and/or sell copies of the Software, and to
 * 	permit persons to whom the Software is furnished to do so, subject to
 * 	the following conditions:
 *
 * 	The above copyright notice and this permission notice shall be included
 * 	in all copies or substantial portions of the Software.
 *
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * 	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * 	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * 	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * 	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * 	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * 	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


define(
	['mmirf/mediaManager', 'mmirf/configurationManager', 'mmirf/constants', 'mmirf/logger', 'module'],//, 'mmirf/languageManager'],
	function(
		mediaManager, config, consts, Logger, mod//, lang
){

return {
	/**  @memberOf Html5AudioInput# */
	initialize: function(callBack, __mediaManager, ctxId, moduleConfig){

		/**  @memberOf Html5AudioInput# */
		var _basePluginName = 'webAudioInput';

		/**
		 * Default implementation for WebAudioInput: Google Recognition Web Service v1
		 * @memberOf Html5AudioInput#
		 */
		var _defaultImplFile = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? 'mmir-plugin-asr-google-xhr.js' : 'webasrGoogleImpl.js';

		/**
		 * Map for codec names to implementation files
		 *
		 * Note, that codec names are in lower case.
		 *
		 * @memberOf Html5AudioInput#
		 */
		if(typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD){
			var _workerImpl = {
				'amr':  'mmir-plugin-encoder-amr',
				'flac': 'mmir-plugin-encoder-flac',
				'wav':  'mmir-plugin-encoder-core/workers/recorderWorkerExt'
			};
		} else {
			var _workerImpl = {
				'amr':  'amrEncoder.js',
				'flac': 'flacEncoder.js',
				'wav':  'recorderWorkerExt.js'
			};
		}

		/**
		 * Map for the worker-filenames of the various audio-input implementations:
		 *
		 * If there is no (application-) specific configuration present, then the entry
		 * from this map will be used for loading the audio-input worker for the specific
		 * implementation.
		 *
		 * @memberOf Html5AudioInput#
		 */
		var _defaultWorkerImpl = {
			'webasrgoogleimpl.js':   _workerImpl.flac,
			'webasrnuanceimpl.js':   _workerImpl.amr,

			'mmir-plugin-asr-google-xhr.js':   _workerImpl.flac,
			'mmir-plugin-asr-nuance-xhr.js':   _workerImpl.amr,

			'_default':              _workerImpl.wav,

			/** @deprecated */
			'webasratntimpl.js':     _workerImpl.amr,
			/** @deprecated */
			'webasrgooglev1impl.js': _workerImpl.wav
		};

		/**
		 * Result types for recognition / text callbacks
		 *
		 * @type Enum
		 * @constant
		 * @memberOf Html5AudioInput#
		 */
		var RESULT_TYPES = {
			"FINAL": 				"FINAL",
			"INTERIM": 				"INTERIM",
			"INTERMEDIATE":			"INTERMEDIATE",
			"RECOGNITION_ERROR": 	"RECOGNITION_ERROR",
			"RECORDING_BEGIN": 		"RECORDING_BEGIN",
			"RECORDING_DONE": 		"RECORDING_DONE"
		};

		/**
		 * When specifying the implementation file for an Audio Module Context
		 *
		 * i.e.
		 * 	{"mod": "webAudioTextToSpeech.js", "ctx": CONTEXT}
		 *
		 * then plugin configuration will be check, if there is an entry for the ctx,
		 * i.e. an implementation file name for entry ctx:
		 *  "webAudioTextToSpeech": { CONTEXT: IMPLEMENTATION_FILE_ENTRY },
		 *
		 * Otherwise the plugin configuration's default entry will be used
		 *  "webAudioTextToSpeech": { CONTEXT: _defaultCtxName },
		 *
		 * If no default entry exists, then {@link #_defaultImplFile} will be used as
		 * implementation.
		 *
		 * @defaultValue "default"
		 * @memberOf Html5AudioInput#
		 */
		var _defaultCtxName = 'default';

		/**
		 * STREAM_STARTED: Name for the event that is emitted, when
		 *                 the audio input stream for analysis becomes available.
		 *
		 * @private
		 * @constant
		 * @memberOf Html5AudioInput#
		 */
		var STREAM_STARTED_EVT_NAME = 'webaudioinputstarted';

		/**
		 * Will be set when specific implementation is initialized.
		 *
		 * @type mmir.Logger
		 * @protected
		 * @memberOf Html5AudioInput#
		 */
		var _logger;

		/**
		 *
		 * @type RecorderExt#constructor
		 * @protected
		 * @memberOf Html5AudioInput#
		 */
		var Recorder;

		/**  @memberOf Html5AudioInput# */
		var audioProcessor = {
			/**
    		 * Initializes the connection/send-function.
    		 *
    		 * MUST be set/"overwritten" by specific implementation.
			 *
			 * @param {Function} stopUserMediaFunc
			 * 			the function that will stop the user-media ("close microphone")
			 *
			 * @protected
    		 * @memberOf Html5AudioInput.AudioProcessor#
    		 */
	      	_init: function(stopUserMediaFunc){

	      		//NOTE _init may get called before audioProcessor impl. is loaded
	      		//     -> cache these invocation and apply them later, when audioProcessor is loaded
	      		if(!this._cached){
	      			this._cached = [];
	      		}

	      		this._cached.push(arguments);
	      	},
			/**
			 * Hook that initializes the audio processor's callback functions and settings.
			 *
			 * This function is called, before opening the microphone,
			 * starting the recognition process etc.
			 *
			 *
			 * MUST be set/"overwritten" by specific implementation.
			 *
			 *
			 * @param {Function} successCallback
			 * 			callback will be called by the sendData-implementation
			 * 			when sending was successful.
    		 * 				<pre>
    		 * 				successCallback(
    		 * 					text: String | "",
    		 * 					confidence: Number | Void,
    		 * 					status: "FINAL"|"INTERIM"|"INTERMEDIATE",
    		 * 					alternatives: Array<{result: String, score: Number}> | Void,
    		 * 					unstable: String | Void
    		 * 				)
    		 * 				</pre>
			 *
			 * @param {Function} failureCallback
			 * 			callback will be called by the sendData-implementation
			 * 			if an error occurred:
			 * 				<pre>
			 * 					failureCallback(error)
			 * 				</pre>
			 *
			 * @param {Function} stopUserMediaFunc
			 * 			the function that will stop the user-media ("close microphone")
			 *
			 * @param {PlainObject} options
			 * 			options for Automatic Speech Recognition:
			 * 			<pre>{
			 * 				  success: OPTIONAL Function, the status-callback (see arg successCallback)
			 * 				, error: OPTIONAL Function, the error callback (see arg failureCallback)
			 * 				, language: OPTIONAL String, the language for recognition (if omitted, the current language setting is used)
			 * 				, intermediate: OTPIONAL Boolean, set true for receiving intermediate results (NOTE not all ASR engines may support intermediate results)
			 * 				, results: OTPIONAL Number, set how many recognition alternatives should be returned at most (NOTE not all ASR engines may support this option)
			 * 				, mode: OTPIONAL "search" | "dictation", set how many recognition alternatives should be returned at most (NOTE not all ASR engines may support this option)
			 * 				, eosPause: OTPIONAL "short" | "long", length of pause after speech for end-of-speech detection (NOTE not all ASR engines may support this option)
			 * 				, disableImprovedFeedback: OTPIONAL Boolean, disable improved feedback when using intermediate results (NOTE not all ASR engines may support this option)
			 * 			}</pre>
			 *
			 */
			setCallbacks: function(successCallback, failureCallback, stopUserMediaFunc, options){},
    		/**
    		 * Initializes/prepares the next recognition session.
    		 *
    		 * MUST be set/"overwritten" by specific implementation.
			 *
			 * @protected
    		 * @memberOf Html5AudioInput.AudioProcessor#
    		 */
      		initRec: function(){},
      		/**
      		 * Hook that is called, when audio data was encoded.
      		 *
      		 * Implementation should send the data to the recognition-service,
      		 * and call <code>successCallback</code> with the recognition results.
      		 *
			 * MUST be set/"overwritten" by specific implementation.
			 *
			 * @param {any} audioData
			 * 			the (binary) audio data (e.g. PCM, FLAC, ...)
			 *
			 * @param {Function} successCallback
			 * 			callback will be called by the sendData-implementation
			 * 			when sending was successful.
    		 * 				<pre>
    		 * 				successCallback(
    		 * 					text: String | "",
    		 * 					confidence: Number | Void,
    		 * 					status: "FINAL"|"INTERIM"|"INTERMEDIATE",
    		 * 					alternatives: Array<{result: String, score: Number}> | Void,
    		 * 					unstable: String | Void
    		 * 				)
    		 * 				</pre>
			 *
			 * @param {Function} failureCallback
			 * 			callback will be called by the sendData-implementation
			 * 			if an error occurred:
			 * 				<pre>
			 * 					failureCallback(error)
			 * 				</pre>
			 *
			 * @memberOf Html5AudioInput.AudioProcessor#
			 *
			 * @see mmir.MediaManager#recognize
			 * @see mmir.MediaManager#startRecord
			 */
    		sendData: function(audioData, successCallback, failureCallback){},
    		/**
    		 * CAN be set/"overwritten" by specific implementation:
    		 * callback that is invoked when silence detection was <code>initialized</code>.
    		 *
    		 * @param {PlainObject} message
    		 * 			the message from the silence detection
    		 * @param {Function} successCallback
    		 * 			the success callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 * @param {Function} failureCallback
    		 * 			the error callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 *
    		 * @returns {any} if the returned values is not <code>undefined</code>
    		 * 					and FALSY, the message from the silence detection
    		 * 					will NOT be propagated to the encoder/recognizer.
    		 */
			oninit: function(message, successCallback, failureCallback){},
			/**
    		 * CAN be set/"overwritten" by specific implementation:
    		 * callback that is invoked when silence detection was <code>started</code>.
    		 *
    		 * @param {PlainObject} message
    		 * 			the message from the silence detection
    		 * @param {Function} successCallback
    		 * 			the success callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 * @param {Function} failureCallback
    		 * 			the error callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 *
    		 * @returns {any} if the returned values is not <code>undefined</code>
    		 * 					and FALSY, the message from the silence detection
    		 * 					will NOT be propagated to the encoder/recognizer.
    		 */
			onstarted: function(){},
			/**
    		 * CAN be set/"overwritten" by specific implementation:
    		 * callback that is invoked when silence detection was <code>stopped</code>.
    		 *
    		 * @param {PlainObject} message
    		 * 			the message from the silence detection
    		 * @param {Function} successCallback
    		 * 			the success callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 * @param {Function} failureCallback
    		 * 			the error callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 *
    		 * @returns {any} if the returned values is not <code>undefined</code>
    		 * 					and FALSY, the message from the silence detection
    		 * 					will NOT be propagated to the encoder/recognizer.
    		 */
			onstopped: function(){},
			/**
    		 * CAN be set/"overwritten" by specific implementation:
    		 * callback that is invoked when silence detection signaled <code>send partial result</code>,
    		 * i.e. that there is still some speech/noise, but the size limit (for sending audio
    		 * data to the recognition service within one request ) is reached, so the audio
    		 * data should be sent now.
    		 *
    		 * TODO remove
    		 * @deprecated
    		 *
    		 * @param {PlainObject} message
    		 * 			the message from the silence detection
    		 * @param {Function} successCallback
    		 * 			the success callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 * @param {Function} failureCallback
    		 * 			the error callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 *
    		 * @returns {any} if the returned values is not <code>undefined</code>
    		 * 					and FALSY, the message from the silence detection
    		 * 					will NOT be propagated to the encoder/recognizer.
    		 */
			onsendpart: function(){},
			/**
    		 * CAN be set/"overwritten" by specific implementation:
    		 * callback that is invoked when silence detection signaled <code>silence detected</code>,
    		 * i.e. that there was some speech/noise, and now it is silent again ("end of noise detected").
    		 *
    		 * @param {PlainObject} message
    		 * 			the message from the silence detection
    		 * @param {Function} successCallback
    		 * 			the success callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 * @param {Function} failureCallback
    		 * 			the error callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 *
    		 * @returns {any} if the returned values is not <code>undefined</code>
    		 * 					and FALSY, the message from the silence detection
    		 * 					will NOT be propagated to the encoder/recognizer.
    		 */
			onsilencedetected: function(){},
			/**
    		 * CAN be set/"overwritten" by specific implementation:
    		 * callback that is invoked when silence detection signaled <code>clear data</code>,
    		 * i.e. that the audio was silent since the last message, thus the audio data
    		 * can be dropped (i.e. not sent to the recognition service).
    		 *
    		 * @param {PlainObject} message
    		 * 			the message from the silence detection
    		 * @param {Function} successCallback
    		 * 			the success callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 * @param {Function} failureCallback
    		 * 			the error callback for the recognition
    		 * 			(<code>recognize()</code> or <code>startRecord()</code>)
    		 *
    		 * @returns {any} if the returned values is not <code>undefined</code>
    		 * 					and FALSY, the message from the silence detection
    		 * 					will NOT be propagated to the encoder/recognizer.
    		 */
			onclear: function(){}
		};

		/** @memberOf Html5AudioInput# */
		var nonFunctional = false;

		/**
		 * The name of the plugin (w.r.t. the specific implementation).
		 *
		 * Will be set/"overwritten" by specific implementation.
		 *
		 * @protected
		 * @memberOf Html5AudioInput#
		 */
		var _pluginName;

		/**
		 * The name of the implementation file (converted to lower case).
		 *
		 * Will be set when specific implementation is loaded.
		 *
		 * @protected
		 * @memberOf Html5AudioInput#
		 */
		var _implFileName;

		/**  @memberOf Html5AudioInput# */
		var initImpl = function(impl){

			_pluginName = impl.getPluginName();

			var modConf = mod.config(mod);
			_logger = Logger.create(_pluginName, modConf? modConf.logLevel : void(0));

			var initCalls = audioProcessor._cached;
			audioProcessor = impl;

			//if there were init-calls before impl was loaded, apply them now:
			if(initCalls){

				for(var i=0,size=initCalls.length; i < size; ++i){
					audioProcessor._init.apply(audioProcessor, initCalls[i]);
				}
			}

		};

		/** @memberOf Html5AudioInput# */
		function htmlAudioConstructor(){

			/**
			 * status-flag for indicating, if recording is in progress
			 * @memberOf Html5AudioInput#
			 */
			var recording = false;

			/** @memberOf Html5AudioInput# */
			var isUseIntermediateResults = false;
			/**
			 * @type AudioContext
			 * @memberOf Html5AudioInput#
			 */
			var audio_context=null;
			/**
			 * @type LocalMediaStream
			 * @memberOf Html5AudioInput#
			 */
			var stream = null;
			/**
			 * @type RecorderExt
			 * @memberOf Html5AudioInput#
			 */
    		var recorder=null;
    		/** @memberOf Html5AudioInput# */
    		var totalText = '';
    		/**
    		 * the function that is called on the recognized text that came back from the server
    		 * @memberOf Html5AudioInput#
    		 */
    		var textProcessor = function(text, confidence, status, alternatives, unstable){};
    		/**
    		 * @type WebWorker
    		 * @memberOf Html5AudioInput#
    		 */
    		var silenceDetection = null;

    		/** @memberOf Html5AudioInput# */
    		var endOfSpeechDetection = false;
    		/**
    		 * @type Function
    		 * @memberOf Html5AudioInput#
    		 */
    		var currentFailureCallback = null;

      		/**  @memberOf Html5AudioInput# */
      		function createAudioScriptProcessor(audioContext, bufferSize, numberOfInputChannels, numberOfOutputChannels){
      		    	if(audioContext.context.createJavaScriptNode){
      		    		return audioContext.context.createJavaScriptNode(bufferSize, numberOfInputChannels, numberOfOutputChannels);
      		    	}
      		    	else if(audioContext.context.createScriptProcessor){
      		    		return audioContext.context.createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels);
      		    	}
      		    	else {
      		    		throw Error('Could not create script-processor for AudioContext: context provides no function for generating processor!');
      		    	}

      		}

    		/**
    		 * creates Silence detector and recorder and connects them to the input stream
    		 * @param {LocalMediaStream} inputstream
    		 * @param {Function} [callback] OPTIONAL
    		 * @memberOf Html5AudioInput#
    		 */
    		function onStartUserMedia(inputstream, callback){
    			var buffer = 0;
    			stream = inputstream;
    			var input = audio_context.createMediaStreamSource(stream);

    			if(mediaManager.micLevelsAnalysis.enabled()){
                	mediaManager.micLevelsAnalysis.start({inputSource: input, audioContext: audio_context});
                }

    			if(!recorder){
    				var workerImpl = config.get([_pluginName, 'encoder']);
    				if(!workerImpl){
    					//try to find worker implementation by (known) plugin names (fallback to default, if not known)
    					workerImpl = _defaultWorkerImpl[_implFileName] || _defaultWorkerImpl._default;
    				} else {
    					//resolve (known) codec names to files, if necessary
    					if(/amr/i.test(workerImpl)){
    						workerImpl = _workerImpl.amr;
    					} else if(/flac/i.test(workerImpl)){
    						workerImpl = _workerImpl.flac;
    					} else if(/wav/i.test(workerImpl)){
    						workerImpl = _workerImpl.wav;
    					}
    				}

    				var recorderWorkerPath = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? workerImpl : consts.getWorkerPath()+workerImpl;
    				recorder = new Recorder(input, {workerPath: recorderWorkerPath, debug: _logger.isDebug()});
    			} else {
    				recorder.init(input);
    			}

    			//notify listeners that a new web audio input stream was started
    			mediaManager._fireEvent(STREAM_STARTED_EVT_NAME, [input, audio_context, recorder]);

    			silenceDetection = recorder.processor;

    			/**
    			 * callback when audio-encoding has finished
    			 *
    			 * @function
    			 * @param {Event} event
    			 * 			with property {data: buf BLOB}
    			 *
    			 * @memberOf Html5AudioInput.recorder#
    			 */
    			recorder.onencodefinished = function(event){
    		    	  audioProcessor.sendData(event.data, textProcessor, currentFailureCallback);
    			};

    			/**
    			 * @function
    			 * @memberOf Html5AudioInput.recorder#
    			 */
    			recorder.beforeonmessage = function (e){

    				if(mediaManager._log.isDebug()) mediaManager._log.log(e.data);

    				//attach current recorder
    				e.recorder = recorder;

    				var isContinuePropagation;
    				if (e.data === 'Send partial!'){

    					if(audioProcessor.onsendpart){
    						isContinuePropagation = audioProcessor.onsendpart(e, textProcessor, currentFailureCallback);
    					}
    				}
    				else if (e.data === 'Silence detected!'){

    					if(audioProcessor.onsilencedetected){
    						isContinuePropagation = audioProcessor.onsilencedetected(e, textProcessor, currentFailureCallback);
    					}

    					if (endOfSpeechDetection){

    						stopUserMedia();
    					}
    				}
    				else if (e.data === 'clear'){

    					if(audioProcessor.onclear){
    						isContinuePropagation = audioProcessor.onclear(e, textProcessor, currentFailureCallback);
    					}
    				}
    				else if(e.data === 'Silence Detection initialized'){

    					if(audioProcessor.oninit){
    						isContinuePropagation = audioProcessor.oninit(e, textProcessor, currentFailureCallback);
    					}

    				}
    				else if(e.data === 'Silence Detection started'){

    					if(audioProcessor.onstarted){
    						isContinuePropagation = audioProcessor.onstarted(e, textProcessor, currentFailureCallback);
    					}

    				}
    				else if(e.data === 'Silence Detection Audio started'){

    					if(audioProcessor.onaudiostarted){
    						isContinuePropagation = audioProcessor.onaudiostarted(e, textProcessor, currentFailureCallback);
    					}

    				}
    				else if(e.data === 'Silence Detection stopped'){

    					if(audioProcessor.onstopped){
    						isContinuePropagation = audioProcessor.onstopped(e, textProcessor, currentFailureCallback);
    					}

    				} else {

    					mediaManager._log.error('Unknown message: '+e.data);
    				}


    				if(typeof isContinuePropagation !== 'undefined' && !isContinuePropagation){
    					return false;
    				}
    			};

    			/** @memberOf Html5AudioInput.recorder# */
    			var silenceDetectionConfig = {
					sampleRate: input.context.sampleRate,
					noiseTreshold : config.get(["silenceDetector", "noiseTreshold"]),
					pauseCount : config.get(["silenceDetector", "pauseCount"]),
					resetCount : config.get(["silenceDetector", "resetCount"])
				};

    			//initialize silence-detection:
    			silenceDetection.postMessage({
    				cmd: 'initDetection',
    				config: silenceDetectionConfig
    			});

    			callback && callback();

    		}//END: onStartUserMedia

    		try {
		        // unify the different kinds of HTML5 implementations
    			navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    			//window.AudioContext = window.AudioContext || window.webkitAudioContext;
//		    	audio_context = new AudioContext;

    			if(typeof AudioContext !== 'undefined'){
    				audio_context = new AudioContext;
    			}
    			else {//if(typeof webkitAudioContext !== 'undefined'){
    				audio_context = new webkitAudioContext;
    			}
    		}
    		catch (e) {
    			_logger.error('No web audio support in this browser! Error: '+(e.stack? e.stack : e));
    			nonFunctional = true;
 				 if (currentFailureCallback)
  					 currentFailureCallback(e);
    		}

    		if( nonFunctional !== true ) try {
    			audioProcessor._init(stopUserMedia);
    		} catch (e) {
    			_logger.error('Could not reach the voice recognition server!');
    			nonFunctional = true;
 				if(currentFailureCallback)
  					 currentFailureCallback(e);
    		}

    		if (nonFunctional) {
    			return {};///////////////////////////// EARLY EXIT //////////////////////////////
    		}

    		/**
    		 * get audioInputStream, i.e. open microphone
    		 *
    		 * NOTE user might reject access to microphone
    		 *
    		 * @param {Function} callback
    		 * @memberOf Html5AudioInput#
    		 */
    		var startUserMedia = function(callback){

    			var onStarted = callback? function(stream){ onStartUserMedia.call(this, stream, callback); } : onStartUserMedia;

    			navigator.getUserMedia({audio: true}, onStarted, function onError(e) {
						_logger.error('Could not access microphone: '+e);
						if (currentFailureCallback)
		  					 currentFailureCallback(e);
					}
    			);

    		};

    		/**
    		 * close audioInputStream, i.e. turn microphone off
    		 *
    		 * @param {Boolean} [isStopSilenceDetection] OPTIONAL
    		 * 			if false: do not stop silence detection,
    		 * 			if omitted or any other value than false: stop silence detection
    		 *
    		 * @memberOf Html5AudioInput#
    		 */
    		var stopUserMedia = function(isStopSilenceDetection){

    			//set recording state to FALSE
    			recording=mediaManager.micLevelsAnalysis.active(false);

    			//stop analyzing input
    			mediaManager.micLevelsAnalysis.stop();

    			//release any references etc. the recorder may hold
    			if(recorder){
    				recorder.release();
    			};

    			if(stream){

    				var thestream = stream;
					stream = void(0);
					//DISABLED: MediaStream.stop() is deprecated -> instead: stop all tracks individually
//					stream.stop();
					try{
						if(thestream.active){
							var list = thestream.getTracks(), track;
							for(var i=list.length-1; i >= 0; --i){
								track = list[i];
								if(track.readyState !== 'ended'){
									track.stop();
								}
							}
						}
					} catch (err){
						_logger.log('webAudioInput: a problem occured while stopping audio input analysis: '+err);
					}
    			}

    			if(silenceDetection && isStopSilenceDetection !== false){
    				silenceDetection.postMessage({cmd: 'stop'});
    			}

    		};

    		//invoke the passed-in initializer-callback and export the public functions:
    		return {
    			/**
				 * Start speech recognition (without <em>end-of-speech</em> detection):
				 * after starting, the recognition continues until {@link #stopRecord} is called.
				 *
				 * @async
				 *
				 * @param {PlainObject} [options] OPTIONAL
				 * 		options for Automatic Speech Recognition:
				 * 		<pre>{
				 * 			  success: OPTIONAL Function, the status-callback (see arg statusCallback)
				 * 			, error: OPTIONAL Function, the error callback (see arg failureCallback)
				 * 			, language: OPTIONAL String, the language for recognition (if omitted, the current language setting is used)
				 * 			, intermediate: OTPIONAL Boolean, set true for receiving intermediate results (NOTE not all ASR engines may support intermediate results)
				 * 			, results: OTPIONAL Number, set how many recognition alternatives should be returned at most (NOTE not all ASR engines may support this option)
				 * 			, mode: OTPIONAL "search" | "dictation", set how many recognition alternatives should be returned at most (NOTE not all ASR engines may support this option)
				 * 			, eosPause: OTPIONAL "short" | "long", length of pause after speech for end-of-speech detection (NOTE not all ASR engines may support this option)
				 * 			, disableImprovedFeedback: OTPIONAL Boolean, disable improved feedback when using intermediate results (NOTE not all ASR engines may support this option)
				 * 		}</pre>
				 *
				 * @param {Function} [statusCallback] OPTIONAL
				 * 			callback function that is triggered when, recognition starts, text results become available, and recognition ends.
				 * 			The callback signature is:
				 * 				<pre>
				 * 				callback(
				 * 					text: String | "",
				 * 					confidence: Number | Void,
				 * 					status: "FINAL"|"INTERIM"|"INTERMEDIATE"|"RECORDING_BEGIN"|"RECORDING_DONE",
				 * 					alternatives: Array<{result: String, score: Number}> | Void,
				 * 					unstable: String | Void
				 * 				)
				 * 				</pre>
				 *
				 * 			Usually, for status <code>"FINAL" | "INTERIM" | "INTERMEDIATE"</code> text results are returned, where
				 * 			<pre>
				 * 			  "INTERIM": an interim result, that might still change
				 * 			  "INTERMEDIATE": a stable, intermediate result
				 * 			  "FINAL": a (stable) final result, before the recognition stops
				 * 			</pre>
				 * 			If present, the <code>unstable</code> argument provides a preview for the currently processed / recognized text.
				 *
				 * 			<br>NOTE that when using <code>intermediate</code> mode, status-calls with <code>"INTERMEDIATE"</code> may
				 * 			     contain "final intermediate" results, too.
				 *
				 * 			<br>NOTE: if used in combination with <code>options.success</code>, this argument will supersede the options
				 *
				 * @param {Function} [failureCallback] OPTIONAL
				 * 			callback function that is triggered when an error occurred.
				 * 			The callback signature is:
				 * 				<code>callback(error)</code>
				 *
				 * 			<br>NOTE: if used in combination with <code>options.error</code>, this argument will supersede the options
				 *
				 * @public
				 * @memberOf Html5AudioInput.prototype
				 * @see mmir.MediaManager#startRecord
				 */
    			startRecord: function(options, statusCallback, failureCallback, intermediateResults){//argument intermediateResults is deprecated (use options.intermediate instead)

    				if(typeof options === 'function'){
						intermediateResults = failureCallback;
						failureCallback = statusCallback;
						statusCallback = options;
						options = void(0);
					}

					if(!options){
						options = {};
					}
					options.success = statusCallback? statusCallback : options.success;
					options.error = failureCallback? failureCallback : options.error;
					options.intermediate = typeof intermediateResults === 'boolean'? intermediateResults : !!options.intermediate;
					//TODO
//					options.language = options.language? options.language : lang.getLanguageConfig(_pluginName) || DEFAULT_LANGUAGE;
//					options.results = options.results? options.results : DEFAULT_ALTERNATIVE_RESULTS;
//					options.disableImprovedFeedback =
//					options.mode =
//					options.eosPause =


    				if(options.intermediate){
        				textProcessor = statusCallback;
    				} else {
    					/**
    					 * @param text
    					 * @param confidence
    					 * @param status
    					 * @param alternatives
    					 *
    					 * @memberOf media.plugin.html5AudioInput.prototype
    					 */
    					textProcessor = function(text, confidence, status, alternatives, unstable){

    						//ignore non-recognition invocations
    						if(status !== RESULT_TYPES.INTERMEDIATE && status !== RESULT_TYPES.INTERIM && status !== RESULT_TYPES.FINAL){
    							return;
    						}

    						if(totalText){
        						totalText = totalText + ' ' + text;
    						} else {
        						totalText = text;
    						}
    					};
    				}

    				currentFailureCallback = options.error;

					isUseIntermediateResults = options.intermediate;
    				endOfSpeechDetection = false;

    				audioProcessor.setCallbacks(textProcessor, currentFailureCallback, stopUserMedia, options);

    				startUserMedia(function onRecStart(){
    					audioProcessor.initRec && audioProcessor.initRec();
    					recorder && recorder.clear();
							audio_context && audio_context.resume();
        				recorder && recorder.record();
        				silenceDetection && silenceDetection.postMessage({cmd: 'start'});
    				});

					totalText = '';
    				audioProcessor.resetLastResult && audioProcessor.resetLastResult();

    				recording = mediaManager.micLevelsAnalysis.active(true);
    			},
    			/**
				 * @public
				 * @memberOf Html5AudioInput.prototype
				 * @see mmir.MediaManager#stopRecord
				 */
    			stopRecord: function(options, statusCallback, failureCallback){

    				if(typeof options === 'function'){
						failureCallback = statusCallback;
						statusCallback = options;
						options = void(0);
					}

					if(options){
						statusCallback = statusCallback? statusCallback : options.success;
						failureCallback = failureCallback? failureCallback : options.error;
					}

    				currentFailureCallback = failureCallback;
    				textProcessor = void(0);//will be set within setTimeout() below

    				setTimeout(function(){
    					stopUserMedia(false);
        				if (statusCallback){
        					/**
        					 * @param text
        					 * @param confidence
        					 * @param status
        					 * @param alternatives
        					 *
        					 * @memberOf media.plugin.html5AudioInput.prototype
        					 */
        					textProcessor = function(text, confidence, status, alternatives, unstable){

        						//ignore non-recognition invocations
        						if(status !== RESULT_TYPES.INTERMEDIATE && status !== RESULT_TYPES.INTERIM && status !== RESULT_TYPES.FINAL){
        							return;
        						}

        						if(audioProcessor.isLastResult()) {

        							if(totalText){
                						totalText = totalText + ' ' + text;
            						} else {
                						totalText = text;
            						}
        							//NOTE: omit alternatives, since this is the cumulative result, and the alternatives
        							//      are only for the last part
        							statusCallback(totalText, confidence, RESULT_TYPES.FINAL);
        						}
        						audioProcessor.resetLastResult && audioProcessor.resetLastResult();
        					};
        				}
        				audioProcessor.setCallbacks(textProcessor, currentFailureCallback, stopUserMedia, {});

        				audioProcessor.setLastResult && audioProcessor.setLastResult();

        				silenceDetection && silenceDetection.postMessage({cmd: 'stop'});

    				}, 100);

    			},
    			/**
    			 * Start speech recognition with <em>end-of-speech</em> detection:
				 *
				 * the recognizer automatically tries to detect when speech has finished and
				 * triggers the status-callback accordingly with results.
				 *
				 * @public
				 * @memberOf Html5AudioInput.prototype
				 * @see mmir.MediaManager#recognize
				 * @see #startRecord
				 */
    			recognize: function(options, statusCallback, failureCallback){

    				if(typeof options === 'function'){
						intermediateResults = failureCallback;
						failureCallback = statusCallback;
						statusCallback = options;
						options = void(0);
					}

					if(!options){
						options = {};
					}
					options.success = statusCallback? statusCallback : options.success;
					options.error = failureCallback? failureCallback : options.error;
					options.intermediate = typeof intermediateResults === 'boolean'? intermediateResults : !!options.intermediate;
					//TODO
//					options.language = options.language? options.language : lang.getLanguageConfig(_pluginName) || DEFAULT_LANGUAGE;
//					options.results = options.results? options.results : DEFAULT_ALTERNATIVE_RESULTS;
//					options.disableImprovedFeedback =
//					options.mode =
//					options.eosPause =

    				textProcessor = options.success
    				currentFailureCallback = options.error;

    				endOfSpeechDetection = true;

    				audioProcessor.setCallbacks(textProcessor, currentFailureCallback, stopUserMedia, options);

    				startUserMedia(function(){
    					audioProcessor.initRec && audioProcessor.initRec();
    					recorder && recorder.clear();
							audio_context && audio_context.resume();
        				recorder && recorder.record();
        				silenceDetection && silenceDetection.postMessage({cmd: 'start'});

        				//TODO find better mechanism (or name?): this may not be the last blob (there may be silent audio)
        				//							             ... but it will be the last (successfully recognized) result!
        				audioProcessor.setLastResult && audioProcessor.setLastResult();
    				});

    				totalText='';
    				audioProcessor.resetLastResult && audioProcessor.resetLastResult();

    				recording=mediaManager.micLevelsAnalysis.active(true);

    			},
    			/**
				 * @public
				 * @memberOf Html5AudioInput.prototype
				 * @see mmir.MediaManager#cancelRecognition
				 */
    			cancelRecognition: function(successCallback, failureCallback){

    				currentFailureCallback = failureCallback;

    				stopUserMedia(false);

    				audioProcessor.setLastResult && audioProcessor.setLastResult();

    				silenceDetection && silenceDetection.postMessage({cmd: 'stop'});
    				if (successCallback){
    					successCallback();
    				}
    			}
    		};//END: return

		};//END: htmlAudioConstructor()

		var implFile, configPath = [_basePluginName, ctxId];

		if(moduleConfig){

			//if there config setting -> use as implementation-filename:
			implFile = moduleConfig;

		} else if(ctxId){
			//if plugin was loaded into a specific context, check, if there is a configuration value for this context)
			implFile = config.get(configPath);
		}

		if(!implFile){
			//use default configuration path
			configPath[1] = _defaultCtxName;
			implFile = config.get(configPath);
		}

		if(!implFile){

			//if no configuration: use default impl.
			implFile = _defaultImplFile;

		} else if(!/\.js$/.test(implFile)){

			implFile += '.js';
		}

		_implFileName = implFile.toLowerCase();

		var processLoaded = function(newWebAudioAsrImpl, recorderClass){

			Recorder = recorderClass;

			var instance = htmlAudioConstructor();

			//initialize implementation:
			initImpl(newWebAudioAsrImpl);

			//invoke the passed-in initializer-callback and export the public functions:
			callBack(instance);
		};

		var handleError = function(err){
			console.error('ERROR: failed to initialize webAudioInnput with module "'+implFile+'": '+err, err);
			//invoke callback without exporting functions:
			callBack({});
		};

		//load the necessary scripts and then call htmlAudioConstructor

		if(typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD){
			try{
				mediaManager.loadFile('webMicLevels.js');
				processLoaded(__webpack_require__(implFile.replace(/\.js$/i, '')), require('./recorderExt.js'));
			} catch(err){
				handleError(err);
			}
		} else {
			require([implFile, './recorderExt.js', 'mmirf/webMicLevels'], processLoaded, handleError);
		}

	}//END: initialize()

};

});//END define
