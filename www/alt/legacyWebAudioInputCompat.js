
/*
 * factory for adding compatiblity layer (functions / hooks / fields)
 * for older plugin implementations (targeting API < 1.x)
 */

define(['mmirf/util/extend', 'mmirf/util/toArray'], function(extend, toArray){

	//HELPER create backwards compatible SilenceDetection hook function wrappers
	//       that inject success/failure callbacks as 2nd/3rd argument
	function wrapDetectionHook(func){
		return function(evt){
			// do call with old signature: (event, successCallback, errorCallback):
			func.call(this, evt, this.__currentSuccessCallback, this.__currentFailureCallback);
		}
	}

	return {

		addCompatibilityLayer: function (pluginInstance, stopUserMedia){

			if(pluginInstance._compatiblityApplied){
				return;
			}

			pluginInstance._compatiblityApplied = true;

			// replaced hooks for plugin impl.
			if(pluginInstance.initRec){

				pluginInstance.onstart = function _compatInitRec(evt){
					pluginInstance.initRec(evt.recorder);
				};

			}

			// if exposed callback hook setCallbacks() request the old signature
			//  (i.e. 4 arguments instead of 3), attach replacemnt that injects stopUserMedia function
			var hasSetCallbacks = false;
			if(pluginInstance.setCallbacks && pluginInstance.setCallbacks.length > 3){
				hasSetCallbacks = true;
				pluginInstance.__setCallbacks = pluginInstance.setCallbacks;
				pluginInstance.setCallbacks = function _compatSetCallbacks(){
					var args = toArray(arguments);
					this.__currentSuccessCallback = args[0];
					this.__currentFailureCallback = args[1];
					args[3] = args[2];
					args[2] = stopUserMedia;
					this.__setCallbacks.apply(this, args);
				};
			}

			// attach backwards compatible implementation for setLastResult() & resetLastResult(), if necessary
			if(!pluginInstance.setLastResult){
				pluginInstance.setLastResult = function _dummySetLastResult(_isLast){};
			} else if(pluginInstance.setLastResult && pluginInstance.setLastResult.length === 0){
				pluginInstance.__setLastResult = pluginInstance.setLastResult;
				pluginInstance.setLastResult = function _compatSetLastResult(isLast){
					if(isLast){
						this.__setLastResult();
					} else {
						this.resetLastResult && this.resetLastResult();
					}
				};
			}

			// add new mandatory hook setCanceled(), if necessary:
			if(!pluginInstance.setCanceled){
				pluginInstance.setCanceled = pluginInstance.setLastResult? function _compatSetCanceled(isLast){
					if(isLast){
						this.__setLastResult(true);
					}
				} : function(){};
			}

			// replaced hooks for silence detection

			var hasDectRepl = false;//<- flag indicating if any detection hooks were "re-routed"

			if(pluginInstance.onsendpart){
				hasDectRepl = true;
				// recorder.onoverflow = pluginInstance.onsendpart;
				pluginInstance.onoverflow = wrapDetectionHook(pluginInstance.onsendpart);
			}

			if(pluginInstance.onsilencedetected){
				hasDectRepl = true;
				var onsilencedetected = wrapDetectionHook(pluginInstance.onsilencedetected);
				pluginInstance.onspeechend = onsilencedetected;
				pluginInstance.onsoundend = onsilencedetected;
			}

			if(pluginInstance.onnoisedetected){
				hasDectRepl = true;
				// recorder.onspeechstart = pluginInstance.onnoisedetected;
				// recorder.onsoundstart = pluginInstance.onnoisedetected;
				var onnoisedetected = wrapDetectionHook(pluginInstance.onnoisedetected);
				pluginInstance.onspeechstart = onnoisedetected;
				pluginInstance.onsoundstart = onnoisedetected;
			}

			if(pluginInstance.onclear){
				hasDectRepl = true;
				// recorder.onsilent = pluginInstance.onclear;
				pluginInstance.onsilent = wrapDetectionHook(pluginInstance.onclear);
			}

			if(pluginInstance.oninit){
				hasDectRepl = true;
				// recorder.ondetectioninitialized = pluginInstance.oninit;
				pluginInstance.ondetectioninitialized = wrapDetectionHook(pluginInstance.oninit);
			}

			if(pluginInstance.onstarted){
				hasDectRepl = true;
				// recorder.ondetectionstart = pluginInstance.onstarted;
				pluginInstance.ondetectionstart = wrapDetectionHook(pluginInstance.onstarted);
			}

			if(pluginInstance.onaudiostarted){
				hasDectRepl = true;
				// recorder.on'Silence Detection Audio started' = pluginInstance.onaudiostarted;

				//WARNING this is a WORKAROUND for the removed recorder.ondetectionstart hook:
				//        "rerouted" ondetectionstart to ondetectionstart?
				//        (onaudiostarted would be triggered after some few audio chunks were processed)
				if(pluginInstance.ondetectionstart){
					//HACK if there is already an event handler, create "proxy function" that triggers both
					pluginInstance.__ondetectionstart = pluginInstance.ondetectionstart;
					pluginInstance.onaudiostarted = wrapDetectionHook(pluginInstance.onaudiostarted);
					pluginInstance.ondetectionstart = function _compatOnDetectionOnAudioStarted(){
						this.__ondetectionstart.apply(this, arguments);
						this.onaudiostarted.apply(this, arguments);
					};
				} else {
					pluginInstance.ondetectionstart = wrapDetectionHook(pluginInstance.onaudiostarted);
				}

			}

			if(pluginInstance.onstopped){
				hasDectRepl = true;
				// recorder.ondetectionend = pluginInstance.onstopped;
				pluginInstance.ondetectionend = wrapDetectionHook(pluginInstance.onstopped);
			}

			if(!hasSetCallbacks && hasDectRepl) {
				// do inject implemenation for storing callbacks when detection-hooks were re-routed
				pluginInstance.__setCallbacks = pluginInstance.setCallbacks;
				pluginInstance.setCallbacks = function _compatSetCallbacksArgs(){
					this.__currentSuccessCallback = arguments[0];
					this.__currentFailureCallback = arguments[1];
					this.__setCallbacks.apply(this, arguments);
				};
			}

		},
		addCompatibilityModuleMappings: function(defaultWorkerImpl, workerImpl){

			// add mappings (to default encoder) for deprecated plugin modules
			extend(defaultWorkerImpl, {
					'asrnuancews.js':   workerImpl.speex,
					'asrnuancexhr.js':   workerImpl.amr,

					'webasratntimpl.js':     workerImpl.amr,
					'webasrgooglev1impl.js': workerImpl.wav,

					'mmir-plugin-asr-nuance-ws.js':   workerImpl.speex,
					'mmir-plugin-asr-nuance-xhr.js':   workerImpl.amr,
			});
		},
		// create fallback event emitter function in case mediaManager._emitEvent() is not supported (otherwise return original impl.)
		createMediaManagerEventEmitter: function(currentEventEmitterImplemention, mediaManager){

			return mediaManager._emitEvent? currentEventEmitterImplemention : function(eventName, _args) {
					var size = arguments.length;
					var argList = new Array(size - 1);
					for(var i = 1; i < size; ++i){
						argList[i - 1] = arguments[i];
					}
					mediaManager._fireEvent(eventName, argList);
			};
		}
	};
});
