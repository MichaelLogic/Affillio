import * as _ from 'lodash';
import { Hunter } from './hunter';
import HuntingTools from './tools';
import { Mission } from './mission';
import * as mongoose from 'mongoose';

class AfloSingleton {
	private static instance: AfloSingleton;
	//private tools: HuntingTools;
	private __hunters: any;

	protected constructor(){
		this.__hunters = {};

	}

	public static getInstance() {
        if (!AfloSingleton.instance) {
            AfloSingleton.instance = new AfloSingleton();
        }
        return AfloSingleton.instance;
    }
	/**
	* Returns an hunter instance, if it doesn't exists: AUTO-CREATE
	* param- {string} hunterId name of the new hunter or by which to look for if it exists
	* return- {Agent} hunter instance
	*/
	hunter = (hunterId:string) => {
	  let thisHunter: Hunter;
	  let hunterExists: boolean;
	  if (!hunterId || !_.isString(hunterId)) {
	    throw new Error('Hunter id must be passed');
	  }

	  hunterExists = HuntingTools.hasKey(this.__hunters, hunterId);
	  thisHunter = hunterExists ? this.__hunters[hunterId] : this.__createHunter(hunterId);

	  return thisHunter;
	}

	__createHunter = (hunterId:string) => {
		this.__hunters[hunterId] = new Hunter(hunterId);
		return this.__hunters[hunterId];
	}


	hunt = (hunterId:any, huntId:any) => {
	  if (!huntId || !_.isString(huntId)) {
	    throw new Error('Hunt id must be passed');
	  }

	  return this.hunter(hunterId).hunt(huntId);
	}

	/*
	* Instances a new mission
	* param- {string} hunterId name of the hunter that will be used by the Mission
	* return- {Mission} Mission instance that has been created
	*/
	mission = (hunterId:any, newMissionId:string, params?:any) => {
	  let newId, hunter, newMission;

	  if (!hunterId || !_.isString(hunterId)) {
	    throw new Error('Agent id must be passed');
	  }

	  if (params && !_.isObject(params)) {
	    throw new Error('Params passed must be an object');
	  }

	  hunter = this.__hunters[hunterId];

	  if (!hunter) {
	    throw new Error('Agent ' + hunterId + ' doesn\'t exist.');
	  }

	  //newId = new mongoose.Types.ObjectId();
	  newMission = new Mission(newMissionId, hunter, params);

	  return newMission;
	}

	/**
	* Applies all configurations for all hunters
	* Affillio can eager-load (method)
	* Affillio can lazy-load (run a mission).
	*/
	ready = () => {
	    _.each(this.__hunters, function (hunter) {
	      hunter.applySetup();
	    });
	};

}

export default AfloSingleton.getInstance();