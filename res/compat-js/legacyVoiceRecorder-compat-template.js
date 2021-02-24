
/*
 * compatiblity wrapper for older plugin implementations (targeting API < 1.x)
 */

define(['./voiceRecorder.js'], function(Recorder){

	function RecorderCompat(){

		Recorder.apply(this, arguments);

		var selfRef = this;

		//NOTE _doRecordAudio() will not be invoked in context of the recorder
		//     (i.e. the this-context will not be the recorder within this function)
		this.__doRecordAudio = this._doRecordAudio;
		this._doRecordAudio = function(){

			// invoke original function
			selfRef.__doRecordAudio.apply(this, arguments);

			//backwards compatiblity (NOTE may be used by plugin implementations)
			if(selfRef.onchunkstored && __selfRef.state === 'recroding'){
				selfRef.onchunkstored(null);
			}

		};

		this.processor.__onmessage = this.processor.onmessage
		this.processor.onmessage = function(evt){

			// invoke original function
			this.__onmessage(evt);

			var msg = evt.data;
			if(msg.source === 'encoder' && selfRef.onencodefinished && msg.message === 'data'){

				//backwards compatiblity (NOTE was only used by webAudioInput)
				var params = msg.data.params;
				if(params && params.finish){
					selfRef.onencodefinished(evt);
				}

			}

		};

		/** @depracated must apply configuration via constructor! */
		this.configure = function(cfg, configureWorker){
			console.warn('called non-function Recorder.configure('+(configureWorker? 'worker' : 'recorder')+') with', cfg);
		};

		/** @depracated should use `start()` instead */
		this.record = function(source){
			if(source){
				this._initSource(source);
			}
			this.start();
		};

		/** @deprecated non functional */
		this.getBuffers = function(_cb, _isListener) {
			//TODO could be implemented via requestData() and listening to corresponding dataavailable event
			console.warn('called non-function Recorder.getBuffers()');
		}

		/** @deprecated non functional */
		this.exportWAV = function(_cb, _type){
			//TODO could be implemented via requestData() and listening to corresponding dataavailable event
			console.warn('called non-function Recorder.exportWAV()');
		}

		/** @deprecated non functional */
		this.exportMonoWAV = function(_cb, _type){
			//TODO could be implemented via requestData() and listening to corresponding dataavailable event
			console.warn('called non-function Recorder.exportMonoWAV()');
		}


		/** @deprecated not necessary any more (should be configured via encodingMode or streaming) */
		this.doEncode = function(){
			console.warn('called non-function Recorder.doEncode()');
		};

		/** @deprecated should use {@link #requestData}({finish: true}) */
		this.doFinish = function(){
			console.warn('called non-function Recorder.doFinish()');
			this.requestData({finish: true});
		};

		return this;
	}

	return RecorderCompat;
});
