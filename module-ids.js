var _id = "mmir-plugin-encoder-core";
var _paths = {
  "mmir-plugin-encoder-core/encoder": "www/encoder.js",
  "mmir-plugin-encoder-core/recorderExt": "www/recorderExt.js",
  "mmir-plugin-encoder-core/silenceDetector": "www/silenceDetector.js",
  "mmir-plugin-encoder-core/webAudioInput": "www/webAudioInput.js",
  "mmir-plugin-encoder-core/workers/recorderWorkerExt": "www/webworker/recorderWorkerExt.js",
  "mmir-plugin-encoder-core": "www/webAudioInput.js"
};
var _workers = [
  "mmir-plugin-encoder-core/workers/recorderWorkerExt"
];
var _exportedModules = [
  "mmir-plugin-encoder-core"
];
var _dependencies = [];
function _join(source, target, dict){
  source.forEach(function(item){
    if(!dict[item]){
      dict[item] = true;
      target.push(item);
    }
  });
};
function _getAll(type, isResolve){

  var data = this[type];
  var isArray = Array.isArray(data);
  var result = isArray? [] : Object.assign({}, data);
  var dupl = result;
  if(isArray){
    dupl = {};
    _join(data, result, dupl);
  } else if(isResolve){
    var root = __dirname;
    Object.keys(result).forEach(function(field){
      result[field] = root + '/' + result[field];
    });
  }
  this.dependencies.forEach(function(dep){
    var depExports = require(dep + '/module-ids.js');
    var depData = depExports.getAll(type, isResolve);
    if(isArray){
      _join(depData, result, dupl);
    } else {
      Object.assign(result, depData)
    }
  });

  return result;
};
module.exports = {id: _id, paths: _paths, workers: _workers, modules: _exportedModules, dependencies: _dependencies, getAll: _getAll};
