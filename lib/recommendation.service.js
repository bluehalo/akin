'use strict';

var Promise = require('bluebird'),
	_ = require('lodash');

var ModelService = require('./model.service.js');

var UserRecommendation = ModelService.model.UserRecommendation;
var UserDoNotRecommend = ModelService.model.UserDoNotRecommend;

/**
 * Returns all recommendations for the input user ID
 */
module.exports.getAllRecommendationsForUser = ModelService.getAllRecommendationsForUser;

/**
 * Calculates and contributes the recommendation score for another user's item based on that user's similarity
 * to the current user
 */
var calculateAndContribute = function(userId, userSimilarity, items, otherUserItemWeight) {

    // If the item was not yet found, initialize it with a zero-weight recommendation
    if( !_.has(items, otherUserItemWeight.item) ) {
        items[otherUserItemWeight.item] = {
            item: otherUserItemWeight.item,
            itemType: otherUserItemWeight.itemType,
            weight: 0
        };
    }

    var contribution = otherUserItemWeight.weight * userSimilarity.similarity;

    items[otherUserItemWeight.item].weight += contribution;
};

/**
 * Based on a User and their Similarities to other users, perform the heavy lifting of matrix calculations
 * on the other User's Item Scores (retrieved from the database) and Similarities (passed in) to the current
 * user in order to create the full list of recommendations for the current user
 */
var createItemRecommendationsForUser = function(userId, userSimilarities) {
    return new Promise(function(resolve, reject) {

        var userSimilarityMap = _.groupBy(userSimilarities, 'user'),
            otherUserIds = _.keys(userSimilarityMap, 'user');

        ModelService.getCursorForUserItemWeightsForUsers(otherUserIds)
            .then(function(otherUserItemWeightsCursor) {

                var items = {};

                otherUserItemWeightsCursor.on('data', function(otherUserItemWeights) {
                    var otherUserId = otherUserItemWeights.user;
                    var userSimilarity = userSimilarityMap[otherUserId][0];

                    //log.info('Found %s item weights for other user %s', otherUserItemWeights.itemWeights.length, otherUserId);
                    otherUserItemWeights.itemWeights.forEach(calculateAndContribute.bind(this, userId, userSimilarity, items));
                });

                otherUserItemWeightsCursor.on('end', function() {
                    //log.info('Found %s similar users to %s', userSimilarities.length, user1);
                    // Resolve all of this user's similarities to save at once
                    resolve(items);
                });

            });

    });
};

/**
 * Formats the key-based item recommendations (keyed by item ID) to the persisted format of
 * an array of item recommendations for a particular user.
 */
var transformUserItemRecommendations = function(userId, userItemRecommendations) {

    return new Promise(function(resolve, reject) {

        //TODO Remove items for which the user has "enough" activity ?

        var recommendations = _.map( _.keys(userItemRecommendations), function(itemId) {
            return userItemRecommendations[itemId];
        }).filter(function(recommendation) {
            return recommendation.weight > 0;
        });

        resolve({
            user: userId,
            recommendations: recommendations
        });

    });

};

/**
 * Transform into an array of elements with the other user's id and the similarity.
 * Assume that there are only two users in the array and one matches the input user ID
 */
var transformUserSimilaritiesForUser = function(userId, userSimilarities) {
    var userIdString = userId + '';

    return Promise.map(userSimilarities, function(userSimilarity) {
        return {
            user: _.isEqual(userSimilarity.users[0] + '', userIdString ) ? userSimilarity.users[1] : userSimilarity.users[0],
            similarity: userSimilarity.similarity
        };
    }).filter(function(entry) {
        return entry.user !== userIdString;
    });

};

/**
 * Based on a user's similarities to other users, create and return the full user recommendation object
 */
var createRecommendationsFromWeightsAndSimilarities = function( userId, userSimilarities ) {
    return createItemRecommendationsForUser(userId, userSimilarities)
        .then( transformUserItemRecommendations.bind(this, userId) );
};

