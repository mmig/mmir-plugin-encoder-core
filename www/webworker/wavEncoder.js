/*
 * License (MIT)
 *
 * modifications:
 *	Copyright (c) 2013-2021 DFKI GmbH, Deutsches Forschungszentrum fuer Kuenstliche Intelligenz (German Research Center for Artificial Intelligence), https://www.dfki.de
 *
 * based on
 *	Copyright (C) 2013 Matt Diamond (MIT License)
 *  Modified Work Copyright © 2014 Christopher Rudmin (MIT License)
 *
 */

/**
 * @module workers/recorderExt
 *
 * TODO refactor to use (duplicate) functionality in encoder.js (and remove it here!)
 */


if(typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD){
	require('../silenceDetector.js');
	require('../resampler.js');
	require('../encoder.js');
}	else {
	importScripts('silenceDetector.js');
	importScripts('resampler.js');
	importScripts('encoder.js');
}

;(function(global){

function WavEncoder(config, baseEncoder){

	this.baseEncoder = baseEncoder;

	this.supportedTypes = [
		// "normal" WAV incl. header:
		'audio/wav',
		// "streaming" WAV without header:
		'audio/l8', 'audio/l16', 'audio/l24'
	];

	this.mimeType;

	var _state = '';// '' | 'initializing' | 'initialized' | 'error'
	var _recLengthWav = 0;

	var _tempBuffer = [];
	// this.encoded;

	// //if encode() is called while async-init, the data will be cached in this list until initialization has completed
	// this._cached;

	//target samplerate for encoding WAV
	var _desiredSampleRate = 16000;

	var _sampleRate;
	var _channels;

	var _bitsPerSample = 16;
	var _bytesPerSample = 2;

	var _isRawFormat = false;

	var streaming = typeof config.streaming !== 'undefined'? config.streaming : false;
	var resultMode = config.resultMode || 'merged';

	this._init = function(config) {

		var targetSampleRate = config.targetSampleRate || _desiredSampleRate;
		if(targetSampleRate !== _desiredSampleRate){
			_desiredSampleRate = targetSampleRate;
		}
		_sampleRate = config.sampleRate || _sampleRate;
		_channels = config.channels || _channels;

		if(config.channels && config.channels !== _channels){
			console.warn('overwriting channels setting (channels='+config.channels+'): only 1 channel supported');
			_channels = 1;
		}

		_bitsPerSample = config.params.bitsPerSample || _bitsPerSample;

		this.mimeType = config.params.mimeType || this.supportedTypes[0];

		_isRawFormat = false;
		var bitrateFromMime = /^audio\/l(\d+)/i.exec(this.mimeType);
		if(bitrateFromMime){
			var bitsPerSample = parseInt(bitrateFromMime[1], 10);
			if(isFinite(bitsPerSample)){
				_bitsPerSample = bitsPerSample;

				if(config.params.bitsPerSample && config.params.bitsPerSample !== _bitsPerSample){
					console.warn('overwriting bitsPerSample setting (params.bitsPerSample='+config.params.bitsPerSample+') with approriate value derived from MIME type: '+this.mimeType+' -> '+_bitsPerSample)
				}
			}

			if(!streaming){
				streaming = true;
				if(typeof config.streaming !== 'undefined' && config.streaming !== streaming){
					console.warn('overwriting streaming setting (streaming='+config.streaming+') with approriate value derived from MIME type: '+this.mimeType+' -> '+streaming);
				}
			}

			_isRawFormat = true;

		} else if(!/^audio\/wav/i.test(this.mimeType)){

			console.warn('overwriting unknown MIME type setting (mimeType='+this.mimeType+') with default "audio/wav"');

			this.mimeType = 'audio/wav';
		}

		_bytesPerSample = _bitsPerSample / 8;

		if(_bytesPerSample < 1 || _bytesPerSample > 4){
			console.error('invalid setting for bitsPerSample ('+_bitsPerSample+'): supported valus are 8, 16, 24, 32');
		}
	}

	// this.encoderInit = function(config) {
	this.init = function() {

		_state = 'initializing';

		//TODO?
		_recLengthWav = 0;

		_state = 'initialized';
	};

	// this.encodeBuffer = function(buff){
	this.encode = function(buff){

		// if(_state === 'initializing'){
		// 	this._doCache(buff);
		// 	return;
		// }
		// this._doEncodeCached();

		if (this.baseEncoder.resampler) {
			try {
				// samples = this.resampler.process(samples);
				buff = this.baseEncoder.doResample(buff);
			} catch (e) {
				//FIXME send error
				console.error('error resampling audio', e);
				// this.worker.postMessage({
				// 	status: -1,
				// 	reason: e
				// });
				return
			}
		}

		var buffers = [buff];//FIXME

		var bufferLength = buffers[0].length;
		var reducedData = new Uint8Array( bufferLength * _channels * _bytesPerSample );

		var encodeFunc;
		switch ( _bitsPerSample ) {
			case 32: // 32 bits signed
				encodeFunc = _encode32bit;
				break;
			case 24: // 24 bits signed
				encodeFunc = _encode24bit;
				break;
			case 16: // 16 bits signed
				encodeFunc = _encode16bit;
				break;
			case 8: // 8 bits unsigned
				encodeFunc = _encode8bit;
				break;
			default:
				console.error("Only 8, 16, 24 and 32 bits per sample are supported");
				encodeFunc = _encode16bit;
		}

		// data (although for onyl 1 channel is supported)
		for ( var i = 0; i < bufferLength; i++ ) {
			for ( var channel = 0; channel < _channels; channel++ ) {

				var outputIndex = ( i * _channels + channel ) * _bytesPerSample;

				// clip the signal if it exceeds [-1, 1]
				var sample = Math.max(-1, Math.min(1, buffers[ channel ][ i ]));

				// encode
				encodeFunc(sample, reducedData, outputIndex);
			}
		}

		_tempBuffer.push( reducedData );
		_recLengthWav += reducedData.length;
	};


	// this.encoderFinish = function(){
	this.takeEncoded = function(options){

		// this._doEncodeCached();

		var totalBufferSize = _recLengthWav;
		//reset current buffers size
		_recLengthWav = 0;

		//get & reset current buffer content
		var buffers = _tempBuffer.splice(0);

		// var isStreaming = this.baseEncoder.select(options.streaming, streaming);
		var isRaw = (options.resultMode || resultMode) === 'raw';


		if(!_isRawFormat){

			var channelBuffers = [buffers];//NOTE currently only mono audio, i.e. 1 channel

			if(!isRaw){

				return this.encodeWAV(channelBuffers, _channels, _desiredSampleRate, _bitsPerSample, false).buffer;

			} else {

				var header = this.encodeWAV(channelBuffers, _channels, _desiredSampleRate, _bitsPerSample, true);
				var typedArrayConstructor = buffers[0].constructor;
				var binHeader = new typedArrayConstructor(header.buffer);
				buffers.unshift(binHeader);
				return buffers;

			}

		} else {

			return isRaw? buffers : this.baseEncoder.mergeBuffers(buffers, totalBufferSize, buffers[0].constructor);
		}

	};

	this.dropEncoded = function(){
		if(!streaming){
			_tempBuffer.splice(0);
		}
	};

	// this.encoderCleanUp = function(){
	this.finish = function(){

		//FIXME  reset wav encoder if neccessary
		if(!streaming){
			// this.encoderInit();
			this.init();
		}
	};

	function _encode32bit(sample, reducedData, outputIndex) {
		// 32 bits signed
		sample = sample * 2147483647.5 - 0.5;
		reducedData[ outputIndex ] = sample;
		reducedData[ outputIndex + 1 ] = sample >> 8;
		reducedData[ outputIndex + 2 ] = sample >> 16;
		reducedData[ outputIndex + 3 ] = sample >> 24;
	}

	function _encode24bit(sample, reducedData, outputIndex) {
		// 24 bits signed
		sample = sample * 8388607.5 - 0.5;
		reducedData[ outputIndex ] = sample;
		reducedData[ outputIndex + 1 ] = sample >> 8;
		reducedData[ outputIndex + 2 ] = sample >> 16;
	}

	function _encode16bit(sample, reducedData, outputIndex) {
		// 16 bits signed
		sample = sample * 32767.5 - 0.5;
		reducedData[ outputIndex ] = sample;
		reducedData[ outputIndex + 1 ] = sample >> 8;
	}

	function _encode8bit(sample, reducedData, outputIndex) {
		// 8 bits unsigned
		reducedData[ outputIndex ] = (sample + 1) * 127.5;
	}


	// this.interleave = function(inputL, inputR){
	// 	var length = inputL.length + inputR.length;
	// 	var result = new Float32Array(length);
	//
	// 	var index = 0,
	// 		inputIndex = 0;
	//
	// 	while (index < length){
	// 		result[index++] = inputL[inputIndex];
	// 		result[index++] = inputR[inputIndex];
	// 		inputIndex++;
	// 	}
	// 	return result;
	// }
	//
	// this.floatTo16BitPCM = function(output, offset, input){
	// 	for (var i = 0; i < input.length; i++, offset+=2){
	// 		var s = Math.max(-1, Math.min(1, input[i]));
	// 		output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	// 	}
	// 	return output;
	// }

	this.writeString = function(view, offset, string){
		for (var i = 0; i < string.length; i++){
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	}

	/**
	 *
	 * @param  {Array<TypedArray>} samples (channel) list of TypedArrays with the audio data (i.e. samples.length === channels)
	 * @param  {Number} channels number of channels
	 * @param  {Number} sampleRate sample rate for the samples
	 * @param  {Number} bitsPerSample bits per sample (e.g. 8, 16, 24, 32)
	 * @param  {Boolean} [onlyHeader] OPTIONAL if TRUE only the WAV header is created and returned
	 * @return {DataView} the WAV data
	 */
	this.encodeWAV = function(samples, channels, sampleRate, bitsPerSample, onlyHeader){

		var bufferLength = this.baseEncoder.sumLengthOf(samples[0]);
		var elemLength = samples[0].BYTES_PER_ELEMENT;
		var dataLength = samples.length * bufferLength * elemLength;

		var resultBufferLength = onlyHeader? 44 : (44 + dataLength);
		var buffer = new ArrayBuffer(resultBufferLength);
		var view = new DataView(buffer);

		// var channels = mono? 1 : 2;
		// var bitsPerSample = 16;
		var bytesPerSample = bitsPerSample / 8;
		// var length = dataLength * bytesPerSample;//errornous?
		// var length = dataLength * elemLength;

		/* RIFF identifier */
		this.writeString(view, 0, 'RIFF');
		/* file length */
		view.setUint32(4, 36 + dataLength, true);
		/* RIFF type */
		this.writeString(view, 8, 'WAVE');
		/* format chunk identifier */
		this.writeString(view, 12, 'fmt ');
		/* format chunk length */
		view.setUint32(16, 16, true);
		/* sample format (raw) */
		view.setUint16(20, 1, true);
		/* channel count */
		view.setUint16(22, channels, true);
		/* sample rate */
		view.setUint32(24, sampleRate, true);
		/* byte rate (sample rate * block align) */
		view.setUint32(28, sampleRate * channels * bytesPerSample, true);
		/* block align (channel count * bytes per sample) */
		view.setUint16(32, channels * bytesPerSample, true);
		/* bits per sample */
		view.setUint16(34, bitsPerSample, true);
		/* data chunk identifier */
		this.writeString(view, 36, 'data');
		/* data chunk length */
		view.setUint32(40, dataLength, true);

		if(!onlyHeader){
			for (var i = 0; i < samples.length; i++ ) {
				view.set( samples[i], i * bufferLength + 44 );
			}
		}

		return view;
	}

	this.encodedData = _tempBuffer;
	this._init(config);//<- initalize with config param from constructor
}

// //export into global instance variable (see encoder.js for sending/receiving messages on this)
// encoderInstance = new WavEncoder();

if(global.baseEncoder){
	global.baseEncoder.addEncoderFactory(function(config, base){
		return new WavEncoder(config, base);
	});
} else {
	global.WavEncoder = WavEncoder;
}

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);
