import * as _ from 'lodash';
import * as q from 'q';
import { RequestWrap } from './request-wrap';


export class Hunt {
	public huntId: string;
	public startTime: any;
	public endTime: any;
	public elapsedTime: any;
	private __config: any;
	private __runs: number;
	private __mission: any;
	private __runningDeferred: any;
	private __main: any;
	private __requestWrap: RequestWrap;
	private __savedJar: any;
	private __defaultCookies: any;
	private __currentParams: any;
	private _runningPromise: any;
	private _params: any;
	private _sharedStorage: any;

  constructor(huntId:string, main:any, params:any, defaultCookies:any, config:any, mission:any) {
  	/** Id of the hunt's hunt definition */
  	this.huntId = huntId;

  	/** Time at which the hunt started running */
  	this.startTime = null;

  	/** Time at which the hunt finished running */
  	this.endTime = null;

  	/** Time the hunt spent running */
  	this.elapsedTime = null;
  	
  	this.__config = config;

  	this.__runs = 0;

  	this.__mission = mission;

  	this.__runningDeferred = q.defer();

  	this.__main = main;

  	this.__savedJar = null;

  	this.__defaultCookies = defaultCookies;

  	this._runningPromise = this.__runningDeferred.promise;

  	this._params = params;

  	this._sharedStorage = {};

  	// Instance a new Http object
  	this.__requestWrap = new RequestWrap(this.__defaultCookies);
  	// Set current instance params
  	this.__currentParams = this._params;

  }

	onFinish =() => {
		this.endTime = Date.now();
		this.elapsedTime = this.endTime - this.startTime;
	}

	/**
	* Called by the hunt's emitter object, it exposes a key with its value to be used in another hunt
	* later on
	* param - {string} key Key by which the value will be shared
	* param - value A value which will be shared
	* param - {object} options Object of options for sharing
	*/
	onShare = (key, value, options) => {
	  let current, shareMethod, shareMethodFunction;

	  if (options) {
	    shareMethod = options.method;
	  }

	  if (value === undefined) {
	    throw new Error('Missing key/value in share method call');
	  }

	  if (!shareMethod) {
	    shareMethod = 'default';
	  }

	  if (_.isString(shareMethod)) {
	    //shareMethodFunction = this.__job._scraper._shareMethods[shareMethod];
	    console.log("Bad scraper logic");
	  } else {
	    shareMethodFunction = shareMethod;
	  }

	  if (!shareMethodFunction) {
	    throw new Error('Share method doesn\'t exist.');
	  }

	  if (!_.isFunction(shareMethodFunction)) {
	    throw new Error('Share method is not a function');
	  }

	  current = this.__mission.getShared(this.huntId, key);
	  this.__mission.setShared(this.huntId, key, shareMethodFunction(current, value));
	};

	/**
	* Called in the hunt's main method when the hunt ended successfuly
	* param - response Data retrieved by the hunt
	*/
	onSuccess = (data) => {
	  let hookMessage, response, stopMission;

	  stopMission = false;

	  // Response object to be provided to the promise
	  response = {
	    data: data,
	    hunt: this,
	    status: 'success',
	    savedCookieJar: this.__savedJar
	  };

	  // Object passed to the hook for execution control and providing useful data
	  hookMessage = {
	    stopMission: function () {
	      stopMission = true;
	    },
	    data: response.data
	  };

	  if (_.isFunction(this.__config.hooks.onSuccess)) {
	    this.__config.hooks.onSuccess(hookMessage);
	  }

	  this.onFinish();

	  if (stopMission) {
	    this.__runningDeferred.reject(response);
	  } else {
	    this.__runningDeferred.resolve(response);
	  }

	  console.log("Success Mission >>  ", data);
	};

	onSaveCookies = () => {
	  // TODO: Accept custom jar as parameter
	  let jar;
	  jar = this.__requestWrap.getCookieJar();
	  this.__savedJar = jar;

	};

	/**
	* Called by the hunt's main method when an error ocurred
	* param - {Error} error Error object with stracktrace and everything
	* param - {string} message Message explaining what failed
	* private - 
	*/
	onFail = (error:any, message:any) => {
	  let response, hookMessage, rerunHunt, rerunParams;

	  response = {
	    error: error,
	    message: message,
	    hunt: this,
	    status: 'fail',
	    requestLog: this.__requestWrap.getLog()
	  };

	  hookMessage = {
	    error: error,
	    runs: this.__runs,
	    rerun: function (newParams) {
	      rerunHunt = true;
	      rerunParams = newParams;
	    },
	    params: this.__currentParams
	  };

	  if (_.isFunction(this.__config.hooks.onFail)) {
	    this.__config.hooks.onFail(hookMessage);
	  }

	  if (rerunHunt) {
	    this.rerunHunt(rerunParams);
	  } else {
	    this.onFinish();
	    this.__runningDeferred.reject(response);
	  }
	};


	resetHunt = () => {
	  this.__savedJar = null;
	  this.__requestWrap = new RequestWrap(this.__defaultCookies);
	  this._sharedStorage = {};
	};

	rerunHunt = (params) => {
	  this.resetHunt();
	  this.__currentParams = params || this._params;
	  this.run();
	};

	run = () => {
	  var emitter = {
	    success: this.onSuccess.bind(this),
	    fail: this.onFail.bind(this),
	    share: this.onShare.bind(this),
	    saveCookies: this.onSaveCookies.bind(this)
	  };

	  this.startTime = this.__runs === 0 ? Date.now() : this.startTime;
	  this.__runs += 1;
	  this.__main(emitter, this.__requestWrap, this.__currentParams);
	};

  
}