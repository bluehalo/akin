'use strict';

let Promise = require('bluebird'),
	_ = require('lodash'),

	ModelService = require('./model.service'),
	SampleService = require('./sample.service'),

	UserRecommendation = ModelService.model.UserRecommendation,
	UserDoNotRecommend = ModelService.model.UserDoNotRecommend;

/**
 * Returns all recommendations for the input user ID
 */
module.exports.getAllRecommendationsForUser = ModelService.getAllRecommendationsForUser;

/**
 * Calculates and contributes the recommendation score for another user's item based on that user's similarity
 * to the current user
 */
let calculateAndContribute = (userId, userSimilarity, items, otherUserItemWeight) => {

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
let createItemRecommendationsForUser = (userId, userSimilarities) => {
    return new Promise((resolve, reject) => {

        var userSimilarityMap = _.groupBy(userSimilarities, 'user'),
            otherUserIds = _.keys(userSimilarityMap, 'user');

        ModelService.getCursorForUserItemWeightsForUsers(otherUserIds)
            .then((otherUserItemWeightsCursor) => {

                var items = {};

                otherUserItemWeightsCursor.on('data', (otherUserItemWeights) => {
                    var otherUserId = otherUserItemWeights.user;
                    var userSimilarity = userSimilarityMap[otherUserId][0];

                    //log.info('Found %s item weights for other user %s', otherUserItemWeights.itemWeights.length, otherUserId);
                    otherUserItemWeights.itemWeights.forEach(calculateAndContribute.bind(null, userId, userSimilarity, items));
                });

                otherUserItemWeightsCursor.on('end', () => {
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
let transformUserItemRecommendations = (userId, userItemRecommendations) => {

    return new Promise((resolve, reject) => {

        //TODO Remove items for which the user has "enough" activity ?

        var recommendations = _.map( _.keys(userItemRecommendations), (itemId) => {
            return userItemRecommendations[itemId];
        }).filter((recommendation) => {
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
let transformUserSimilaritiesForUser = (userId, userSimilarities) => {
    var userIdString = userId + '';

    return Promise.map(userSimilarities, (userSimilarity) => {
        return {
            user: _.isEqual(userSimilarity.users[0] + '', userIdString ) ? userSimilarity.users[1] : userSimilarity.users[0],
            similarity: userSimilarity.similarity
        };
    }).filter((entry) => {
        return entry.user !== userIdString;
    });

};

/**
 * Based on a user's similarities to other users, create and return the full user recommendation object
 */
let createRecommendationsFromWeightsAndSimilarities = ( userId, userSimilarities ) => {
    return createItemRecommendationsForUser(userId, userSimilarities)
        .then( transformUserItemRecommendations.bind(this, userId) );
};

/**
 * Based on a user, manage the retrieval of similarities, the creation of the recommendations,
 * and the persistence of those recommendations to the database
 */
let calculateAndSaveUserRecommendations = ( userId ) => {
    var threshold = 0.1;
    // log.debug('Calculating user recommendations for %s', userId);
    return ModelService.getAllSimilaritiesForUser(userId, threshold)
        .then( transformUserSimilaritiesForUser.bind(this, userId) )
        .then( createRecommendationsFromWeightsAndSimilarities.bind(this, userId) )
        .then( (recommendationsToSave) => {
            // log.info('Saving recommendations for user %s', userId);
            return UserRecommendation.insertMany([recommendationsToSave])
                    .then(() => {
                        return Promise.resolve();
                    });
        } );
};

/**
 * Map out the creation of user recommendations for each of the input user IDs
 */
let calculateUsersRecommendations = ( allUserIds ) => {
    return Promise.map(allUserIds, calculateAndSaveUserRecommendations, { concurrency: 2 });
};

/**
 * Wipe the existing user recommendations and recalculate the new list based on
 * the set of all potential users who have hit the system
 */
module.exports.recalculateUserRecommendations = () => {
    // log.debug('Recalculating user recommendations');

    return ModelService.dropUserRecommendations()
        .then( ModelService.getAllUserIdsWithActivity )
        .then( calculateUsersRecommendations )
        .catch((err) => {
            // log.error('Unable to calculate user recommendations', err);
            return Promise.reject();
        });
};

/**
 * Marking a Recommendation for "Do Not Recommend" so that it will not show up
 * for the user again
 */
module.exports.markRecommendationDNR = (userId, itemId, itemType) => {

    return ModelService.getDoNotRecommendByUser(userId)
        .then((existingRecord) => {

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

// Backwards compatibility
module.exports.sampleRecommendationsForUser = SampleService.sampleRecommendationsForUser;

/**
 * For unit testing support
 */
module.exports.__ = {
    calculateAndContribute: calculateAndContribute,
    calculateUsersRecommendations: calculateUsersRecommendations,
    calculateAndSaveUserRecommendations: calculateAndSaveUserRecommendations,
    createRecommendationsFromWeightsAndSimilarities: createRecommendationsFromWeightsAndSimilarities,
    createItemRecommendationsForUser: createItemRecommendationsForUser,
    transformUserItemRecommendations: transformUserItemRecommendations,
    transformUserSimilaritiesForUser: transformUserSimilaritiesForUser
};
