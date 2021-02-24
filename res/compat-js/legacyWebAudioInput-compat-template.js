
/*
 * factory for adding compatiblity layer (functions / hooks / fields)
 * for older plugin implementations (targeting API < 1.x)
 */

define(['mmirf/util/extend'], function(extend){

	return {

		addCompatibilityLayer: function (pluginInstance){

			if(pluginInstance._compatiblityApplied){
				return;
			}

			pluginInstance._compatiblityApplied = true;

			// replaced hooks for plugin impl.
			if(pluginInstance.initRec){

				pluginInstance.onstart = function(evt){
					pluginInstance.initRec(evt.recorder);
				};

			}

			// replaced hooks for silence detection

			if(pluginInstance.onsendpart){
				// recorder.onoverflow = pluginInstance.onsendpart;
				pluginInstance.onoverflow = pluginInstance.onsendpart;
			}

			if(pluginInstance.onsilencedetected){
				pluginInstance.onspeechend = pluginInstance.onsilencedetected;
				pluginInstance.onsoundend = pluginInstance.onsilencedetected;
			}

			if(pluginInstance.onnoisedetected){
				// recorder.onspeechstart = pluginInstance.onnoisedetected;
				// recorder.onsoundstart = pluginInstance.onnoisedetected;
				pluginInstance.onspeechstart = pluginInstance.onnoisedetected;
				pluginInstance.onsoundstart = pluginInstance.onnoisedetected;
			}

			if(pluginInstance.onclear){
				// recorder.onsilent = pluginInstance.onclear;
				pluginInstance.onsilent = pluginInstance.onclear;
			}

			if(pluginInstance.oninit){
				// recorder.ondetectioninitialized = pluginInstance.oninit;
				pluginInstance.ondetectioninitialized = pluginInstance.oninit;
			}

			if(pluginInstance.onstarted){
				// recorder.ondetectionstart = pluginInstance.onstarted;
				pluginInstance.ondetectionstart = pluginInstance.onstarted;
			}

			if(pluginInstance.onaudiostarted){
				// recorder.on'Silence Detection Audio started' = pluginInstance.onaudiostarted;

				//WARNING this is a WORKAROUND for the removed recorder.ondetectionstart hook:
				//        "rerouted" ondetectionstart to ondetectionstart?
				//        (onaudiostarted would be triggered after some few audio chunks were processed)
				if(pluginInstance.ondetectionstart){
					//HACK if there is already an event handler, create "proxy function" that triggers both
					pluginInstance.__ondetectionstart = pluginInstance.ondetectionstart;
					pluginInstance.ondetectionstart = function(){
						pluginInstance.__ondetectionstart.apply(this, arguments);
						pluginInstance.onaudiostarted.apply(this, arguments);
					};
				} else {
					pluginInstance.ondetectionstart = pluginInstance.onaudiostarted;
				}

			}

			if(pluginInstance.onstopped){
				// recorder.ondetectionend = pluginInstance.onstopped;
				pluginInstance.ondetectionend = pluginInstance.onstopped;
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