/**
 * Based on a user, manage the retrieval of similarities, the creation of the recommendations,
 * and the persistence of those recommendations to the database
 */
var calculateAndSaveUserRecommendations = function( userId ) {
    var threshold = 0.1;
    // log.debug('Calculating user recommendations for %s', userId);
    return ModelService.getAllSimilaritiesForUser(userId, threshold)
        .then( transformUserSimilaritiesForUser.bind(this, userId) )
        .then( createRecommendationsFromWeightsAndSimilarities.bind(this, userId) )
        .then( function(recommendationsToSave) {
            // log.info('Saving recommendations for user %s', userId);
            return UserRecommendation.insertMany([recommendationsToSave])
                    .then(function() {
                        return Promise.resolve();
                    });
        } );
};

/**
 * Map out the creation of user recommendations for each of the input user IDs
 */
var calculateUsersRecommendations = function( allUserIds ) {
    return Promise.map(allUserIds, calculateAndSaveUserRecommendations, { concurrency: 2 });
};

/**
 * -- BATCH ANALYTICS ENTRY POINT --
 *
 * Wipe the existing user recommendations and recalculate the new list based on
 * the set of all potential users who have hit the system
 */
module.exports.recalculateUserRecommendations = function() {
    // log.debug('Recalculating user recommendations');

    return ModelService.dropUserRecommendations()
        .then( ModelService.getAllUserIdsWithActivity )
        .then( calculateUsersRecommendations )
        .catch(function(err) {
            // log.error('Unable to calculate user recommendations', err);
            return Promise.reject();
        });
};

/**
 * Get a number of weighted-random samples from the entire 'allRecommendations' input array.
 *
 * 1. Calculate the cumulative sum of all recommendations (what's the range?)
 * 2. Get an array of random floating point numbers within that range
 * 3. Sort the array in descending order so we can pop elements off the tail of the array
 * 4. Iterate through all recommendations and track a running sum of the weights
 * 5. If the running sum is greater than the current sample number, that means this sample
 *    number selected this item, so add the item to the array to return
 * 6. If the random sample number is used, get the next sample number from the total list
 */
var getCumulativeDistributionSamples = function(allRecommendations, sampleSize) {
	var i;
    var sampleRecommendations = [];

    // 1. Calculate the cumulative sum of all recommendations (what's the range?)
    var cumulativeWeight = _.sumBy(allRecommendations, 'weight');

    // 2. Get an array of random floating point numbers within that range
    var sampleNumbers = [];
    for(i=0; i < sampleSize; i++) {
        // get another random floating point number in the range
        sampleNumbers.push( _.random(cumulativeWeight, true) );
    }

    // 3. Sort the array in descending order so we can pop elements off the tail of the array
    sampleNumbers = sampleNumbers.sort().reverse();

    var runningSum = 0;
    var nextMilestone = sampleNumbers.pop();

    // 4(a). Iterate through all recommendations and track a running sum of the weights
    for(i=0; i < allRecommendations.length && nextMilestone != null; i++) {
        var currentRec = allRecommendations[i];
        // 4(b). Iterate through all recommendations and track a running sum of the weights
        runningSum += currentRec.weight;
        if(runningSum > nextMilestone) {
            //5. If the running sum is greater than the current sample number, that means this sample
            //   number selected this item, so add the item to the array to return
            sampleRecommendations.push( currentRec );

            // 6. If the random sample number is used, get the next sample number from the total list
            nextMilestone = sampleNumbers.pop();
        }
    }

    return sampleRecommendations;
};

var addScoreToItems = function(scoreMap, items) {
    return _.map(items, function(r) {
        var recommendationScore = scoreMap[i._id];
        // log.debug('found recommendation score of %s', recommendationScore);
        return {
            score: recommendationScore,
            item: i
        };
    });
};

/**
 * Based on the input UserItemWeights object, return a map of the
 * item IDs to their weights for this user
 */
