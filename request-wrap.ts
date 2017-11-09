import * as _ from 'lodash';
import * as q from 'q';
import { OptionsTemplate } from './options-template';
import { afloRequest } from 'request';

export class RequestWrap {

	public defaults = {
	  follow_max: 0,
	  user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like '
	  + 'Gecko) Chrome/41.0.2272.76 Safari/537.36',
	  open_timeout: 60000
	};
	private _cookieJar: any;
	private _log: Array<any>;
	

  constructor(defaultCookies:any) {
  	
  	this._cookieJar = defaultCookies || {};

	this._log = [];

	afloRequest.defaults(this.defaults);

  }

  	/**
	* Pushes a response object to the request log and responds to passed callback
	* param- {object} err Error object, is null if no error is present
	* param- {object} res Request's response
	* param- {string} body Needle's response body only, is null if an error is present
	* param- {function} callback Callback to be executed
	*/
	interceptResponse = (err:any, res:any, body:any, url:any, data:any, makeRequest:any, callback) => {
	  let entry, resCookieString, thisRes, cb, noop, promiseResponse;

	  thisRes = this;
	  noop = function () {};
	  cb = callback || noop;

	  if (err) {
	    cb(err, null, null);
	    makeRequest.reject(err);
	    return;
	  }

	  promiseResponse = {
	    res: res,
	    body: body
	  };
	  resCookieString = '';

	  _.each(res.cookies, function (value, key) {
	    // Update our cookie jar
	    thisRes._cookieJar[key] = value;

	    // Build cookie string for logging
	    if (resCookieString) {
	      resCookieString += ' ';
	    }
	    resCookieString += key + '=' + value + ';';
	  });

	  entry = {
	    request: {
	      headers: res.req._headers,
	      cookies: res.req._headers.cookie || '',
	      url: url,
	      data: data
	    },
	    response: {
	      cookies: resCookieString,
	      headers: res.headers,
	      statusCode: res.statusCode,
	      body: body
	    }
	  };

	  this.pushToLog(entry);
	  cb(err, res, body);
	  makeRequest.resolve(promiseResponse);
	}

	pushToLog = (logEntry:any) => {
	  this._log.push(logEntry);
	}

	request = (method:any, opts:any, callback) => {
	  let thisReq, data, url, finalOpts, makeRequest, extendedCookies;

	  thisReq = this;
	  makeRequest = q.defer();

	  url = _.isString(opts) ? opts : opts.url;

	  if (_.isUndefined(url) || !_.isString(url)) {
	    throw new Error('Url is not set');
	  }

	  opts = _.isObject(opts) ? opts : {};
	  data = opts.data || null;

	  finalOpts = _.omit(opts, ['data', 'url']);
	  extendedCookies = _.extend(this._cookieJar, finalOpts.cookies);
	  finalOpts.cookies = _.keys(extendedCookies).length > 0 ? extendedCookies : null;

	  afloRequest.request(method, url, data, finalOpts, function (err, res, body) {
	    thisReq.interceptResponse(err, res, body, url, data, makeRequest, callback);
	  });

	  return makeRequest.promise;
	}

	del = (opts, callback) => {
	  return this.request('delete', opts, callback);
	}

	get = (opts, callback) => {
	  return this.request('get', opts, callback);
	}

	head = (opts, callback) => {
	  return this.request('head', opts, callback);
	}

	patch = (opts, callback) => {
	  return this.request('patch', opts, callback);
	}

	post = (opts, callback) => {
	  return this.request('post', opts, callback);
	}

	put = (opts, callback) => {
	  return this.request('put', opts, callback);
	}

	getLog = () => {
	  return this._log;
	}

	getCookieJar = () => {
	  return _.cloneDeep(this._cookieJar);
	}

	optionsTemplate = (baseOptions) => {
	  return new OptionsTemplate(baseOptions);
	};


}