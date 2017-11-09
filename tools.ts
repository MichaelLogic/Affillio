import * as _ from 'lodash';

export class HuntingTools {

	hasKey = (obj:any, key:string) => {
		//return _.contains(_.keys(obj), key);
		return _.includes(_.keys(obj), key);
	}

	makeArray = (elem:any) => {
		return _.isArray(elem) ? elem : [elem];
	}

}

export default new HuntingTools();