var getItemIdToWeightMap = function(userItemWeights) {
    var itemIdToWeightMap = {};
    _.forEach(_.get(userItemWeights, 'itemWeights', []), function(itemWeight) {
        itemIdToWeightMap[itemWeight.item] = itemWeight.weight;
    });
    return itemIdToWeightMap;
};

/**
 * Filter out recommendations where:
 * 1. the user requested to not see the recommendation again (the "DNR" list)
 * 2. the user has a sufficiently high weight ("they've seen it enough")
 * 3. or a sufficiently low recommendation score
 */
var filterRecommendations = function(dnr, itemIdToWeightMap, rec) {
    // If the item is in the DNR list, ignore it
    if(!_.isEmpty(dnr)) {
        var dnrEntry = _.find(dnr.doNotRecommend, { item: rec.item, itemType: rec.itemType });
        if( !_.isEmpty(dnrEntry) ) { // if it has a DNR entry, return false to filter it out
            // log.debug('Filtering out %s %s based on DNR entry', rec.itemType, rec.item);
            return false;
        }
    }

    // TODO Determine what these numbers / thresholds should be
    return rec.weight > 0.5 || itemIdToWeightMap[rec.item] <= 2;
};

/**
 * For the passed-in user, retrieve up to a number of samples based on their
 * recommendations from the collaborative filtering output
 */
module.exports.sampleRecommendationsForUser = function(userId, numberOfSamples) {

    var recommendationPromise = ModelService.getAllRecommendationsForUser(userId);
    var itemWeightsPromise = ModelService.getItemWeightsForUser(userId);
    var doNotRecommendPromise = ModelService.getDoNotRecommendByUser(userId);

    return Promise.join(recommendationPromise, itemWeightsPromise, doNotRecommendPromise, function(userRecommendationsObj, userItemWeights, dnr) {

            var itemIdToWeightMap = getItemIdToWeightMap(userItemWeights);

            var allRecommendations = _.get(userRecommendationsObj, 'recommendations', []);

            // log.debug('All Recommendations %j', allRecommendations);

            var itemToScoreMap = {};
            _.forEach(allRecommendations, function(rec) {
                itemToScoreMap[rec.item] = rec.weight;
            });

            // log.debug('Got DNR: %j', dnr);

            var filteredRecommendations = _.filter(allRecommendations, filterRecommendations.bind(this, dnr, itemIdToWeightMap));

            var numberOfSamples = numberOfSamples || 20; // default to 20 samples

            var sampleRecommendations = getCumulativeDistributionSamples(filteredRecommendations, numberOfSamples);

            // log.debug('Sample recommendations for %: %j', userId, sampleRecommendations);

            return addScoreToItems(itemToScoreMap, _.map(sampleRecommendations, 'item'));

        });
};

/**
 * Marking a Recommendation for "Do Not Recommend" so that it will not show up
 * for the user again
 */
module.exports.markRecommendationDNR = function(userId, itemId, itemType) {

    return ModelService.getDoNotRecommendByUser(userId)
        .then(function(existingRecord) {

            if(existingRecord == null) {
                // Create DNR entry
                existingRecord = new UserDoNotRecommend({
                    user: userId,
                    doNotRecommend: []
                });
            }

            // Add the item ID + Type to the list
            existingRecord.doNotRecommend.push({
                item: itemId,
                itemType: itemType
            });

            return existingRecord.save();
        });

};

/**
 * For unit testing support
 */
module.exports.__ = {
    calculateAndContribute: calculateAndContribute,
    calculateUsersRecommendations: calculateUsersRecommendations,
    calculateAndSaveUserRecommendations: calculateAndSaveUserRecommendations,
    createRecommendationsFromWeightsAndSimilarities: createRecommendationsFromWeightsAndSimilarities,
    createItemRecommendationsForUser: createItemRecommendationsForUser,
    getCumulativeDistributionSamples: getCumulativeDistributionSamples,
    transformUserItemRecommendations: transformUserItemRecommendations,
    transformUserSimilaritiesForUser: transformUserSimilaritiesForUser
};
