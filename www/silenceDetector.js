
var SilenceDetector = (function(global){

/**
 * Counter:
 *	how many silent audio chunks have there currently been in a row now?
 * @memberOf SilenceDetector.prototype
 */
var silenceCount = 0;
/**
 * Counter:
 *	how many audio chunks have been currently loud in a row now?
 * @memberOf SilenceDetector.prototype
 */
var speechCount = 0;
/**
 * Counter:
 *	how long has there been no loud enough input (in a row), up to now?
 * @memberOf SilenceDetector.prototype
 */
var lastInput = 0;
/** @memberOf SilenceDetector.prototype */
var recording= false;
/**
 * audio was noisy for a certain time (may be interpreted as "speech")
 *
 * @memberOf SilenceDetector.prototype
 * @type {Boolean}
 */
var isNoise = false;
/**
 * the lower threshold for noise (lower than this is considered "silence"), i.e.
 * the bigger, the more is counted as silent
 * @memberOf SilenceDetector.prototype
 */
var noiseTreshold = 0.1;
/** @memberOf SilenceDetector.prototype */
var sampleRate = 0;
/** @memberOf SilenceDetector.prototype */
var pauseCount = 3;
/** @memberOf SilenceDetector.prototype */
var resetCount = 15;
/** @memberOf SilenceDetector.prototype */
var maxBlobSize = 15;
/** @memberOf SilenceDetector.prototype */
var blobSizeCount = 0;
/** @memberOf SilenceDetector.prototype */
var blobNumber = 0;

//events:
/**
 * Fired, when detection has started
 *
 * @see .start
 *
 * @event SilenceDetectionStarted
 * @memberOf SilenceDetector.prototype
 */
var STARTED = 'detectionstart';
/**
 * Fired, when detection has stopped
 *
 * @see .stop
 *
 * @event SilenceDetectionStopped
 * @memberOf SilenceDetector.prototype
 */
var STOPPED = 'detectionend';
/**
 * Fired, when detector has been initialized / configured.
 *
 * @see .initDetection
 *
 * @event SilenceDetectionInitialized
 * @memberOf SilenceDetector.prototype
 */
var INITIALIZED = 'detectioninitialized';
/**
 * Fired, when {@link #maxBlobSize} for buffering audio has been reached,
 * with regard to last fired {@link #event:SilenceDetectionSendPartial},
 * {@link #event:SilenceDetectionPauseDetected}, or {@link #event:SilenceDetectionClear}
 * event.
 *
 * @event SilenceDetectionSendPartial
 * @memberOf SilenceDetector.prototype
 * @default
 */
var SEND_PARTIAL = 'overflow';
/**
 * Fired, after {@link .start} and the first N audio blobs have been processed.
 *
 * @event SilenceDetectionAudioStarted
 * @memberOf SilenceDetector.prototype
 *
 * @depracted FIXME remove?
 */
var AUDIO_STARTED = 'detectionaudiostart';
/**
 * Fired, if a <em>pause</em> (i.e. silence) was detected after some <em>noise</em>
 *
 * @see .isSilent
 *
 * @event SilenceDetectionPauseDetected
 * @memberOf SilenceDetector.prototype
 */
var SILENCE = 'soundend';
/**
 * Fired, if some <em>noise</em> was detected for a continued duration
 *
 * @see .isNoise
 *
 * @event SilenceDetectionPauseDetected
 * @memberOf SilenceDetector.prototype
 */
var NOISE = 'soundstart';
/**
 * Fired, if audio was silent for some duration of time.
 *
 * The data since last 'send partial'/'silence detected' only consists of silence, i.e. it can be cleared/deleted.
 *
 * @see .isSilent
 *
 * @event SilenceDetectionClear
 * @memberOf SilenceDetector.prototype
 */
var CLEAR = 'silent';

/**
 * sets the config and echos back
 *
 * @param {PlainObject} config
 *			configuration settings with properties
 * @param {Integer} config.sampleRate
						audio sampling rate
 * @param {Integer} config.noiseThreshold
						lower threshold up to which audio is considered as noise (i.e. "not silent")
 * @param {Integer} config.pauseCount
						"silence duration": count of "silent" data blobs in a row which must occur, in order to
						consider the input as "speech input pause"
 * @param {Integer} config.resetCount
						"pure silence": if there was no "noise" since the last "silence" and the amount of "silence" has passed,
						signal "clear" (i.e. clear/delete this silent audio); for saving bandwidth
 *
 * @private
 * @memberOf SilenceDetector.prototype
 */
function _initDetection(config){
	if (config.sampleRate){
		sampleRate = config.sampleRate;
		if(typeof sampleRate !== 'number'){
			sampleRate = parseInt(sampleRate, 10);
		}
	}
	if (config.noiseTreshold){
		noiseTreshold = config.noiseTreshold;
		if(typeof noiseTreshold !== 'number'){
			noiseTreshold = parseFloat(noiseTreshold);
		}
	}
	if (config.pauseCount){
		pauseCount = config.pauseCount;
		if(typeof pauseCount !== 'number'){
			pauseCount = parseInt(pauseCount, 10);
		}
	}
	if (config.resetCount){
		resetCount = config.resetCount;
		if(typeof resetCount !== 'number'){
			resetCount = parseInt(resetCount, 10);
		}
	}
	_sendMessage(INITIALIZED, {canDetectSpeech: false});
}

/**
 * processes an audioBlob and decides whether or not there has been a "real input"
 * (min. {@link #speechCount} "loud" blobs in a row) and a "real pause"
 * (min. {@link #pauseCount} silent blobs in a row).
 *
 * If there has been a "real pause" after "real input", {@link #event:SilenceDetectionPauseDetected} will be signaled.
 *
 * If some time has gone by without any real input, it sends {@link #event:SilenceDetectionClear} signal,
 * i.e. signaling that that buffered audio is all silent and can be dropped / ignored.
 *
 *
 * Overview for detection-states & fired events, after detection was {@link .start}ed:
 * <pre>
 *
 *				fire: CLEAR										 	fire: SILENCE
 *							^															 	 ^
 *							|															 	 |
 * [no "loud" blobs AND "silent" > resetCount]	 |
 *							|																 |
 *				|------------|											 	 |						|------------|
 *				|						 |	<-["silent" blobs > silenceCount]-	|						 |
 *				|		silent	 |																			|		 noisy	 |
 *				|						 |	---["loud" blobs > speechCount]-->	|						 |
 *				|------------|									|										|------------|
 *						 														|													 |
 *																				|							[blob count > maxBlobSize]
 *						 														v													 |
 *						 											fire: NOISE											 v
 *																												fire: SEND_PARTIAL
 *
 * </pre>
 * (in addition, {@link #event:SilenceDetectionStarted} is fired, after {@link .start}ed and processing the first N blobs)
 *
 *
 * @param {Float32Array} inputBuffer
 *			the PCM audio data (for one/left channel)
 * @returns {Boolean} <code>true</code> if silence (after speech/loud part) was detected, i.e. when message #SILENCE was posted
 *
 * @private
 * @memberOf SilenceDetector.prototype
 */
function _isSilent(inputBuffer){
	var longSilence = false;
	if (recording){
		++blobNumber;
		if (blobNumber === 3){
			//at the very start (i.e. after 3 chunks): signal "started"
			_sendMessage(AUDIO_STARTED);
		}
		var thisSilent = true;
		var bound = 0, val;
		for (var i = 0; i < inputBuffer.length; ++i) {
			val = Math.abs(inputBuffer[i]);
			if ( val > noiseTreshold ){
				if (val > bound){
					bound = val;
				}
				thisSilent = false;
			}
		}
		if (thisSilent){
			if (silenceCount >= pauseCount){
				longSilence = true;
				_sendMessage(SILENCE);
				speechCount = 0;
				silenceCount = 0;
				lastInput = 0;
				blobSizeCount = 0;
			}
			if (speechCount >= pauseCount){
				++blobSizeCount;
				++silenceCount;
			}
			else {
				speechCount = 0;
				++lastInput;
			}
		}
		else {
			if (speechCount >= pauseCount){
				silenceCount = 0;
				++blobSizeCount;
				if(!isNoise){
					_sendMessage(NOISE);
					isNoise = true;
				}
			}
			else {
				isNoise = false;
				++speechCount;
				++lastInput;
			}
		}

		if (speechCount === 0){

			if(lastInput > resetCount){
				_sendMessage(CLEAR);
				lastInput = 0;
			}

		} else if (blobSizeCount >= maxBlobSize){

			_sendMessage(SEND_PARTIAL);
			blobSizeCount = 0;
		}
	}
	return longSilence;
}

/**
 * Starts silence detection:
 * resets everything and switches the worker to recording mode.
 *
 * @fires SilenceDetectionStarted
 *
 * @private
 * @memberOf SilenceDetector.prototype
 */
function _start(){
	silenceCount = 0;
	speechCount = 0;
	lastInput = 0;
	recording = true;
	isNoise = false;
	blobNumber = 0;
	// _resetBuffer();
	_sendMessage(STARTED);
}

/**
 * Stops silence detection:
 * resets everything and switches the worker off recording mode.
 *
 * @fires SilenceDetectionStopped
 *
 * @private
 * @memberOf SilenceDetector.prototype
 */
function _stop(){
	recording = false;
	if (speechCount > 0){
		if(!isNoise){
			_sendMessage(NOISE);
		}
		_sendMessage(SILENCE);
		speechCount = 0;
		silenceCount = 0;
		lastInput = 0;
		blobSizeCount = 0;
	}
	isNoise = false;
	_sendMessage(STOPPED);
}

/**
 * send a message to the owner of the WebWorker
 *
 * @param  {String} msg the event name/type
 * @param  {DetectionParams} [params] OPTIONAL
 * @param  {DetectionParams} [params.canDetectSpeech] OPTIONAL indicating that speech
 *                           (in addition & difference to just "noise" can be detected)
 *                           NOTE this impl. can only detect NOISE, but cannot decern
 *                                NOISE from SPEECH, i.e. when present, this its value
 *                                must be set to FALSE
 *
 * @private
 * @memberOf SilenceDetector.prototype
 */
function _sendMessage(msg, params){

	global.postMessage({message: msg, source: 'detection', params: params});

	var listener = silenceDetector && silenceDetector['on'+msg];
	if(typeof listener === 'function'){
		listener.call(silenceDetector, msg);
	}
}

/**
 * @param {String} cmd
 *			one of "config" | "start" | "isSilent" | "stop"
 * @param {PlainObject} [config]
 *			SHOULD be provided if cmd is "config"
 *			see #_initDetection
 * @param {Buffer} [buffer]
 *			MUST be provided if cmd is "isSilent"
 *			see #_isSilent
 *
 * @private
 * @memberOf SilenceDetector.prototype
 */
function _processesCommand(cmd, config, buffer){
	switch(cmd){
		case 'config':
			_initDetection(config);
			break;
		case 'start':
			_start();
			break;
		case 'isSilent':
			_isSilent(buffer);
			break;
		case 'stop':
			_stop();
			break;
		default:
			console.error('SilenceDetector: unknown command "'+cmd+'"');
	}
}

/**
 * @class SilenceDetector
 */
var silenceDetector = {
	/**
	 * @copydoc #_initDetection
	 * @public
	 * @memberOf SilenceDetector
	 *
	 * @param  {DetectionConfiguration} config the configuration for the silence detection
	 */
	initDetection: _initDetection,
	/**
	 * @copydoc #_start
	 * @public
	 * @memberOf SilenceDetector
	 */
	start: _start,
	/**
	 * @copydoc #_isSilent
	 * @public
	 * @memberOf SilenceDetector
	 *
	 * @param  {Float32Array} buffer (one channel) PCM data
	 * @returns {Boolean} TRUE if a "long" silence was detected when processing the data
	 *
	 */
	isSilent: _isSilent,
	/**
	 * @copydoc #_stop
	 * @public
	 * @memberOf SilenceDetector
	 */
	stop: _stop(),
	/**
	 * Executes one of the functions.
	 *
	 * @param {MessageEventData} eventData
	 *				the data of an MessageEvent
	 * @param {MessageEventData} eventData.cmd
	 *				command/function name that should be executed, one of
	 *				<code>"config" | "start" | "isSilent" | "stop"</code>
	 * @param {MessageEventData} [eventData.params] OPTIONAL
	 *				the configuration options, if <code>cmd</code> is "config", see {@link #_initDetection}
	 * @param {Float32Array} [eventData.buffers] OPTIONAL
	 *				the audio data, if <code>cmd</code> is "isSilent", see {@link #_isSilent}
	 *
	 * @memberOf SilenceDetector
	 */
	processMessage: function(eventData){
		var config, bin;
		if(eventData.params){
			config = eventData.params;
		}
		if(eventData.buffers){
			bin = eventData.buffers;
		}
		_processesCommand(eventData.cmd, config, bin);
	}
};

global.SilenceDetector = silenceDetector;

return silenceDetector;

})(typeof self !== 'undefined'? self : typeof window !== 'undefined'? window : typeof global !== 'undefined'? global : this);
