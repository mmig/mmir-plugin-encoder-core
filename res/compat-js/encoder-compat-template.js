
/*
 * compatiblity wrapper for older encoder implementations (targeting API < 1.x)
 */

/*orig-content*/

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
