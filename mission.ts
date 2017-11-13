import * as _ from 'lodash';
import HuntingTools from './tools';
import * as q from 'q';
import { EventEmitter2 } from 'eventemitter2';
import { HuntDefinition } from './hunt-definition';

export class Mission {
  public uid: string;
  private __started: boolean;
  private __eventsConfig: any;
  private __publicEventsConfig: any;
  private __events: any;
  private __publicEvents: any;
  private __planIdx: number;
  private __executionQueueIdx: number;
  private __params: any;
  private __enqueuedHunts: Array<any>;
  private __plan: any;
  private __executionQueue: Array<any>;
  private __hunter: any;
  private __huntStorages: any;
  private __finishedHunts: any;
  private __cookieJar: any;
  private __componentsApplied: boolean;
  constructor(uid:string, hunter:any, params:any) {

  	/** Unique Mission identifier */
  	// Set missions's uid
  	if (uid !== undefined) {
    	this.setUid(uid);
  	}

  	this.__started = false;

  	this.__eventsConfig = {
      wildcard: true,
      delimiter: ':'
    };
    this.__publicEventsConfig = {
      wildcard: true,
      delimiter: ':'
    };
    //  //private events
    this.__events = new EventEmitter2(this.__eventsConfig);
    //public events
  	this.__publicEvents = new EventEmitter2(this.__publicEventsConfig);
  	
    //Current plan group idx - build execution queue default
  	this.__planIdx = -1;

  	this.__executionQueueIdx = -1;

  	//params provided to the hunt
  	this.__params = params || {};

  	this.__enqueuedHunts = [];

  	this.__plan = null;

  	this.__executionQueue = [];

  	this.__hunter = hunter;

  	this.__huntStorages = {};

  	this.__finishedHunts = {};

  	this.__cookieJar = {};

  	this.__componentsApplied = false;

  	// Set event listeners
  	this.setEventListeners();

  }

  setUid = (argUid:string) => {
  	if (!argUid || !_.isString(argUid) || argUid.length <= 0) {
    	throw new Error('Mission uid must be a valid string');
  	}
  	this.uid = argUid;
  }

  cloneCookieJar = (cookieJar:any) => {
    return _.cloneDeep(cookieJar);
  }

  saveCookieJar = (cookieJar:any) => {
    this.__cookieJar = cookieJar;
  }

  /**
  * Returns an undefined number of Hunt instances based on a huntDefinition's builder output
  * param {object} huntSpecs contains specifications to build a certain Hunt via it's HuntDefinition
  * private
  * return {array} an array of Hunts
  */
  buildHunt = (huntId) => {
    let thisBuild, builderResponse, builderParams, clonedCookieJar, huntDefinition;
    thisBuild = this;
    huntDefinition = this.__hunter._huntDefinitions[huntId];

    builderParams = {
      params: this.__params,
      shared: this.findInShared.bind(thisBuild)
    };

    clonedCookieJar = this.cloneCookieJar(this.__cookieJar);
    builderResponse = huntDefinition.build(builderParams, clonedCookieJar, this);

    return builderResponse;
  }


  /**
  * Runs a hunt and enqueues its `next` hunt if there is any (recursive)
  * param- {object} huntSpec object with hunt specifications and the hunt itself
  * private-
  */
  runHunt = (huntSpec:any) => {
    let thisRun, nextHuntSpec, huntRunning, thisHunt;

    thisRun = this;

    thisHunt = huntSpec.hunt;
    huntRunning = thisHunt._runningPromise;
    nextHuntSpec = huntSpec.next;

    if (nextHuntSpec) {
      huntRunning.then(function () {
        thisRun.runHunt(nextHuntSpec);
      })
      .fail(function () {
        // Do nothing, this rejection is being handled in `__runExecutionBlock`'s Q.all call
      })
      .done();
    }

    thisRun.__events.emit('hunt:start', thisHunt);
    thisHunt.run();
  }


