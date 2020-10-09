/*
 * License (MIT)
 *
 * modifications:
 *	Copyright (c) 2013-2020 DFKI GmbH, Deutsches Forschungszentrum fuer Kuenstliche Intelligenz (German Research Center for Artificial Intelligence), https://www.dfki.de
 *
 * based on
 *	Copyright (C) 2013 Matt Diamond (MIT License)
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
}	else {
	importScripts('silenceDetector.js');
	importScripts('resampler.js');
}

;(function(global){

var recLength = 0,
	recordingBuffers = [],
	sampleRate = -1,
	channels = -1,
	eosDetected = false,
	bufferSize,
	targetSampleRate,
	resampler,
	format = 'wav';// 'wav' | 'pcm'

global.isDebug = false;

global.onmessage = function(e){
	switch(e.data.cmd){
		case 'init':
			global.init(e.data.config);
			break;
		case 'exportWAV':
			global.exportWAV(e.data.type);
			break;
		case 'exportMonoWAV':
			global.exportMonoWAV(e.data.type);
			break;
	//MODIFICATIONs russa:
	case 'config':
		global.setConfig(e.data.config);
		break;
	// case 'encode':
	// 	if(global.isDebug) console.debug('encode WAV'+recLength);
	// 	break;
	case 'encClose':
		if(global.isDebug) console.log("encoder WAV finish: ");

		var data;
		if(format === 'pcm') {
			data = global.doEncodeMonoPCM();//<- DataView
			data = new Int16Array(data.buffer);
		} else {
			if(format !== 'wav') {
				console.warn('unknow encoding format requested: ', format)
			}
			data = global.doEncodeWAV();//<- Blob
		}

		global.clear();
		global.postMessage({cmd: 'encFinished', buf: data});
		break;
	case 'record':

		if(eosDetected){
			eosDetected = false;
			//-> EOS detected: first add last few cached audio-buffers, before recording the new one
			var tmpBuffer = SilenceDetector.loadBuffer();
			if(e.data.buffer.length === 2){

				if(tmpBuffer && tmpBuffer.length > 0){
					for(i=0; i < tmpBuffer.length; i++){
						var _recBuffer = new Array(2);
						_recBuffer[0] = tmpBuffer[i];
						_recBuffer[1] = tmpBuffer[i];
						global.record(_recBuffer);
					}
				}

			} else {
				for(i=0; i < tmpBuffer.length; i++){
					global.record(tmpBuffer[i]);
				}
			}
		}

		//buffer audio data
		global.record(e.data.buffer);

		//detect noise (= speech) and silence in audio:
		eosDetected = SilenceDetector.isSilent(e.data.buffer[0]);
		self.postMessage({cmd: 'fireChunkStored'});

		break;
	case 'getBuffers':
		global.getBuffers(e.data? e.data.id : void(0));//MOD use id-property as argument, if present
		break;
	case 'clear':
		global.clear();
		break;
	//////////////////////// silence detection / processing:
	case 'initDetection':
	case 'isSilent':
	case 'start':
	case 'stop':
		SilenceDetector.exec(e.data.cmd, e.data);
		break;
		////////////////////////MOD end
	}
};

global.init = function(config){
	resampler = null;
	targetSampleRate = void(0);
	sampleRate = config.sampleRate;
	bufferSize = config.bufferSize;
	channels = config.channels;
	global.setConfig(config);
	global.clear();
}

global.setConfig = function(config){
	if(typeof config.isDebug !== 'undefined'){
		global.isDebug = config.isDebug;
	}
	if(typeof config.targetSampleRate !== 'undefined'){
		targetSampleRate = config.targetSampleRate;
		if(targetSampleRate !== sampleRate){
			// -> create resampler instance if neccessary
			if(!resampler || resampler.sourceSampleRate !== sampleRate || resampler.targetSampleRate !== targetSampleRate){
				resampler = new global.Resampler(sampleRate, targetSampleRate, /*channels: currently only for mono!*/ 1, bufferSize);
				resampler.sourceSampleRate = sampleRate;
				resampler.targetSampleRate = targetSampleRate;
			}
		} else {
			// -> remove existing resample, if one exists
			resampler = null;
		}
	} else {
		// -> remove existing resample, if one exists
		resampler = null;
	}
	if(typeof config.format !== 'undefined'){
		format = config.format;
	}
}

global.record = function(inputBuffer){
	var len = inputBuffer.length;
	recordingBuffers[0].push(inputBuffer[0]);
	if(len > 1){
		recordingBuffers[1].push(inputBuffer[1]);
		if(len > 2){
			console.warn('RecorderWorker: can only record max. 2 channels, ignoring other '+(len-2)+' channel(s)' );
		}
	}
	recLength += inputBuffer[0].length;
}

