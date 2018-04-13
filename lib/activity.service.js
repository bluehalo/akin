'use strict';

const _ = require('lodash'),
    moment = require('moment');

// Default values. Allow for overriding
let ageOffConfig = {
    maxDays: 180,
    exponent: 3,
    easing: 2
};

const ModelService = require('./model.service'),
    UserActivity = ModelService.model.UserActivity,
    UserItemWeights = ModelService.model.UserItemWeights;

const log = (userId, itemId, itemType, action) => {

    return new Promise((resolve, reject) => {
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

const handleUserActivityData = (itemMap, userActivity) => {
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
            return Promise.all(_.map(userIds, getActivityAndCalculateItemWeightsForUserId));
        });

};

module.exports = {
    log,
    recalculateUserItemWeights,
    removeLog
};
