
;(function(global){

var recLength = 0,
		recBuffers = [],
		recBuffersL = [],
		recBuffersR = [],
		sampleRate = -1,
		eosDetected = false,
		bufferSize,
		targetSampleRate,
		resampler;

global.isDebug = false;

global.exportForASR = function(recBuffers, recLength){

		//get raw-data length:
		var totalBufferSize = recLength;

		//reset current buffers size
		recLength = 0;

		//get & reset current buffer content
		var buffers = recBuffers.splice(0, recBuffers.length);

		//convert buffers into one single buffer
		var samples = global.mergeBuffersUint( buffers, totalBufferSize);
		var the_blob = new Blob([samples]);

		return the_blob;
		// return samples;
}


global.record = function(inputBuffer){
		recBuffers.push(inputBuffer);
		recLength += inputBuffer.length;
		if(global.isDebug) console.log("encoder RECORD called!");
	}

global.getMergedBufferLength = function(bufferList){
		var i=0, size = bufferList.length, total=0;
		for(;i < size; ++i){
			total += bufferList[i].length;
		}
		return total;
}

global.mergeBuffersUint = function(channelBuffer, recordingLength){
	recordingLength = getMergedBufferLength(channelBuffer);
	var result = new Uint8Array(recordingLength);
	var offset = 0;
	var lng = channelBuffer.length;
	for (var i = 0; i < lng; i++){
		var buffer = channelBuffer[i];
		result.set(buffer, offset);
		offset += buffer.length;
	}
	//if(global.isDebug) console.log("encoder MERGE called!");
	return result;
}

global.onmessage = function(e) {

	switch (e.data.cmd) {

	case 'init':
		global.init(e.data.config);
		encoderInstance.encoderInit();
		break;
	case 'encode':
		if(global.isDebug) console.debug('encode '+recLength);
		var buffMerged = global.mergeBuffersFloat(recBuffersL, recLength);
		encoderInstance.encodeBuffer(buffMerged);
		global.clear();
		break;
	case 'encClose':
		if(global.isDebug) console.log("encoder finish: ");
		encoderInstance.encoderFinish();
		if(global.isDebug) console.log("encodedExt: "+encoderInstance.encoded.length);
		var data = new Blob([encoderInstance.encoded]);
		encoderInstance.encoderCleanUp();
		global.postMessage({cmd: 'encFinished', buf: data});
		break;
//		from RecWorkExt
	case 'record':

		if(eosDetected){
			eosDetected = false;
			var tmpBuffer = SilenceDetector.loadBuffer();
			if(global.isDebug) console.info("encoder onmessage record loadBuffers");//FIXME DEBUG
			if(e.data.buffer.length === 2){

				if(tmpBuffer && tmpBuffer.length > 0){
					if(global.isDebug) console.log("tmpBuffer1: ", tmpBuffer);//FIXME DEBUG
					for(i=0; i < tmpBuffer.length; i++){
						var _recBuffer = new Array(2);
						_recBuffer[0] = tmpBuffer[i];
						_recBuffer[1] = tmpBuffer[i];
						global.record(_recBuffer);
					}
				}

			} else {
				if(global.isDebug) console.log("tmpBuffer2: ", tmpBuffer);//FIXME DEBUG
				for(i=0; i < tmpBuffer.length; i++){
					global.record(tmpBuffer[i]);
				}
			}
		}

		//buffer audio data
		global.record(e.data.buffer);

		//detect noise (= speech) and silence in audio:
		eosDetected = SilenceDetector.isSilent(e.data.buffer.length == 2? e.data.buffer[0]:e.data.buffer);
		if(global.isDebug) console.log("eosDetected: " + eosDetected);//FIXME DEBUG
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
	}

};

global.init = function(config){
	resampler = null;
	targetSampleRate = void(0);
	sampleRate = config.sampleRate;
	bufferSize = config.bufferSize;
	global.setConfig(config);
}

global.setConfig = function(config){
	if(typeof config.isDebug !== 'undefined'){
		global.isDebug = config.isDebug;
	}
	if(typeof config.targetSampleRate !== 'undefined'){
		targetSampleRate = config.targetSampleRate;
		if(targetSampleRate !== sampleRate){
			resampler = new global.Resampler(sampleRate, targetSampleRate, /*channels: currently only for mono!*/ 1, bufferSize);
		}
	}
}

global.record = function(inputBuffer){
	recBuffersL.push(inputBuffer[0]);
	recBuffersR.push(inputBuffer[1]);
	recLength += inputBuffer[0].length;
}

/** resample sampleRate -> targetSampleRate, @see #setConfig */
global.doResample = function(buffer){
	return resampler? resampler.resample(buffer) : buffer;
}

global.getBuffers = function(id) {

	var buffers = [];
	buffers.push( global.mergeBuffersFloat(recBuffersL, recLength) );
	buffers.push( global.mergeBuffersFloat(recBuffersR, recLength) );

	if(typeof id !== 'undefined'){
		global.postMessage({buffers: buffers, id: id, size: recLength});
	} else {
		buffers.size = recLength;
		global.postMessage(buffers);
	}

}

global.getBuffersFor = function(id) {
	var buffers = [];

	buffers.push( global.mergeBuffersFloat(recBuffersL, recLength) );
	buffers.push( global.mergeBuffersFloat(recBuffersR, recLength) );
	//global.postMessage({buffers: buffers, id: id});
	global.postMessage({buffers: buffers, id: id, size: recLength});
}

global.clear = function(){
	if(global.isDebug) console.debug('clear REC '+recLength);
	recLength = 0;
	recBuffersL = [];
	recBuffersR = [];
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

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);
