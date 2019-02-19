/*
 *  License (MIT)
 *
 * modifications:
 *
 * 	Copyright (C) 2015-2016 DFKI GmbH
 * 	Deutsches Forschungszentrum fuer Kuenstliche Intelligenz
 * 	German Research Center for Artificial Intelligence
 * 	http://www.dfki.de
 *
 * based on
 * 	Copyright (C) 2013 Matt Diamond (MIT License)
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

/**
 * @module workers/recorderExt
 *
 * TODO refactor to use (duplicate) functionality in encoder.js (and remove it here!)
 */


if(typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD){
  require('../silenceDetector.js');
  require('../resampler.js');
}  else {
  importScripts('silenceDetector.js');
  importScripts('resampler.js');
}

;(function(global){

var recLength = 0,
  recBuffersL = [],
  recBuffersR = [],
  sampleRate,
  bufferSize,
  targetSampleRate,
  resampler;

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
	case 'record':

		//buffer audio data
		global.record(e.data.buffer);

		//detect noise (= speech) and silence in audio:
		SilenceDetector.isSilent(e.data.buffer.length == 2? e.data.buffer[0]:e.data.buffer);

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

global.exportWAV = function(type){
  var bufferL = global.mergeBuffersFloat(recBuffersL, recLength);
  var bufferR = global.mergeBuffersFloat(recBuffersR, recLength);
  var interleaved = global.interleave(bufferL, bufferR);
  var dataview = global.encodeWAV(interleaved);
  var audioBlob = new Blob([dataview], { type: type });

  global.postMessage(audioBlob);
}

global.exportMonoWAV = function(type){

  var bufferL = global.mergeBuffersFloat(recBuffersL, recLength);
  var dataview = global.encodeWAV(global.doResample(bufferL), true);
  // global.clear();
  var audioBlob = new Blob([dataview], { type: type });

  global.postMessage(audioBlob);
}

global.exportMonoPCM = function(type){
	  var bufferL = global.mergeBuffersFloat(recBuffersL, recLength);
	  var channelBuffer = global.doResample(bufferL);
	  // this.clear();
	  var buffer = new ArrayBuffer(channelBuffer.length * 2);
	  var view = new DataView(buffer);
	  global.floatTo16BitPCM(view, 0, channelBuffer);

	  this.postMessage(view);
}

/** resample sampleRate -> targetSampleRate, @see #setConfig */
global.doResample = function(buffer){
	return resampler? resampler.resample(buffer) : buffer;
}

/**
 * trigger message that sends the currently buffered (raw) audio
 *
 * @param [id] OPTIONAL
 * 		the transaction ID (if provided, the ID will be included in the sent message)
 */
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

global.clear = function(){
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
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 32 + length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
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
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  floatTo16BitPCM(view, 44, samples);

  return view;
}

})(typeof window !== 'undefined'? window : typeof self !== 'undefined'? self : typeof global !== 'undefined'? global : this);
