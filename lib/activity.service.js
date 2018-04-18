'use strict';

const _ = require('lodash'),
    Promise = require('bluebird'),
    moment = require('moment');

// Default values. Allow for overriding
let ageOffConfig = {
    maxDays: 180,
    exponent: 3,
    easing: 2
};

/**
 * Default weight for actions not configured.
 */
const defaultActionWeight = 1;

/**
 * Non-default max weights for given actions. Otherwise, defaults to 1
 */
const actionWeights = {};

const ModelService = require('./model.service'),
    UserActivity = ModelService.model.UserActivity,
    UserItemWeights = ModelService.model.UserItemWeights;

/**
 * Saves a user action on an item to the database.
 * @param {string} userId a unique identifier for the user
 * @param {string} itemId a unique identifier for the item
 * @param {object} itemMetadata metadata about the item that may be used in scoring weights
 * @param {string} action the action that the user took on the item
 * @return {promise} returns a promise after the user activity was saved
 */
const log = (userId, itemId, itemMetadata, action) => {

    return new Promise((resolve, reject) => {
        new UserActivity({
            user: userId,
            item: itemId,
            itemMetadata: itemMetadata,
            action: action
        })
            .save()
            .then(resolve, reject);

    });

};

const removeLog = (userId, item, action) => {

    return new Promise((resolve, reject) => {
        UserActivity
	        .remove({
	            user: userId,
	            item: item,
	            action: action
	        })
            .then(resolve, reject);
    });

};

const convertItemsFromMapToArray = (itemMap) => {
    return _.map(_.keys(itemMap), (itemId) => {
        return itemMap[itemId];
    });
};

const calculateRowWeight = (itemWeights) => {
    var weightValues = _.map(itemWeights, 'weight');
    var rowWeight = _.reduce( weightValues, (sum, itemWeight) => {
        return sum + (itemWeight * itemWeight);
    }, 0); // initial value of 0
    return Math.sqrt(rowWeight);
};

/**
 * Calculate how old this activity is.
 * If it mistakenly in the future, use 0 for present time
 */
const getDaysOld = ( inputDate ) => {
    var created = moment( inputDate );
    var age = moment().diff(created, 'days');
    return (age < 0) ? 0 : age;
};

/**
 * Based on the type and age of the activity, return a normalized activity weight
 * to be added to that user's overall activity weight for a particular item
 */
const getActivityWeight = (userActivity) => {

    const maxActionWeight = _.has(actionWeights, userActivity.action) ?
                            actionWeights[userActivity.action] :
                            defaultActionWeight;

    // Time-based decay function using an inverted ease in out cubic (configurable)
    var daysOld = getDaysOld(userActivity.dateCreated);

    var maxDays = ageOffConfig.maxDays,
        exponent = ageOffConfig.exponent,
        easing = ageOffConfig.easing;

    if( daysOld > maxDays ) {
        return 0;
    }

    // between 0 and 1
    var relativeAge = daysOld / maxDays;
    // percentage will be between 0 and 1
    const percentage = (relativeAge < 0.5) ?
                    (1 - easing * Math.pow(relativeAge, exponent)) :
                    (easing * Math.pow((1 - relativeAge), exponent));

    return maxActionWeight * percentage;
};

const handleUserActivityData = (itemMap, userActivity) => {
    var itemId = userActivity.item;
    if( !_.has(itemMap, itemId) ) {
        itemMap[itemId] = {
            item: itemId,
            itemMetadata: userActivity.itemMetadata,
            weight: 0
        };
    }

    itemMap[itemId].weight += getActivityWeight(userActivity);

};

const calculateUserItemWeightsFromActivity = (userId, activitiesCursor) => {

    return new Promise((resolve, reject) => {

        var itemMap = {};

        activitiesCursor.on('data', handleUserActivityData.bind(this, itemMap));

        activitiesCursor.on('end', () => {
            var itemWeights = convertItemsFromMapToArray(itemMap);

            var rowWeight = calculateRowWeight(itemWeights);

            var userItemWeights = {
                user: userId,
                itemWeights: itemWeights,
                rowWeight: rowWeight
            };

            resolve(userItemWeights);
        });

    });

};

const getActivityAndCalculateItemWeightsForUserId = (userId) => {
    return ModelService.getActivityForUserCursor(userId)
        .then( calculateUserItemWeightsFromActivity.bind(this, userId) )
        .then( (userItemWeights) => {
            return new Promise((resolve, reject) => {
                new UserItemWeights(userItemWeights)
                    .save()
                    .then(() => {
                        resolve(); // ignore the response so it can be garbage collected
                    },
                    reject);
            });
        });
};

const recalculateUserItemWeights = () => {

    return ModelService.dropUserItemWeights()
        .then( ModelService.getAllUserIdsWithActivity )
        .then( (userIds) => {
            return Promise.map(userIds, getActivityAndCalculateItemWeightsForUserId, { concurrency: 2 });
        });

};

/**
 * Sets the age-off configuration to something other than the default
 * @param {object} newAgeOffConfig - the configuration of the age-off criteria. All attributes are required.
 * Default value:
 * {
 *   maxDays: 180,
 *   exponent: 3,
 *   easing: 2
 * }
 */
const setAgeOffConfig = (newAgeOffConfig) => {
    ageOffConfig = newAgeOffConfig;
};

/**
 * Updates the max, default weight for an action to the input value
 * @param {string} action the action that will use the configured weight
 * @param {number} weight the default, max weight for an action
 */
const setActionWeight = (action, weight) => {
    actionWeights[action] = weight;
};

module.exports = {
    log,
    recalculateUserItemWeights,
    removeLog,
    setActionWeight,
    setAgeOffConfig
};
