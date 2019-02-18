
;(function(global){

var recLength = 0,
    recLengthFlac = 0,
    recBuffers = [],
	recBuffersL = [],
	recBuffersR = [],
	sampleRate=-1; //PB - opti

global.exportForASR = function(recBuffers, recLength){

    //get raw-data length:
    var totalBufferSize = recLength;

    //reset current buffers size
    recLength = 0;

    //get & reset current buffer content
    var buffers = recBuffers.splice(0, recBuffers.length);

    //convert buffers into one single buffer
    var samples = mergeBuffersUint( buffers, totalBufferSize);
    var the_blob = new Blob([samples]);

    return the_blob;
    // return samples;
}


global.record = function(inputBuffer){
	  recBuffers.push(inputBuffer);
	  recLength += inputBuffer.length;
	  console.log("encoder RECORD called!");
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
	//console.log("encoder MERGE called!");
	return result;
}

global.onmessage = function(e) {

	switch (e.data.cmd) {

	case 'init':
		initRec(e.data.config);
		encoderInstance.encoderInit();
		break;
	case 'encode':
		console.warn('encode '+recLength);
		var buffMerged = mergeBuffersFloat(recBuffersL, recLength);
		encoderInstance.encodeBuffer(buffMerged);
		clear();
		break;
	case 'encClose':
		console.log("encoder finish: ");
		encoderInstance.encoderFinish();
		console.log("encodedExt: "+encoderInstance.encoded.length);
		var data = new Blob([encoderInstance.encoded]);
		encoderInstance.encoderCleanUp();
		global.postMessage({cmd: 'encFinished', buf: data});
		break;
//		from RecWorkExt
	case 'record':

		//buffer audio data
		recordRec(e.data.buffer);

		//detect noise (= speech) and silence in audio:
		SilenceDetector.isSilent(e.data.buffer.length == 2? e.data.buffer[0]:e.data.buffer);

		break;
	case 'getBuffers':
		getBuffers(e.data? e.data.id : void(0));//MOD use id-property as argument, if present
		break;
	case 'clear':
		clear();
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

//Rec
global.initRec = function(config){
  sampleRate = config.sampleRate;
}

global.recordRec = function(inputBuffer){
  recBuffersL.push(inputBuffer[0]);
  recBuffersR.push(inputBuffer[1]);
  recLength += inputBuffer[0].length;
}

global.getBuffers = function(id) {

  var buffers = [];
  buffers.push( mergeBuffersFloat(recBuffersL, recLength) );
  buffers.push( mergeBuffersFloat(recBuffersR, recLength) );

  if(typeof id !== 'undefined'){
    global.postMessage({buffers: buffers, id: id, size: recLength});
  } else {
    buffers.size = recLength;
    global.postMessage(buffers);
  }

}

global.getBuffersFor = function(id) {
	var buffers = [];

	buffers.push( mergeBuffersFloat(recBuffersL, recLength) );
	buffers.push( mergeBuffersFloat(recBuffersR, recLength) );
	//global.postMessage({buffers: buffers, id: id});
	global.postMessage({buffers: buffers, id: id, size: recLength});
}

global.clear = function(){
  console.debug('clear REC '+recLength);
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