  /**
  * Takes a plan group and creates the next execution block to be inserted into the execution
  * queue
  * param {array} array of objects which represent hunts methods in a plan
  * private
  * return {array} array of objects which contain Hunt instances with their execution data
  * example
  * // Input example
  * [{huntId: 1, sync: true}, {huntId: 2}, {huntId: 3}]
  * // Output
  * // [{hunt: <huntInstance>, next: {...}}, {hunt: <huntInstance>, next: null}]
  */
  buildExecutionBlock = (planGroup:Array<any>) => {
    let thisBuildEx, executionBlock, executionObject, previousObject, hunts;

    thisBuildEx = this;

    executionBlock = [];

    _.each(planGroup, function (huntSpecs:any) {
      hunts = thisBuildEx.buildHunt(huntSpecs.huntId);
      previousObject = null;

      // Build all execution objects for a specific hunt and
      _.each(hunts, function (hunt) {
        executionObject = {hunt: hunt, next: null};

        // Assign new object to previous object's `next` attribute if the hunt is self syncronous
        if (huntSpecs.selfSync) {
          if (previousObject) {
            previousObject.next = executionObject;
            previousObject = executionObject;
          } else {
            previousObject = executionObject;
            executionBlock.push(executionObject);
          }
        } else {
          executionBlock.push(executionObject);
        }
      });
    });

    return executionBlock;
  }


  /**
  * Runs through the executionBlock tree and gathers all promises from hunts
  * param - {object} executionBlock An array of objects which represents a set of hunts to be run in
  * parallel from the executionQueue
  * private
  * example -
  * // Input example
  * [{hunt: <huntInstance>, next: {...}}, {hunt: <huntInstance>, next: null}]
  */
  retrieveExecutionQueueBlockPromises = (executionBlock:any) => {
    let finalPromises;

    let retrieveHuntSpecPromises = (huntSpec:any) => {
      let currentHunt, promises;

      currentHunt = huntSpec.hunt;
      promises = [];

      promises.push(currentHunt._runningPromise);

      if (huntSpec.next) {
        promises = promises.concat(retrieveHuntSpecPromises(huntSpec.next));
      }

      return promises;
    }

    finalPromises = [];

    _.each(executionBlock, function (huntSpec:any) {
      finalPromises = finalPromises.concat(retrieveHuntSpecPromises(huntSpec));
    });

    return finalPromises;
  }


  failMission = (response:any) => {
    this.__events.emit('mission:fail', response);
  }

  /**
  * Runs an execution block
  * param- {array} executionBlock An array of objects which represents a set of hunts from the
  * executionQueue to be run in parallel. Its responsible of preparing the emission of the
  * executionQueue events such as when it was successful or it failed.
  * private -
  * example -
  * //Input example
  * [{hunt: <huntInstance>, next: {...}}, {hunt: <huntInstance>, next: null}]
  */
  runExecutionBlock = (executionBlock:any) => {
    let thisRun, runningHunts;

    thisRun = this;
    runningHunts = this.retrieveExecutionQueueBlockPromises(executionBlock);

    q.all(runningHunts).then(function (results:Array<any>) {
      // Set cookies of results
      _.each(results, function (result:any) {
        if (result.savedCookieJar) {
          thisRun.saveCookieJar(result.savedCookieJar);
        }
      });

      thisRun.__events.emit('eq:blockContinue');

    }, function (response:any) {
      if (response.status === 'fail') {
        thisRun.failMission(response);
      }

      thisRun.__events.emit('eq:blockStop');
    }).done();

    _.each(executionBlock, function (huntSpec:any) {
      thisRun.runHunt(huntSpec);
    });
  }


  runCurrentExecutionBlock = () => {
    this.runExecutionBlock(this.__executionQueue[this.__executionQueueIdx]);
  }

  applyNextExecutionQueueBlock = () => {
    let executionBlock;

    this.__planIdx += 1;
    this.__executionQueueIdx += 1;

    if (!this.__plan[this.__planIdx]) {
      this.__events.emit('mission:success');
      return;
    }

    executionBlock = this.buildExecutionBlock(this.__plan[this.__planIdx]);
    this.__executionQueue.push(executionBlock);
    this.__events.emit('eq:blockApply');
  }

  prepareRun = () => {
    this.applyComponents();
    this.applyPlan();
  }

