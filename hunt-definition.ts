/**
* @class HuntDefinition
* @author Michael Logic™
* @requires HuntingTools, Hunt
*/

import * as _ from 'lodash';
import { HuntingTools } from './tools';
import { Hunt } from './hunt';

export class HuntDefinition {
	private __id: string;
	private __config: any;
	private __main: any;
	private __builder: any;
	private tools: HuntingTools;

	constructor(id:string){

  		this.__id = id;

		this.__config = {
			hooks: {
			  onFail: null,
			  onSuccess: null
			}
		};

  		this.__main = null;

		this.__builder = () => {
			return {};
		};

	}

	build = (builderParams:any, cookieJar:any, mission:any) => {
	  let thisBuild, paramSets, hunts, hunt;

	  thisBuild = this;

	  if (!_.isFunction(this.__main)) {
	    throw new Error('Cannot build hunt with no main method set');
	  }

	  hunts = [];
	  paramSets = this.tools.makeArray(this.__builder(builderParams));

	  _.each(paramSets, function (paramSet) {
	    hunt = new Hunt(thisBuild.__id, thisBuild.__main, paramSet, cookieJar, thisBuild.__config, mission);
	    hunts.push(hunt);
	  });

	  return hunts;
	}

	hooks = (hooks:any) => {
	  if (!_.isObject(hooks) || _.isArray(hooks)) {
	    throw new Error('Hooks argument must be an object');
	  }

	  this.__config.hooks = hooks;

	  return this;
	}

	/**
	* Sets main hunt's method
	* param - {function} mainMethod main hunt method, this contains the scraping logic that makes a hunt
	* unique
	*/
	main = (mainMethod:any) => {
	  if (!_.isFunction(mainMethod)) {
	    throw new Error('Main method must be a function');
	  }
	  this.__main = mainMethod;

	  return this;
	}

	builder = (builderMethod) => {
	  if (!_.isFunction(builderMethod)) {
	    throw new Error('Builder must be a function');
	  }
	  this.__builder = builderMethod;

	  return this;
	};


}