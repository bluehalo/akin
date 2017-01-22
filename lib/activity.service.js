'use strict';

var Promise = require('bluebird'),
    _ = require('lodash'),
    moment = require('moment');

// Default values. Allow for overriding
var ageOffConfig = {
    maxDays: 180,
    exponent: 3,
    easing: 2
};

var ModelService = require('./model.service');

var UserActivity = ModelService.model.UserActivity;
var UserItemWeights = ModelService.model.UserItemWeights;

module.exports.log = (userId, itemId, itemType, action) => {

    return new Promise((resolve, reject) => {

        // log.debug('User %s %s took action %s on %s item %s', user.username, userId, action, itemType, item);

        new UserActivity({
            user: userId,
            item: itemId,
            itemType: itemType,
            action: action
        })
            .save()
            .then(resolve, reject);

    });

};

module.exports.removeLog = (userId, item, action) => {

    return new Promise((resolve, reject) => {

        // log.debug('User %s %s removed action %s on %s item %s', user.username, userId, action, item);

        UserActivity
	        .remove({
	            user: userId,
	            item: item,
	            action: action
	        })
            .then(resolve, reject);
    });

};

let convertItemsFromMapToArray = (itemMap) => {
    return _.map(_.keys(itemMap), (itemId) => {
        return itemMap[itemId];
    });
};

let calculateRowWeight = (itemWeights) => {
    var weightValues = _.map(itemWeights, 'weight');
    var rowWeight = _.reduce( weightValues, (sum, itemWeight) => {
        return sum + (itemWeight * itemWeight);
    }, 0); // initial value of 0
    // log.debug('Row Weight %s', rowWeight);
    return Math.sqrt(rowWeight);
};

/**
 * Calculate how old this activity is.
 * If it mistakenly in the future, use 0 for present time
 */
let getDaysOld = ( inputDate ) => {
    var created = moment( inputDate );
    var age = moment().diff(created, 'days');
    return (age < 0) ? 0 : age;
};

/**
 * Based on the type and age of the activity, return a normalized activity weight
 * to be added to that user's overall activity weight for a particular item
 */
let getActivityWeight = (userActivity) => {

    //TODO Accept configurations for various action types

    if(userActivity.action === 'like') {
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
        if(relativeAge < 0.5) {
            return 1 - easing * Math.pow(relativeAge, exponent);
        }
        else {
            return easing * Math.pow((1 - relativeAge), exponent);
        }

    }
    else {
        // default response
        return 1;
    }
};

let handleUserActivityData = (itemMap, userActivity) => {
    var itemId = userActivity.item;
    if( !_.has(itemMap, itemId) ) {
        itemMap[itemId] = {
            item: itemId,
            itemType: userActivity.itemType,
            weight: 0
        };
    }

    itemMap[itemId].weight += getActivityWeight(userActivity);

};

let calculateUserItemWeightsFromActivity = (userId, activitiesCursor) => {

    return new Promise((resolve, reject) => {

        var itemMap = {};

        activitiesCursor.on('data', handleUserActivityData.bind(this, itemMap));

        activitiesCursor.on('end', () => {
            //log.info('Closing cursor on activity data complete for user %s', userId);
            var itemWeights = convertItemsFromMapToArray(itemMap);

            var rowWeight = calculateRowWeight(itemWeights);

            var userItemWeights = {
                user: userId,
                itemWeights: itemWeights,
                rowWeight: rowWeight
            };

            // log.debug('Found user item weights for %s to be %j', userId, userItemWeights);

            resolve(userItemWeights);
        });

    });

};

let getActivityAndCalculateItemWeightsForUserId = (userId) => {
    // log.debug('Processing user id %s', userId);
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

module.exports.recalculateUserItemWeights = () => {
    // log.debug('Recalculating user item weights');

    return ModelService.dropUserItemWeights()
        .then( ModelService.getAllUserIdsWithActivity )
        .then( (userIds) => {
            // log.debug('Calculating user item weights for %s users', userIds.length);
            return Promise.map(userIds, getActivityAndCalculateItemWeightsForUserId, { concurrency: 2 });
        } )
        .catch((err) => {
            // log.error('Unable to calculate user item weights', err);
            return Promise.reject(err);
        });

};