  /**
  * Hooks to the newly created hunts' promises to trigger events and save useful data
  * fires - mission:success
  * fires - mission:fail
  * fires - mission:finish
  * private
  */
  prepareCurrentExecutionQueueBlock = () => {
    let thisPrep, promises, currentEQBlock;

    thisPrep = this;
    currentEQBlock = this.__executionQueue[this.__executionQueueIdx];
    promises = this.retrieveExecutionQueueBlockPromises(currentEQBlock);

    _.each(promises, function (promise) {
      promise.then(function (response) {
        var hunt = response.hunt;

        // Save hunt in its corresponding finished hunt array
        thisPrep.__finishedHunts[hunt.huntId] = thisPrep.__finishedHunts[hunt.huntId] || [];
        thisPrep.__finishedHunts[hunt.huntId].push(hunt);

        // Emit event for successful hunt
        thisPrep.__events.emit('hunt:success', response);
        thisPrep.__events.emit('hunt:finish', response);

      }, function (response) {
        if (response.status === 'success') {
          thisPrep.__events.emit('hunt:success', response);
        } else {
          thisPrep.__events.emit('hunt:fail', response);
        }

        thisPrep.__events.emit('hunt:finish', response);
      }).done();
    });
  }

  onHuntStart = (hunt:any) => {
    let response, params;

    params = hunt._params;
    response = {
      hunt: hunt,
      params: params
    };

    this.__publicEvents.emit('hunt:' + hunt.huntId + ':start', response);
  }

  onHuntSuccess = (response:any) => {
    let huntId;

    huntId = response.hunt.huntId;
    this.__publicEvents.emit('hunt:' + huntId + ':success', response);
  }

  onHuntFail = (response:any) => {
    let huntId;

    huntId = response.hunt.huntId;
    this.__publicEvents.emit('hunt:' + huntId + ':fail', response);
  }

  onHuntFinish = (response:any) => {
    let huntId;

    huntId = response.hunt.huntId;
    this.__publicEvents.emit('hunt:' + huntId + ':finish', response);
  }

  onMissionStart = () => {
    this.__publicEvents.emit('mission:start');
    this.prepareRun();
    this.applyNextExecutionQueueBlock();
    console.log("::: MISSION Started! ::::");
  }

  onMissionSuccess = () => {
    this.__publicEvents.emit('mission:success');
    this.__publicEvents.emit('mission:finish');
    this.__publicEvents.emit('success');
    this.__publicEvents.emit('finish');
  }

  onMissionFail = (response:any) => {
    this.__publicEvents.emit('mission:fail', response);
    this.__publicEvents.emit('fail', response);
  }

  onEqBlockApply = () => {
    // Set the new built hunts' events and listens to their promises
    this.prepareCurrentExecutionQueueBlock();
    // Run the new execution block
    this.runCurrentExecutionBlock();
  }


  onEqBlockStop = () => {
    // Finish is triggered when the mission fails or succeeds, Basically when it stops running
    this.__publicEvents.emit('mission:finish');
    this.__publicEvents.emit('finish');
  }

  onEqBlockContinue = () => {
    this.applyNextExecutionQueueBlock();
  }

  setEventListeners = () => {
    let thisSet = this;

    this.__events.on('hunt:start', function (response) {
      thisSet.onHuntStart(response);
    });

    this.__events.on('hunt:success', function (response) {
      thisSet.onHuntSuccess(response);
    });

    this.__events.on('hunt:fail', function (response) {
      thisSet.onHuntFail(response);
    });

    this.__events.on('hunt:finish', function (response) {
      thisSet.onHuntFinish(response);
    });

    // When the mission is started
    this.__events.once('mission:start', function () {
      thisSet.onMissionStart();
    });

    // When the mission finishes without errors
    this.__events.once('mission:success', function () {
      thisSet.onMissionSuccess();
    });

    // When the mission finishes with errors
    this.__events.once('mission:fail', function (response) {
      thisSet.onMissionFail(response);
    });

    // When the next execution block is applied
    this.__events.on('eq:blockApply', function () {
      thisSet.onEqBlockApply();
    });

    // When a hunt from the current execution block fails
    this.__events.on('eq:blockStop', function () {
      thisSet.onEqBlockStop();
    });

    this.__events.on('eq:blockContinue', function () {
      thisSet.onEqBlockContinue();
    });
  }

  /**
  * Prepares execution groups to run based on plan and enqueued tasks
  */
  applyPlan = () => {
    let thisApply, executionPlan, groupHuntIds, matchIdx, newExecutionPlan, newHuntGroup;

    thisApply = this;

    executionPlan = this.__hunter._plan;

    newExecutionPlan = [];
    newHuntGroup = [];

    _.each(executionPlan, function (executionGroup:any) {
      groupHuntIds = _.map(executionGroup, function (huntObj:any) {
        return huntObj.huntId;
      });

      _.each(thisApply.__enqueuedHunts, function (enqueuedHunt:any) {
        matchIdx = groupHuntIds.indexOf(enqueuedHunt);
        if (matchIdx >= 0) {
          newHuntGroup.push(executionGroup[matchIdx]);
        }
      });

      if (newHuntGroup.length > 0) {
        newExecutionPlan.push(newHuntGroup);
        newHuntGroup = [];
      }
    });

    this.__plan = newExecutionPlan;
  }