global.calcLength = function(recBuffers){
	var len = 0;
	for(var i=recBuffers.length - 1; i >= 0; --i) len += recBuffers[i].length;
	return len;
}

/**
 * @param  {Boolean} [forceMono] OPTIONAL
 * @return {DataView} WAV audio
 */
global.doEncodeWAV = function(forceMono){
	var len = recordingBuffers.length;
	var bufferL = global.doResample(global.mergeBuffersFloat(recordingBuffers[0], recLength));
	var bufferR, mono = true;
	if(!forceMono && len > 1){
		mono = flase;
		bufferR = global.doResample(global.mergeBuffersFloat(recordingBuffers[1], recLength));
		if(len > 2){
			console.warn('RecorderWorker: can only create WAV with max. 2 channels, ignoring other '+(len-2)+' channel(s)' );
		}
	}
	var interleaved = mono? bufferL : global.interleave(bufferL, bufferR);
	return global.encodeWAV(interleaved, mono);
}

/**
 * @return {DataView} (mono) PCM audio (16bit format)
 */
global.doEncodeMonoPCM = function(){
		var bufferL = global.mergeBuffersFloat(recordingBuffers[0], recLength);
		var channelBuffer = global.doResample(bufferL);
		var buffer = new ArrayBuffer(channelBuffer.length * 2);
		var view = new DataView(buffer);
		return global.floatTo16BitPCM(view, 0, channelBuffer);
}

/**
 * posts recorded audio as WAV Blob
 * @param  {String} [type] the MIME type (DEFAULT: 'audio/wav')
 * @param  {Boolean} [forceMono] OPTIONAL
 */
global.exportWAV = function(type, forceMono){
	type = type || 'audio/wav';
	var dataview = global.doEncodeWAV(forceMono);
	var audioBlob = new Blob([dataview], { type: type });

	global.postMessage(audioBlob);
}

/**
 * posts recorded audio as mono WAV Blob
 * @param  {String} [type] the MIME type (DEFAULT: 'audio/wav')
 */
global.exportMonoWAV = function(type){
	type = type || 'audio/wav';
	var dataview = global.doEncodeWAV(true);
	var audioBlob = new Blob([dataview], { type: type });

	global.postMessage(audioBlob);
}

/**
 * posts recorded audio as mono PCM DataView
 */
global.exportMonoPCM = function(){
		var view = global.doEncodeMonoPCM();
		this.postMessage(view);
}

/** resample sampleRate -> targetSampleRate, @see #setConfig */
global.doResample = function(buffer){
	return resampler? resampler.resampler(buffer) : buffer;
}

/**
 * trigger message that sends the currently buffered (raw) audio
 *
 * @param [id] OPTIONAL
 * 		the transaction ID (if provided, the ID will be included in the sent message)
 */
global.getBuffers = function(id) {

	var len = recordingBuffers.length;
	var buffers = new Array(len);
	for(var i=0; i < len; ++i){
		buffers.push( global.mergeBuffersFloat(recordingBuffers[i], recLength) );
	}

	if(typeof id !== 'undefined'){
		global.postMessage({buffers: buffers, id: id, size: recLength});
	} else {
		buffers.size = recLength;
		global.postMessage(buffers);
	}

}

global.clear = function(){
	recLength = 0;
	recordingBuffers = new Array(channels);
	for(var i=0; i < channels; ++i){
		recordingBuffers[i] = [];
	}
}

global.mergeBuffersFloat = function(recBuffers, recLength){
	var result = new Float32Array(recLength);
	var offset = 0;
	for (var i = 0; i < recBuffers.length; i++){
		result.set(recBuffers[i], offset);
		offset += recBuffers[i].length;
	}
	return result;
}

global.interleave = function(inputL, inputR){
	var length = inputL.length + inputR.length;
	var result = new Float32Array(length);

	var index = 0,
		inputIndex = 0;

	while (index < length){
		result[index++] = inputL[inputIndex];
		result[index++] = inputR[inputIndex];
		inputIndex++;
	}
	return result;
}

global.floatTo16BitPCM = function(output, offset, input){
	for (var i = 0; i < input.length; i++, offset+=2){
		var s = Math.max(-1, Math.min(1, input[i]));
		output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	}
	return output;
}

global.writeString = function(view, offset, string){
	for (var i = 0; i < string.length; i++){
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

global.encodeWAV = function(samples, mono){

	var buffer = new ArrayBuffer(44 + samples.length * 2);
	var view = new DataView(buffer);

	var channels = mono? 1 : 2;
	var bitsPerSample = 16;
	var bytesPerSample = bitsPerSample / 8;
	var length = samples.length * bytesPerSample;

	/* RIFF identifier */
	this.writeString(view, 0, 'RIFF');
	/* file length */
	view.setUint32(4, 32 + length, true);
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
	view.setUint32(40, length, true);

	this.floatTo16BitPCM(view, 44, samples);

	return view;
}

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);
