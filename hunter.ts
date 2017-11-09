import * as _ from 'lodash';
import HuntingTools from './tools';
import { HuntDefinition } from './hunt-definition';

export class Hunter {
	public hunterId: string;
	public	routines: any;
	private __applied: boolean;
	private __config: any;
	private _huntDefinitions: any;
	private _routines: any;
	private _plan: any;
	private _shareMethods: any;

	constructor(hunterId:string){
		this.hunterId = hunterId;

		this.routines = {};
		//Share methods amongst fellow hunters
		this._shareMethods = {
			replace: function (current, next) {
			  return next;
			}
		};

  		this.__applied = false;

		this.__config = {
			plan: []
		};

  		this._huntDefinitions = {};

  		this._plan = null;

  		this._shareMethods.default = this._shareMethods.replace;

	}



	//Extended Hunter
	formatPlan = () => {
  	  let thisFormat, formattedPlan, currentGroup, formattedGroup, formattedHuntObj;

  	  thisFormat = this;
	  formattedPlan = [];

	  if (thisFormat.__config.plan.length <= 0) {
	    throw new Error('Hunter ' + thisFormat.id + ' has no execution plan, use the hunter\'s plan method' +
	      ' to define it');
	  }

	  // Turn each tier into an array
	  _.each(this.__config.plan, function (huntGroup) {
	    currentGroup = _.isArray(huntGroup) ? huntGroup : [huntGroup];
	    formattedGroup = [];

	    // Turn each element in the array into an object
	    _.each(currentGroup, function (huntObj) {
	      formattedHuntObj = {};

	      if (_.isString(huntObj)) {
	        formattedHuntObj.huntId = huntObj;
	      } else {
	        formattedHuntObj = huntObj;
	      }

	      formattedGroup.push(formattedHuntObj);
	    });

	    formattedPlan.push(formattedGroup);
	  });

	  this._plan = formattedPlan;
	}

	applySetup = () => {
	  if (this.__applied) {
	    return;
	  }

	  this.formatPlan();
	  this.__applied = true;
	}

	plan = (executionPlan:any) => {
	  // TODO: Validate execution plan format right away
	  if (!_.isArray(executionPlan)) {
	    throw new Error('Hunter plan must be an array of hunt ids');
	  }

	  this.__config.plan = executionPlan;

	  return this;
	}


	hunt = (huntId:any) => {
	  if (!HuntingTools.hasKey(this._huntDefinitions, huntId)) {
	    this._huntDefinitions[huntId] = new HuntDefinition(huntId);
	  }

	  return this._huntDefinitions[huntId];
	}

	routine = (routineName:any, huntIds:any) => {
	  if (!_.isArray(huntIds)) {
	    throw new Error('An array of hunt Ids must be passed to the routine method');
	  }

	  if (!_.isString(routineName)) {
	    throw new Error('Routine name must be a string');
	  }

	  this._routines[routineName] = huntIds;

	  return this;
	};
  
}