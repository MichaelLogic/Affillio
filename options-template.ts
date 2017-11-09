import * as _ from 'lodash';

export class OptionsTemplate {
	private _options:any;

	constructor(options:any){

		this._options = options || {};

		if (!_.isObject(this._options) || _.isArray(this._options)) {
			throw new Error('Options template must be initialized with an object');
		}
	}

	/**
	* Returns the current base object deeply extended (merged) by the extender, this does not modify
	* the base object
	* param- {object} Object whose properties will be added to the base object
	* return- {object} POJO created by extending base object with extender
	*/
	build = function (extender:any) {
	  let ext;

	  ext = extender || {};

	  if (!_.isObject(ext) || _.isArray(ext)) {
	    throw new Error('Extender must be an object');
	  }

	  return _.merge(_.cloneDeep(this._options), ext);
	}

	reset = function (options:any) {
	  this._options = options || {};

	  if (!_.isObject(this._options) || _.isArray(this._options)) {
	    throw new Error('Options template must be initialized with an object');
	  }
	}


}