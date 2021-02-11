
define(
['mmirf/mediaManager', 'mmirf/configurationManager', 'mmirf/resources', 'mmirf/logger', 'require', './voiceRecorder.js'],
function(
		mediaManager, config, consts, Logger, require, Recorder
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
			var _defaultImplFile = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? 'mmir-plugin-asr-google-xhr.js' : 'asrGoogleXhr.js';

			/**
			 * Map for codec names to implementation files
			 *
			 * Note, that codec names are in lower case.
			 *
			 * @memberOf Html5AudioInput#
			 */
			var _workerImpl;
			if(typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD){
				_workerImpl = {
						'amr':  'mmir-plugin-encoder-amr',
						'flac': 'mmir-plugin-encoder-flac',
						'opus': 'mmir-plugin-encoder-opus',
						'speex': 'mmir-plugin-encoder-speex',
						'wav':  'mmir-plugin-encoder-core/workers/recorderWorkerExt'
				};
			} else {
				_workerImpl = {
						'amr':  'amrEncoder.js',
						'flac': 'flacEncoder.js',
						'opus': 'opusEncoder.js',
						'speex': 'speexEncoder.js',
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
					'asrgooglexhr.js':   _workerImpl.flac,

					'mmir-plugin-asr-cerence-ws.js':   _workerImpl.opus,
					'mmir-plugin-asr-google-xhr.js':   _workerImpl.flac,

					'_default':              _workerImpl.wav,

					/** @deprecated */
					'asrnuancews.js':   _workerImpl.speex,
					/** @deprecated */
					'asrnuancexhr.js':   _workerImpl.amr,
					/** @deprecated */
					'webasratntimpl.js':     _workerImpl.amr,
					/** @deprecated */
					'webasrgooglev1impl.js': _workerImpl.wav,
					/** @deprecated */
					'mmir-plugin-asr-nuance-ws.js':   _workerImpl.speex,
					/** @deprecated */
					'mmir-plugin-asr-nuance-xhr.js':   _workerImpl.amr,
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
			 * HELPER for firing an event via MediaManager:
			 * use appropirate method on MediaManager depending on MediaManager version.
			 *
			 * @function _doEmitEvent
			 * @param  {String} eventName the name/type of the event to be fired
			 * @param  {...any} [args] OPTIONAL
			 * 												the event data arguments
			 * @private
			 * @memberOf Html5AudioInput#
			 */
			var _doEmitEvent = mediaManager._emitEvent? function(_eventName, _args) {
					mediaManager._emitEvent.apply(mediaManager, arguments)
				} : function(eventName, _args) {
					var size = arguments.length;
					var argList = new Array(size - 1);
					for(var i = 1; i < size; ++i){
						argList[i - 1] = arguments[i];
					}
					mediaManager._fireEvent(eventName, argList);
			};

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
			var _logger = mediaManager._log;// will be replaced with own instance after loading the sub-module (see initImpl())

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
					_init: function(_stopUserMediaFunc){

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
					onclear: function(){},

					/**
					 * OPTIONAL hook:
					 * notifies the audioProcessor plugin that the next ASR result should be the last result
					 * (i.e. audio recording stopped).
					 */
					setLastResult: function(){},
					/**
					 * OPTIONAL hook:
					 * resets the "next is last result" (see {@link #setLastResult})
					 */
					resetLastResult: function(){},
					/**
					 * OPTIONAL hook:
					 * return the "next is last result" status (see {@link #setLastResult})
					 *
					 * @returns {Boolean} <code>true</code> if "next is last result" is enabled
					 */
					isLastResult: function(){}

			};

			/** @memberOf Html5AudioInput# */
			var nonFunctional = true;

			/** @memberOf Html5AudioInput#
			 * @type MediaTrackSupportedConstraints | boolean
			 */
			var supportedMediaConstraints = false;

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
			var initImpl = function(implFactory){

				var impl = implFactory(/* pass-in the default logger: */ Logger.create() );
				_pluginName = impl.getPluginName();

				_logger = Logger.create(_pluginName + (ctxId? ':'+ctxId : ''));

				if(impl.setLogger){
					//set logger
					impl.setLogger(_logger);
				}

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

				/**
				 * creates Silence detector and recorder and connects them to the input stream
				 * @param {LocalMediaStream} inputstream
				 * @param {Function} [callback] OPTIONAL
				 * @memberOf Html5AudioInput#
				 */
				function onStartUserMedia(inputstream, callback){
					stream = inputstream;
					if(audio_context){
						audio_context.close();
					}
					audio_context = createAudioContext();
					var input = audio_context.createMediaStreamSource(stream);

					var settings;
					if(stream.getAudioTracks){
						var audio = stream.getAudioTracks();
						if(audio && audio.length > 0 && audio[0].getSettings){
							settings = audio[0].getSettings();
						}
					}

					if(settings && settings.channelCount){
						input.channelCount = settings.channelCount;
						input.channelCountMode = 'explicit';
					}

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
							var codecName = workerImpl.replace(/Encoder(\.js)?$/i, '').toLowerCase();
							if(_workerImpl[codecName]){
								workerImpl = _workerImpl[codecName];
							}
						}

						var channels = config.get([_pluginName, 'channelCount'], config.get([_basePluginName, 'channelCount'], 1));
						var targetSampleRate = config.get([_pluginName, 'sampleRate'], config.get([_basePluginName, 'sampleRate'], 44100));
						var recorderWorkerPath = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? workerImpl : consts.getWorkerPath()+workerImpl;
						recorder = new Recorder(input, {workerPath: recorderWorkerPath, debug: _logger.isDebug(), channels: channels, targetSampleRate: targetSampleRate});
					} else {
						recorder.init(input);
					}

					//notify listeners that a new web audio input stream was started
					_doEmitEvent(STREAM_STARTED_EVT_NAME, input, audio_context, recorder);

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
						else if (e.data === 'Noise detected!'){

							if(audioProcessor.onnoisedetected){
								isContinuePropagation = audioProcessor.onnoisedetected(e, textProcessor, currentFailureCallback);
							}
							isContinuePropagation = false;//FIXME
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
						sampleRate:    input.context.sampleRate,
						noiseTreshold: config.get([_pluginName, "silenceDetector", "noiseTreshold"], config.get(["silenceDetector", "noiseTreshold"])),
						pauseCount:    config.get([_pluginName, "silenceDetector", "pauseCount"],    config.get(["silenceDetector", "pauseCount"])),
						resetCount:    config.get([_pluginName, "silenceDetector", "resetCount"],    config.get(["silenceDetector", "resetCount"])),
						bufferSize:    config.get([_pluginName, "silenceDetector", "bufferSize"],    config.get(["silenceDetector", "bufferSize"])),
					};

					//initialize silence-detection:
					silenceDetection.postMessage({
						cmd: 'initDetection',
						config: silenceDetectionConfig
					});

					callback && callback();

				}//END: onStartUserMedia

				/**
				 * @memberOf Html5AudioInput.recorder#
				 * @type getUserMedia()
				 */
				var _getUserMedia;

				try {
					// unify the different kinds of HTML5 implementations
					_getUserMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

					if(_getUserMedia){

						nonFunctional = !((typeof AudioContext !== 'undefined') || (typeof webkitAudioContext !== 'undefined'));

						if(!nonFunctional){

							if(navigator.mediaDevices){

								// wrap navigator.mediaDevices.getUserMedia():
								_getUserMedia = function(constraints, onSuccess, onError){
									navigator.mediaDevices.getUserMedia(constraints).then(onSuccess).catch(onError);
								};

								if(navigator.mediaDevices.getSupportedConstraints){
									supportedMediaConstraints = navigator.mediaDevices.getSupportedConstraints();
								} else {
									supportedMediaConstraints = false;
								}

							} else {

								// wrap legacy impl. navigator.getUserMedia():
								navigator.__getUserMedia = _getUserMedia;
								_getUserMedia = function(constraints, onSuccess, onError){
									navigator.__getUserMedia.getUserMedia(constraints, onSuccess, onError);
								};
							}
						} else {
							_logger.error('No web audio support in this browser!');
						}

					} else {
						_logger.error('Could not access getUserMedia() API: no access to microphone available (may not be running in through secure HTTPS connection?)');
						nonFunctional = true;
					}
				}
				catch (e) {
					_logger.error('No web audio support in this browser! Error: '+(e.stack? e.stack : e));
					nonFunctional = true;
					supportedMediaConstraints = false;
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
				 * creates a new AudioContext
				 *
				 * NOTE should be only invoked after some user interaction, otherwise
				 *      the browser/execution environment might refuse to create an AudioContext
				 *
				 * @memberOf Html5AudioInput#
				 */
				var createAudioContext = function(){
					if(typeof AudioContext !== 'undefined'){
						return new AudioContext;
					}
					else {//if(typeof webkitAudioContext !== 'undefined'){
						return new webkitAudioContext;
					}
				}


				/**
				 * HELPER get audio constraints for requesting microphone base on
				 * 				browser capabilities
				 * @returns MediaTrackConstraints | true
				 * @memberOf Html5AudioInput#
				 */
				var getAudioConstraints = function(){
					if(supportedMediaConstraints){

						var val;
						var isset = false;
						var constr = {};

						if(supportedMediaConstraints.channelCount){
							//DEFAULT: 1 (mono)
							isset = true;
							val = config.get([_pluginName, 'channelCount'], config.get([_basePluginName, 'channelCount'], 1));
							constr.channelCount = val;
						}
						if(supportedMediaConstraints.sampleRate){
							//DEFAULT: 44100
							isset = true;
							val = config.get([_pluginName, 'sampleRate'], config.get([_basePluginName, 'sampleRate'], 44100));
							constr.sampleRate = val;
						}
						if(supportedMediaConstraints.autoGainControl){
							//DEFAULT: true (enabled)
							isset = true;
							val = config.get([_pluginName, 'autoGainControl'], config.get([_basePluginName, 'autoGainControl'], true));
							constr.echoCancellation = val;
						}
						if(supportedMediaConstraints.echoCancellation){
							//DEFAULT: false (disabled)
							isset = true;
							val = config.get([_pluginName, 'echoCancellation'], config.get([_basePluginName, 'echoCancellation'], false));
							constr.echoCancellation = val;
						}
						if(supportedMediaConstraints.noiseSuppression){
							//DEFAULT: true (enabled)
							isset = true;
							val = config.get([_pluginName, 'noiseSuppression'], config.get([_basePluginName, 'noiseSuppression'], true));
							constr.noiseSuppression = val;
						}

						return isset? constr : true;
					}
					return true;
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

					_getUserMedia({audio: getAudioConstraints()}, onStarted, function onError(e) {
						_logger.error('Could not access microphone: '+e, e);
						if (currentFailureCallback){
							currentFailureCallback(e);
						}
					});

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
					recording = mediaManager.micLevelsAnalysis.active(false);

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
//								stream.stop();
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
//								options.language = options.language? options.language : lang.getLanguageConfig(_pluginName) || DEFAULT_LANGUAGE;
//								options.results = options.results? options.results : DEFAULT_ALTERNATIVE_RESULTS;
//								options.disableImprovedFeedback =
//								options.mode =
//								options.eosPause =


						if(options.intermediate){
							textProcessor = options.success;
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
							recorder && recorder.clear();
							audioProcessor.initRec && audioProcessor.initRec();
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

									if(audioProcessor.isLastResult && audioProcessor.isLastResult()) {

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
							audioProcessor.setCallbacks(textProcessor, currentFailureCallback, stopUserMedia, options);

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
//								options.language = options.language? options.language : lang.getLanguageConfig(_pluginName) || DEFAULT_LANGUAGE;
//								options.results = options.results? options.results : DEFAULT_ALTERNATIVE_RESULTS;
//								options.disableImprovedFeedback =
//								options.mode =
//								options.eosPause =

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
					},
					/**
					 * @public
					 * @memberOf Html5AudioInput.prototype
					 * @see mmir.MediaManager#getRecognitionLanguages
					 */
					getRecognitionLanguages: function(successCallback, failureCallback){

						if(audioProcessor.getLanguageList){
							audioProcessor.getLanguageList(successCallback, failureCallback);
						} else {
							var msg = 'not supported: '+_pluginName+'.getRecognitionLanguages()!';
							if(failureCallback){
								failureCallback(msg);
							} else {
								_logger.warn(msg);
							}
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

			} else if((typeof WEBPACK_BUILD === 'undefined' || !WEBPACK_BUILD) && !/\.js$/i.test(implFile)){

				implFile += '.js';
			}

			_implFileName = implFile.toLowerCase();

			var processLoaded = function(newWebAudioAsrImpl){

				var instance = htmlAudioConstructor();

				//initialize implementation:
				try{
					initImpl(newWebAudioAsrImpl);
				} catch(err){
					handleError(err);
				}

				//invoke the passed-in initializer-callback and export the public functions:
				callBack(instance);
			};

			var handleError = function(err){

				_logger.error('ERROR: failed to initialize webAudioInnput with module "'+implFile+'": '+err, err);

				//invoke callback without exporting functions & non-functional information:
				callBack({}, {
					mod: implFile,
					disabled: ['startRecord', 'stopRecord', 'recognize', 'cancelRecognition', 'getRecognitionLanguages'],
					message: err
				});
			};

			//load the necessary scripts and then call htmlAudioConstructor

			mediaManager.loadFile('webMicLevels.js', function(){

				if(typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD){
					try{
						processLoaded(__webpack_require__(implFile.replace(/\.js$/i, '')));
					} catch(err){
						handleError(err);
					}
				} else {
					require([implFile], processLoaded, function(_err){
						//try filePath as module ID instead:
						var moduleId = implFile.replace(/\.js$/i, '');
						_logger.debug('failed loading plugin from file '+implPath+', trying module ID ' + moduleId)
						require([moduleId], processLoaded, handleError)
					});
				}

			}, handleError);

		}//END: initialize()

	};

});//END define
