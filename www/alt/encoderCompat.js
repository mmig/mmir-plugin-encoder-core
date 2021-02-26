
/*
 * compatiblity wrapper for older encoder implementations (targeting API < 1.x)
 */


;(function(global){

var BaseEncoder = function BaseEncoder(){};

BaseEncoder.prototype = {
	recLength: 0,
	recordingBuffers: [],
	sampleRate: -1,
	channels: -1,
	eosDetected: false,
	bufferSize: -1,
	targetSampleRate: -1,
	resampler: null,

	repeatBuffer: null,
	repeatBufferSize: 3,
	//TODO different modes unsupported yet -> impl. this:
	repeatBufferMode: "silence",// undefined or "" (no automatic applying of repeat-buffer) | "silence" | "overflow" | "silenceoverflow"

	resultMode: 'blob',//"blob" | "merged" | "raw"
	streaming: false,
	encodingMode: 'onfinish',//"onfinish" | "ondata"
	params: null,
	transferBuffers: false,

	encoderFactory: null,
	encoder: null,

	isDebug: false,

	sumLengthOf: sumLengthOf,
	mergeBuffersUint: mergeBuffersUint,
	mergeBuffersFloat: mergeBuffersFloat,
	mergeBuffers: mergeBuffers,

	/**
	 * HELPER attaches methods to encoder for caching encoding-data:
	 *
	 * <pre>
	 * // for caching encoding-data
	 * encoder.doCache(buffer);
	 *
	 * // for encoding all cached data (if there is any; does nothing if no data is cached)
	 * encoder.doEncodeCached();
	 * </pre>
	 *
	 * @param  {Encoder} encoder the encoder instance
	 */
	makeEncodingCachableFor: makeEncodingCachableFor,

	/**
	 * add/register factory function for creating new encoder instances
	 *
	 * NOTE currently only supports one registerd factory at a time.
	 *
	 * @param  {Function} encoderFactory factory for creating new encoder instances:
	 *                   <pre>encoderFactory(config, baseEncoder) -> EncoderInstance</pre>
	 *                   where
	 *                   	config: the BaseEncoderOptions, see {@link #init}
	 *                   	baseEncoder: a reference to the BaseEncoder
	 */
	addEncoderFactory: function(encoderFactory){
		this.encoderFactory = encoderFactory;
	},

	init: function(config){

		this.resampler = null;
		this.targetSampleRate = void(0);

		this.sampleRate = config.sampleRate;
		this.bufferSize = config.bufferSize;
		this.channels = config.channels;

		//ensure that encoder params object is present:
		config.params = config.params || {};

		this.setConfig(config);
		//NOTE initialize after setConfig() to ensure repeatBufferSize setting was applied
		this.repeatBuffer = new RingBuffer(this.repeatBufferSize);

		//create & init encoder
		this.encoder = this.encoderFactory(config, this);
		this.encoder.init && this.encoder.init();

		//do set config again, in case encoder modified settings FIXME is there a better to only set it once?
		this.setConfig(config);

		this.clear(true);//<- force clearing to ensure recording buffer gets initialized

		//send initialization message (with supportedTypes information):
		var resultParams = config.params;
		resultParams.supportedTypes = this.encoder.supportedTypes;

		global.postMessage({message: 'initialized', source: 'encoder', params: resultParams});
	},

	_setFromConfig: function(fieldName, config, configFieldName){
		configFieldName = configFieldName || fieldName;
		if(typeof config[configFieldName] !== 'undefined'){
			this[fieldName] = config[configFieldName];
		}
	},

	/**
	 * HELPER: get value from config:
	 * if config value is undefined and an defaultValue (other than undefined)
	 * is given, updates the config with the defaultValue.
	 *
	 * @param  {String} fieldName the field name to retrieve
	 * @param  {Configuration} config the configuration object
	 * @param  {any} [defaultValue] OPTIONAL a default value
	 * @return {any} the config (or default) value
	 */
	getSetConfig: function(fieldName, config, defaultValue){
		if(typeof config[fieldName] !== 'undefined'){
			return config[fieldName];
		}
		if(typeof defaultValue !== 'undefined'){
			config[fieldName] = defaultValue;
		}
		return defaultValue;
	},
	/**
	 * HELPER get MIME type from config.params:
	 * if MIME type is not specified, or is not contained in supportedTypes, the
	 * first entry from supportedTypes will be set as MIME type to the params and returned.
	 *
	 * @param  {EncoderParams} params the config.params object (which may have a value for params.mimeType)
	 * @param  {Array<String>} supportedTypes list of supported MIME types
	 * @return {String} the MIME type: if supported, params.mimeType, otherwise first entry from supportedTypes
	 */
	getSetMimeType: function(params, supportedTypes){
		var mimeType = params.mimeType;
		if(typeof mimeType !== 'undefined'){
			var supported = false;
			var re = new RegExp('^'+mimeType+'

;(function(global){

global.baseEncoder.__init = global.baseEncoder.init;

global.baseEncoder.init = function(){

	if(!this.encoderFactory && global.encoderInstance){
		var encoder = global.encoderInstance;
		this.addEncoderFactory(toEncoderFactory(encoder));
	}

	this.__init.apply(this, arguments);
}

/**
 * create legacy encoder factory:
 * HELPER create new API wrapper for legacy encoders
 *
 * @param  {EncoderImpl} encoderInstance an old encoder instance
 * @return {Function} a factory function that proxies the new API to the old encoder API
 */
function toEncoderFactory(encoderInstance){

	var encoderConstructor = encoderInstance.constructor;
	var initData = Object.assign({}, encoderInstance);

	function LegacyEncoder(config, _baseEncoder){
		var instance = new encoderConstructor();
		Object.assign(instance, initData, {
			__baseConfig: config,
			__mergeBuffers: global.baseEncoder.mergeBuffers,
			init: function(){
				this.encoderInit(this.__baseConfig);
			},
			encode: function(buff){
				this.encodeBuffer(buff);
			},
			takeEncoded: function(options){
				this.encoderFinish();
				var data = this.encoded.splice(0);
				// var resultMode = (options && options.resultMode) || this.__baseConfig.resultMode;
				return options.resultMode === "raw"? data : this.__mergeBuffers(data, -1, data[0].constructor);
			},
			finish: function(){
				this.encoderCleanUp();
			},
			preventTransferBuffers: true,//<- by default: do prevent invalidating encoded data by transfering its ownership
			//new API functions (no legacy equivalent):
			// destroy?: () => void;
			// dropEncoded?: () => void;
			// encodedData?: TypedArray[];
		});

		return instance;
	}

	return function legacyEncoderFactory(configData, baseEncoder){
		return new LegacyEncoder(configData, baseEncoder);
	};
}

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);
, 'i');
			for(var i=0, size=supportedTypes.length; i < size; ++i){
				if(re.test(supportedTypes[i])){
					supported = true;
					if(mimeType !== supportedTypes[i]){
						params.mimeType = mimeType = supportedTypes[i];
					}
					break;
				}
			}
			if(supported){
				return mimeType;
			}
			console.warn('specified unsupported MIME type ('+params.mimeType+'), using default ('+supportedTypes[0]+') instead.');
		}
		return (params.mimeType = supportedTypes[0]);
	},

	select: function(value, ifUndefinedValue){
		return (typeof value !== 'undefined'? value : ifUndefinedValue);
	},

	setConfig: function(config){

		this._setFromConfig('isDebug', config, 'debug');
		this._setFromConfig('resultMode', config);
		this._setFromConfig('streaming', config);
		this._setFromConfig('encodingMode', config);
		this._setFromConfig('params', config);
		this._setFromConfig('transferBuffers', config);

		this._setFromConfig('repeatBufferSize', config);
		this._setFromConfig('repeatBufferMode', config);

		if(typeof config.targetSampleRate !== 'undefined'){

			this.targetSampleRate = config.targetSampleRate;
			if(this.targetSampleRate !== this.sampleRate){
				// -> create resampler instance if neccessary
				var resampler = this.resampler;
				if(global.Resampler && (!resampler || resampler.sourceSampleRate !== this.sampleRate || resampler.targetSampleRate !== this.targetSampleRate)){
					resampler = new global.Resampler(this.sampleRate, this.targetSampleRate, /*channels: currently only for mono!*/ 1, this.bufferSize);
					resampler.sourceSampleRate = this.sampleRate;
					resampler.targetSampleRate = this.targetSampleRate;
					this.resampler = resampler;
				}
			} else {
				// -> remove existing resampler, if one exists
				this.resampler = null;
			}
		} else {
			// -> remove existing resampler, if one exists
			this.resampler = null;
		}
	},

	record: function(inputBuffer){

		var len = this.recordingBuffers.length;
		this.recordingBuffers[0].push(inputBuffer[0]);

		if(len > 1 && inputBuffer.length > 1){
			this.recordingBuffers[1].push(inputBuffer[1]);
			if(len > 2){
				console.warn('Encoder: can only record max. 2 channels, ignoring other '+(len-2)+' channel(s)' );
			}
		}
		this.recLength += inputBuffer[0].length;
	},

	encode: function(buffers, params){

		//FIXME make this configurable? (i.e. if temp buffers should be prepended after EOS was detected ... should probaly also be appended on SEND_PARTIAL? ... also this should probably moved to the sendData function, after clearing the send data)
		this.doProcessAfterSpeechEnded();

		var encodingMode = (params && params.encodingMode) || this.encodingMode;
		if(encodingMode === 'onfinish'){

			//buffer audio data
			this.record(buffers);

		} else {

			if(encodingMode !== 'ondata'){
				console.error('unknown encoding mode (using mode "ondata" instead)', encodingMode);
			}

			this.encodeRecorded();
			// this.encoder.encodeBuffer(buffers[0]);//FIXM encoder function name
			this.encoder.encode(buffers[0]);
		}

		//store in (ring) repeat buffer:
		this.repeatBuffer.push(buffers[0]);

		//detect noise (= speech) and silence in audio:
		this.eosDetected = SilenceDetector.isSilent(buffers[0]);
		if(this.isDebug) console.log("eosDetected: " + this.eosDetected);//FIXME DEBUG

		if(this.streaming){
			this.sendData(params);//, encoder);
		}
	},
	encodeRecorded: function(){

		//encode audio data TODO only for left channel! should more be supported?
		for(var i=0, size = this.recordingBuffers[0].length; i < size; ++i){
			// this.encoder.encodeBuffer(this.recordingBuffers[0][i]);//FIXM encoder function name
			this.encoder.encode(this.recordingBuffers[0][i]);
		}
		this.clearRecording();

	},
	sendData: function(params){

		var params = params || {resultMode: undefined, mimeType: undefined, transferBuffers: undefined};

		//evalute params: use instance settings, if not defined in params itself:
		params.resultMode = params.resultMode || this.resultMode;//"blob" | "merged" | "raw" | "recordingBuffers"
		params.mimeType = params.mimeType || (this.params && this.params.mimeType) || void(0);
		if(typeof params.transferBuffers === 'undefined'){
			params.transferBuffers = this.transferBuffers;
		}
		if(typeof params.streaming === 'undefined'){
			params.streaming = this.streaming;
		}

		var data, transfers;
		if(params.resultMode === 'recordingBuffers'){

			data = this.recordingBuffers;
			params.transferBuffers = false;

		} else {

			// this.encoder.encoderFinish(params);//FIXM change encoder function name
			// var encodedData = this.encoder.encoded;//FIXM change encoder field name
			var encodedData = this.encoder.takeEncoded(params);

			if(this.encoder.preventTransferBuffers){
				params.transferBuffers = false;
			}

			// if(this.isDebug) console.log("encoder finish: ", params.resultMode, params.finish, 'mime: '+ params.mimeType);
			// if(this.isDebug) console.log("encodedExt: "+encodedData.length);

			if(params.resultMode === 'blob'){

				data = new Blob([encodedData], params.mimeType? {type: params.mimeType} : void(0));

				if(params.transferBuffers){
					transfers = [data];
				}

			} else if(params.resultMode === 'merged'){

				//NOTE: merging should have been done when calling encoder.takeEncoded({resultMode: 'merged'})
				data = !Array.isArray(encodedData)? encodedData : this.mergeBuffers(encodedData, -1, encodedData[0].constructor);

				if(params.transferBuffers){
					transfers = [data];
				}

			} else {

				if(params.resultMode !== 'raw'){
					console.error('requested unknown result type (using "raw" instead)', params.resultMode);
				}
				data = encodedData;

				if(params.transferBuffers){
					transfers = Array.isArray(data)? data.map(function(buff){
						return buff.buffer;
					}) : data.buffer;
				}

			}

			if(params.finish){
				// this.encoder.encoderCleanUp();//FIXM change encoder function name
				this.encoder.finish();
			}
		}

		// requested context for reply:
		var resultParams = {
			resultMode: params.resultMode,
			// transferBuffers: !!params.transferBuffers,
			mimeType: params.mimeType,
			finish: !!params.finish,
			streaming: !!params.streaming,
			context: params.context,
		};

		global.postMessage({message: 'data', source: 'encoder', data: data, params: resultParams}, transfers);

		//FIXME test apply repeatBuffers
		if(params.applyRepeatBuffer){
			this.eosDetected = true;//FIXME impl. better mechanism?
		}

	},
	doProcessAfterSpeechEnded: function(){

		//FIXME impl. mode
		// if(this.repeatBufferMode === ...)

		if(this.eosDetected){
			//-> EOS was detected on previous audio chunk(s): do add last few cached audio-buffers, before recording the new one

			this.eosDetected = false;
			var tmpBuffer = this.repeatBuffer.pull();//SilenceDetector.loadBuffer();
			if(this.isDebug) console.info("encoder onmessage record loadBuffers");//FIXME DEBUG

			if(tmpBuffer && tmpBuffer.length > 0){

				var tempChannels = this.channels;
				if(this.isDebug) console.log("tmpBuffer (target channel count: "+tempChannels+"): ", tmpBuffer);//FIXME DEBUG
				var tempBuff, j, _recBuffer;

				for(i=0; i < tmpBuffer.length; i++){
					tempBuff = tmpBuffer[i];
					if(tempChannels > 1){
						_recBuffer = new Array(tempChannels);
						for(j=0; j < tempChannels; ++j){
							_recBuffer[j] = tempBuff;
						}
					} else {
						_recBuffer = [tempBuff];
					}
					this.record(_recBuffer);
				}

			}//END: if(tmpBuffer...

		}//END: if(this.eosDetected){...

	},

	/** resample sampleRate -> targetSampleRate, @see #setConfig */
	doResample: function(buffer){
		return this.resampler? this.resampler.resampler(buffer) : buffer;
	},

	clearRecording: function(force){
		if(this.isDebug) console.debug('clear REC '+this.recLength);
		if(force || this.recLength > 0){
			this.recLength = 0;
			this.recordingBuffers = new Array(this.channels);
			for(var i=0; i < this.channels; ++i){
				this.recordingBuffers[i] = [];
			}
		}
	},

	clear: function(force){
		this.clearRecording(force);
		this.repeatBuffer.reset();
		this.encoder.dropEncoded && this.encoder.dropEncoded();
	}
}

function sumLengthOf(bufferList){
	var i=0, size = bufferList.length, total=0;
	for(;i < size; ++i){
		total += bufferList[i].length;
	}
	return total;
}

function mergeBuffersUint(channelBuffer, recordingLength){
	return mergeBuffers(channelBuffer, recordingLength, Uint8Array);
}

function mergeBuffersFloat(recBuffers, recordingLength){
	return mergeBuffers(recBuffers, recordingLength, Float32Array);
}

function mergeBuffers(recBuffers, recordingLength, TypedArrayConstructor){
	recordingLength = recordingLength > 0? recordingLength : sumLengthOf(recBuffers);
	var result = new TypedArrayConstructor(recordingLength);
	var offset = 0;
	var buff;
	for (var i = 0; i < recBuffers.length; i++){
		buff = recBuffers[i];
		result.set(buff, offset);
		offset += buff.length;
	}
	return result;
}

function makeEncodingCachableFor(encoder){

	encoder._cached = null;

	encoder.doCache = function(buf){
		if(!this._cached){
			this._cached = [buf];
		} else {
			this._cached.push(buf);
		}
	};

	encoder.doEncodeCached = function(){
		if(this._cached){
			var cached = this._cached;
			this._cached = null;
			for(var i=0,size=cached.length; i < size; ++i){
				this.encode(cached[i]);
			}
		}
	};
}

var baseEncoder = new BaseEncoder();
global.baseEncoder = baseEncoder;

global.onmessage = function(evt) {

	var evtData = evt.data;
	if(evtData.target === 'encoder'){
		switch (evtData.cmd) {

		case 'init':
			baseEncoder.init(evtData.params);
			break;
		case 'encode':
			baseEncoder.encode(evtData.buffers, evtData.params);//, encoder);
			break;
		case 'clear':
			baseEncoder.clear();
			break;
		case 'requestData':
			baseEncoder.encodeRecorded();
			baseEncoder.sendData(evtData.params);//, encoder);
			break;
		default:
			console.error('BaseEncoder: received unknown command (for target "encoder")', evt);
		}
	}
	else if(evtData.target === 'detection'){

		SilenceDetector.processMessage(evtData);

	} else {

		console.error('BaseEncoder: received message for unknown target', evt);
	}

};

/**
 * simple ring buffer (for 1 audio channel)
 *
 * based on
 * https://github.com/GoogleChromeLabs/web-audio-samples/blob/gh-pages/audio-worklet/design-pattern/lib/wasm-audio-helper.js#L170
 *
 * @param       {number} length max. size for the ring buffer
 * @constructor
 */
function RingBuffer(length) {
	this._readIndex = 0;
	this._writeIndex = 0;

	this._length = length;
	this._data = new Array(length);

	this.size = 0;
}

/**
 * Push a (single) Float32Array to buffer.
 *
 * @param  {Float32Array} binData A (single) Float32Array
 */
RingBuffer.prototype.push = function(binData) {

	this._data[this._writeIndex] = binData;

	++this._writeIndex;
	if (this._writeIndex >= this._length) {
		this._writeIndex = 0;
	}

	// For excessive frames, the buffer will be overwritten.
	++this.size;
	if (this.size > this._length) {
		this.size = this._length;
	}
};

/**
 * Pull all data out of buffer and return the corresponding sequence of Float32Arrays.
 *
 * @returns  {Float32Array[]} An array of Float32Arrays.
 */
RingBuffer.prototype.pull = function() {

	var binData = new Array(this.size);

	// If the FIFO is completely empty, return empty array.
	if (this.size === 0) {
		return binData;
	}

	// Transfer data from the internal buffer to the |binData|.
	for (var i = 0; i < this.size; ++i) {
		var readIndex = (this._readIndex + i) % this._length;
		binData[i] = this._data[readIndex];
	}

	// reset to "empty" state:
	this._readIndex = 0;
	this._writeIndex = 0;
	this.size = 0;

	return binData;
};

RingBuffer.prototype.reset = function(){
	if(this.size > 0){
		// unset all entries so that binary data can be garbage collected
		for (var i = 0; i < this._length; ++i) {
			this._data[i] = void(0);
		}
		this.size = 0;
	}
	this._readIndex = 0;
	this._writeIndex = 0;
}
// class RingBuffer

global.RingBuffer = RingBuffer;

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);


;(function(global){

global.baseEncoder.__init = global.baseEncoder.init;

global.baseEncoder.init = function(){

	if(!this.encoderFactory && global.encoderInstance){
		var encoder = global.encoderInstance;
		this.addEncoderFactory(toEncoderFactory(encoder));
	}

	this.__init.apply(this, arguments);
}

/**
 * create legacy encoder factory:
 * HELPER create new API wrapper for legacy encoders
 *
 * @param  {EncoderImpl} encoderInstance an old encoder instance
 * @return {Function} a factory function that proxies the new API to the old encoder API
 */
function toEncoderFactory(encoderInstance){

	var encoderConstructor = encoderInstance.constructor;
	var initData = Object.assign({}, encoderInstance);

	function LegacyEncoder(config, _baseEncoder){
		var instance = new encoderConstructor();
		Object.assign(instance, initData, {
			__baseConfig: config,
			__mergeBuffers: global.baseEncoder.mergeBuffers,
			init: function(){
				this.encoderInit(this.__baseConfig);
			},
			encode: function(buff){
				this.encodeBuffer(buff);
			},
			takeEncoded: function(options){
				this.encoderFinish();
				var data = this.encoded.splice(0);
				// var resultMode = (options && options.resultMode) || this.__baseConfig.resultMode;
				return options.resultMode === "raw"? data : this.__mergeBuffers(data, -1, data[0].constructor);
			},
			finish: function(){
				this.encoderCleanUp();
			},
			preventTransferBuffers: true,//<- by default: do prevent invalidating encoded data by transfering its ownership
			//new API functions (no legacy equivalent):
			// destroy?: () => void;
			// dropEncoded?: () => void;
			// encodedData?: TypedArray[];
		});

		return instance;
	}

	return function legacyEncoderFactory(configData, baseEncoder){
		return new LegacyEncoder(configData, baseEncoder);
	};
}

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);
