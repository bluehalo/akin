'use strict';

const _ = require('lodash'),
    Promise = require('bluebird'),

	ModelService = require('./model.service'),
	SampleService = require('./sample.service'),

	UserRecommendation = ModelService.model.UserRecommendation,
	UserDoNotRecommend = ModelService.model.UserDoNotRecommend;

/**
 * How many users will be processed at a time
 */
let concurrency = 2;

/**
 * Returns all recommendations for the input user ID
 */
const getAllRecommendationsForUser = ModelService.getAllRecommendationsForUser;

/**
 * Calculates and contributes the recommendation score for another user's item based on that user's similarity
 * to the current user
 */
const calculateAndContribute = (userId, userSimilarity, items, otherUserItemWeight) => {

    // If the item was not yet found, initialize it with a zero-weight recommendation
    if( !_.has(items, otherUserItemWeight.item) ) {
        items[otherUserItemWeight.item] = {
            item: otherUserItemWeight.item,
            itemMetadata: otherUserItemWeight.itemMetadata,
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
const createItemRecommendationsForUser = (userId, userSimilarities) => {
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
const transformUserItemRecommendations = (userId, userItemRecommendations) => {

    return new Promise((resolve, reject) => {

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
const transformUserSimilaritiesForUser = (userId, userSimilarities) => {
    var userIdString = userId + '';

    return Promise.map(userSimilarities, (userSimilarity) => {
        return {
            user: _.isEqual(userSimilarity.users[0] + '', userIdString ) ? userSimilarity.users[1] : userSimilarity.users[0],
            similarity: userSimilarity.similarity
        };
    }, { concurrency: concurrency }).filter((entry) => {
        return entry.user !== userIdString;
    });

};

/**
 * Based on a user's similarities to other users, create and return the full user recommendation object
 */
const createRecommendationsFromWeightsAndSimilarities = ( userId, userSimilarities ) => {
    return createItemRecommendationsForUser(userId, userSimilarities)
        .then( transformUserItemRecommendations.bind(this, userId) );
};

/**
 * Based on a user, manage the retrieval of similarities, the creation of the recommendations,
 * and the persistence of those recommendations to the database
 */
const calculateAndSaveUserRecommendations = ( userId ) => {
    var threshold = 0.1;

    return ModelService.getAllSimilaritiesForUser(userId, threshold)
        .then( transformUserSimilaritiesForUser.bind(this, userId) )
        .then( createRecommendationsFromWeightsAndSimilarities.bind(this, userId) )
        .then( (recommendationsToSave) => {

            return UserRecommendation.insertMany([recommendationsToSave])
                    .then(() => {
                        return Promise.resolve();
                    });
        } );
};

/**
 * Map out the creation of user recommendations for each of the input user IDs
 */
const calculateUsersRecommendations = ( allUserIds ) => {
    return Promise.map(allUserIds, calculateAndSaveUserRecommendations, { concurrency: concurrency });
};

/**
 * Wipe the existing user recommendations and recalculate the new list based on
 * the set of all potential users who have hit the system
 */
const recalculateUserRecommendations = () => {
    // log.debug('Recalculating user recommendations');

    return ModelService.dropUserRecommendations()
        .then( ModelService.getAllUserIdsWithActivity )
        .then( calculateUsersRecommendations )
        .catch( (err) => {
            // log.error('Unable to calculate user recommendations', err);
            return Promise.reject(err);
        });
};

/**
 * Marking a Recommendation for "Do Not Recommend" so that it will not show up
 * for the user again
 */
const markRecommendationDNR = (userId, itemId, itemMetadata) => {

    return ModelService.getDoNotRecommendByUser(userId)
        .then( (existingRecord) => {

            if( _.isEmpty(existingRecord) ) {
                // Create DNR entry
                existingRecord = new UserDoNotRecommend({
                    user: userId,
                    doNotRecommend: []
                });
            }

            // Add the item ID + Type to the list
            existingRecord.doNotRecommend.addToSet({
                item: itemId,
                itemMetadata: itemMetadata
            });

            return existingRecord.save();
        });

};

/**
 * Updates the concurrency level used for calculating user-to-user similarities. Default: 2
 * @param {number} newConcurrency - the number of concurrent users whose similarity will be calculated against other users
 */
const setConcurrency = (newConcurrency) => {
    concurrency = newConcurrency;
};

module.exports = {
    getAllRecommendationsForUser,
    markRecommendationDNR,
    recalculateUserRecommendations,
    setConcurrency,

    // Backwards compatibility
    sampleRecommendationsForUser: SampleService.sampleRecommendationsForUser
};