  /**
  * Applies required scraping components as they need to be ready to run by the mission
  * private- 
  */
  applyComponents = () => {
    if (this.__componentsApplied) {
      return;
    }

    this.__hunter.applySetup();

    this.__componentsApplied = true;
  }

  /**
  * Verifies if the mission's enqueued hunts are present in it's hunter
  * returns - {boolean} true if all enqueued hunts exist
  * private - 
  */
  enqueuedHuntsExist = () => {
    let thisQue = this;
    return _.every(this.__enqueuedHunts, function (enqueuedHunt:any) {
      return !!thisQue.__hunter._huntDefinitions[enqueuedHunt];
    });
  }

  /**
  * Check wether a task is present on the job's agent's plan
  * param - {string} taskId task id of the task
  * returns - {boolean} true if the task is in the plan
  */
  huntIsInPlan = function (huntId:string) {
    let hunts;

    this.applyComponents();

    return _.some(this.__hunter._plan, function (planBlock:any) {
      hunts = HuntingTools.makeArray(planBlock);

      return _.some(hunts, function (huntObject:any) {
        let planHuntId;

        planHuntId = _.isString(huntObject) ? huntObject : huntObject.huntId;
        return planHuntId === huntId;
      });
    });
  };

  findInShared = (query:any) => {
    let key, result, splitQuery, huntId;

    if (!_.isString(query)) {
      throw new Error('The shared method key passed is invalid');
    }

    splitQuery = query.split('.');
    huntId = splitQuery[0];
    key = splitQuery[1];

    if (!huntId || !key) {
      throw new Error('The shared method key passed is invalid');
    }

    result = this.getShared(huntId, key);

    if (result === undefined) {
      throw new Error('\'' + key + '\' was never shared by hunt \'' + huntId + '\'');
    }

    return this.getShared(huntId, key);
  }

  getShared = (huntId:any, key:string) => {
    if (this.__huntStorages[huntId] && this.__huntStorages[huntId][key] !== undefined) {
      return _.cloneDeep(this.__huntStorages[huntId][key]);
    }

    return undefined;
  }

  setShared = (huntId:any, key:any, value:any) => {
    this.__huntStorages[huntId] = this.__huntStorages[huntId] || {};
    this.__huntStorages[huntId][key] = value;
  }

  getParams = () => {
    return this.__params;
  }

  enqueueHuntArray = (huntArray:any) => {
    let thisQue = this;

    if (!_.isArray(huntArray)) {
      throw new Error('Expected an array of hunt Ids');
    }

    _.each(huntArray, function (huntId:string) {
      thisQue.enqueue(huntId);
    });
  }

  params = (paramsObj:any) => {
    if (_.isArray(paramsObj) || !_.isObject(paramsObj)) {
      throw new Error('Params must be an object');
    }

    _.extend(this.__params, paramsObj);

    return this;
  }

  enqueue = (huntId:any) => {
    if (!_.isString(huntId) || huntId.length <= 0) {
      throw new Error('Enqueue params isn\'t a valid string');
    }

    if (!this.huntIsInPlan(huntId)) {
      throw new Error('Enqueued hunt ' + huntId + ' is not in the hunter ' + this.__hunter.id +
        '\'s plan' + ' add it to the hunter\'s config array via the .setup method');
    }

    this.__enqueuedHunts.push(huntId);

    return this;
  }

  routine = (routineName:any) => {
    if (this.__hunter._routines[routineName]) {
      this.enqueueHuntArray(this.__hunter._routines[routineName]);
    } else {
      throw new Error('No routine with name ' + routineName + ' was found');
    }
  }

  run = () => {
    if (this.__started) {
      throw new Error('A mission cannot be run more than once');
    }

    if (!this.enqueuedHuntsExist()) {
      throw new Error('One or more enqueued hunts are not defined');
    }

    this.__started = true;
    this.__events.emit('mission:start');
  }

  on = (eventName:any,callback:any) => {
    this.__publicEvents.on(eventName, callback);
  }


}