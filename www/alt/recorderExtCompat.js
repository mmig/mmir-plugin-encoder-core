;(function (root, factory) {

	//mmir legacy mode: use pre-v4 API of mmir-lib
	var _isLegacyMode3 = true;
	var _isLegacyMode4 = true;
	var mmirName = typeof MMIR_CORE_NAME === 'string'? MMIR_CORE_NAME : 'mmir';
	var _mmir = root[mmirName];
	if(_mmir){
		//set legacy-mode if version is < v4 (isVersion() is available since v4)
		_isLegacyMode3 = _mmir.isVersion? _mmir.isVersion(4, '<') : true;
		_isLegacyMode4 = _mmir.isVersion? _mmir.isVersion(5, '<') : true;
	}
	var _req = _mmir? _mmir.require : require;

	var getId, isArray;
	if(_isLegacyMode3 || _isLegacyMode4){
		isArray = _req((_isLegacyMode3? '': 'mmirf/') + 'util/isArray');
		// HELPER: backwards compatibility v4 for module IDs
		getId = function(ids){
			if(isArray(ids)){
				return ids.map(function(id){ return getId(id);});
			}
			return ids? ids.replace(/\bresources$/, 'constants') : ids;
		};
		var __req = _req;
		_req = function(deps, id, success, error){
			var args = [getId(deps), getId(id), success, error];
			return __req.apply(null, args);
		};
	}

	if(_isLegacyMode3){
		// HELPER: backwards compatibility v3 for module IDs
		var __getId = getId;
		getId = function(ids){
			if(isArray(ids)) return __getId(ids);
			return ids? __getId(ids).replace(/^mmirf\//, '') : ids;
		};
		//HELPER: backwards compatibility v3 for configurationManager.get():
		var config = _req('configurationManager');
		if(!config.__get){
			config.__get = config.get;
			config.get = function(propertyName, useSafeAccess, defaultValue){
				return this.__get(propertyName, defaultValue, useSafeAccess);
			};
		}
	}

	if(_isLegacyMode3 || _isLegacyMode4){

		//backwards compatibility v3 and v4:
		//  plugin instance is "exported" to global var newMediaPlugin
		root['Recorder'] = factory(_req);

	} else {

		if (typeof define === 'function' && define.amd) {
				// AMD. Register as an anonymous module.
				define(['require'], function (require) {
						return factory(require);
				});
		} else if (typeof module === 'object' && module.exports) {
				// Node. Does not work with strict CommonJS, but
				// only CommonJS-like environments that support module.exports,
				// like Node.
				module.exports = factory(_req);
		}
	}

}(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this, function (require) {

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



	

  
    return (function(){
      {

var WORKER_PATH = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? 'mmir-plugin-encoder-core/workers/recorderWorkerExt' : 'mmirf/workers/recorderWorkerExt.js';

var Recorder = function(source, cfg){
		var config = cfg || {};
		var bufferLen = config.bufferLen || 4096;
		var channels = config.channels || 2;
//		this.context = source.context;
//		this.node = this.createScriptProcessor(this.context, bufferLen, 2, 2);
		var worker = typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD? __webpack_require__(config.workerPath || WORKER_PATH)() : new Worker(config.workerPath || WORKER_PATH);
//		worker.postMessage({
//			cmd: 'init',
//			config: {
//				sampleRate: this.context.sampleRate
//			}
//		});
		this.processor = worker;///////////TODO MOD

		var recording = false,
		currCallback;

		var dataListener;//TODO MOD

		var doRecordAudio = function(e){
			if (!recording) return;
			var buffers = new Array(channels);
			for(var i=0; i < channels; ++i){
				buffers[i] = e.inputBuffer.getChannelData(i);
			}
			worker.postMessage({
				cmd: 'record',
				buffer: buffers,
			});
		}

		this._initSource = function(inputSource){

			this.context = inputSource.context;

			//if we already had another input-source before, we need to clean up first:
			if(this.node){
				this.node.disconnect();
			}

			//backwards compatibility: use older createJavaScriptNode(), if new API function is not available
			var funcName = !this.context.createScriptProcessor? 'JavaScriptNode' : 'ScriptProcessor';
			var inputChannels = inputSource.channelCount || 2;//input channels
			var outputChannels = channels;//output channels
			this.node = this.context['create'+funcName](bufferLen, inputChannels, outputChannels);

			this.node.onaudioprocess = doRecordAudio;

			worker.postMessage({
				cmd: 'init',
				config: {
					sampleRate: this.context.sampleRate,
					bufferSize: bufferLen,
					channels: channels,
					isDebug: config.debug
				}
			});

			inputSource.connect(this.node);
			this.node.connect(this.context.destination);
		}

		this.configure = function(cfg, configureWorker){
			if(configureWorker){
				worker.postMessage({
					cmd: 'config',
					config: cfg
				});
			} else {
				for (var prop in cfg){
					if (cfg.hasOwnProperty(prop)){
						config[prop] = cfg[prop];
					}
				}
			}
		}

		this.record = function(source){
			if(source){
				this.init(source);
			}
			recording = true;
		}

		this.stop = function(){
			recording = false;
		}

		this.clear = function(){
			worker.postMessage({ cmd: 'clear' });
		}

		this.getBuffers = function(cb, isListener) {//TODO MOD additional parameter
			//TODO MOD start
			if(isListener === true){
				dataListener = cb;
					worker.postMessage({ cmd: 'getBuffers', id: 'listener' });
			}
			else {//TODO MOD end
				currCallback = cb || config.callback;
					worker.postMessage({ cmd: 'getBuffers' })
			}
		}

		this.exportWAV = function(cb, type){
			currCallback = cb || config.callback;
			type = type || config.type || 'audio/wav';
			if (!currCallback) throw new Error('Callback not set');
			worker.postMessage({
				cmd: 'exportWAV',
				type: type
			});
		}

		this.exportMonoWAV = function(cb, type){
			currCallback = cb || config.callback;
			type = type || config.type || 'audio/wav';
			if (!currCallback) throw new Error('Callback not set');
			worker.postMessage({
				cmd: 'exportMonoWAV',
				type: type
			});
		}

		///////////TODO MOD start
		this.doEncode = function(){
			worker.postMessage({ cmd: 'encode' });
		};

		this.doFinish = function(){
			worker.postMessage({ cmd: 'encClose'});
		};

		this.init = function(source){
			this.destroyed = false;
			this._initSource(source);
		};

		this.release = function(){

			this.stop();
			this.clear();

			if(this.node){
				this.node.disconnect();
				this.node = null;
			}

			this.destroyed = true;
		};
		///////////TODO MOD end

		var selfRef = this;///////////TODO MOD
		worker.onmessage = function(e){

			///////////TODO MOD start
			if(e.data && e.data.cmd === 'encFinished'){
				if(selfRef.onencodefinished){
					selfRef.onencodefinished(e);
				}
				return;
			}

			if(e.data && e.data.cmd === 'fireChunkStored'){
				if(selfRef.onchunkstored){
					selfRef.onchunkstored(null);
				}
				return;
			}


			if(e.data instanceof DataView){
				if(config.isDebug) console.info('received DataView from worker');
				currCallback(e.data);
				return;
			}

			///////////TODO MOD end

			var blob = e.data;
			///////////TODO MOD start
			if(blob.buffers){
				var id = blob.id;
				blob = blob.buffers;
				if(id && id === 'listener' && dataListener){
					dataListener(blob);
				}
				return;
			}
			///////////TODO MOD end

			///////////TODO MOD start
			var result = true;
			if(selfRef.beforeonmessage){
				result = selfRef.beforeonmessage(e);
			}
			if(typeof result !== 'undefined' && !result){
				return;
			}
			///////////TODO MOD end

			currCallback(blob);

		}

//		source.connect(this.node);
//		this.node.connect(this.context.destination);		// if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.

		this._initSource(source);
	};

	Recorder.forceDownload = function(blob, filename){
		var url = (window.URL || window.webkitURL).createObjectURL(blob);
		var link = window.document.createElement('a');
		link.href = url;
		link.download = filename || 'output.wav';
		//MOD start: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
		var click = document.createEvent("MouseEvent");
		click.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		//MOD end
		link.dispatchEvent(click);
	}

	// window.Recorder = Recorder;

	return Recorder;
}
    })();
;


	


}));
