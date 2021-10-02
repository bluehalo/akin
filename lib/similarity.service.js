'use strict';

const _ = require('lodash'),
    Promise = require('bluebird'),

    ModelService = require('./model.service'),

    UserSimilarity = ModelService.model.UserSimilarity;

/**
 * How many users will be processed at a time
 */
let concurrency = 2;

/**
 * Guarantees the same unique value is generated for two user IDs
 * no matter which order they are used in
 */
const getUserSimilarityKey = (user1, user2) => {
    return _.gt(user1 + '', user2 + '') ?
            user1 + '-' + user2 :
            user2 + '-' + user1;
};

/**
 *
 */
const getUserSimilarityNumber = (userWeightRow1, user1Items, userWeightRow2, user2Items) => {

    var user1 = userWeightRow1.user,
        user2 = userWeightRow2.user;

    if( _.isEqual(user1, user2) ) {
        // users have similarity of 1 compared to themselves. skip unnecessary processing
        return 1;
    }

    var matrixSum = 0;

    _.forEach(_.keys(user1Items), (potentialItemIdMatch) => {
        if( _.has(user2Items, potentialItemIdMatch) ) {

            // Multiply the values where the users have weights for the same item
            var u1weight = user1Items[potentialItemIdMatch][0].weight,
                u2weight = user2Items[potentialItemIdMatch][0].weight;

            // log.debug('User %s and %s have weights of %s and %s for item %s', user1, user2, u1weight, u2weight, potentialItemIdMatch);
            matrixSum += (u1weight * u2weight);

        }
        else {
            // log.debug('User %s does not have a score for item %s, so skipping', user2, potentialItemIdMatch);
        }
    });

    var similarity = matrixSum / ( userWeightRow1.rowWeight * userWeightRow2.rowWeight );

    return similarity || 0;
};

/**
 *
 */
const calculateUserSimilarity = (allUserSimilarities, user1) => {

    return new Promise((resolve, reject) => {

        var currentUserItemWeights = null;
        // log.debug('Getting item weights for %s', user1);

        // 1. Find User's Item Weights
        ModelService.getItemWeightsForUser(user1)
            // 2. Get all item IDs for this user
            .then( (userItemWeight) => {
                userItemWeight = _.isEmpty(userItemWeight) ? {} :  userItemWeight;
                // log.debug('Calculating similarity for %s based on item weights: %j', user1, userItemWeight);
                currentUserItemWeights = userItemWeight;
                return _.map(userItemWeight.itemWeights, 'item');
            })
            // 3. Get a cursor for all other user item weights for that user's items
            .then( ModelService.getCursorForUserItemWeightsForItems )
            // 4. Iterate through the user item weights to calculate similarity
            .then( (otherUserItemWeightsCursor) => {

                var userSimilarities = [];
                // log.debug('Got item weights cursor for %s', user1);

                var user1Items = _.groupBy(currentUserItemWeights.itemWeights, 'item');

                otherUserItemWeightsCursor.on('data', (otherUserItemWeight) => {
                    var user2 = otherUserItemWeight.user;
                    // log.debug('Found user %s with %s item weights', user2, _.size(otherUserItemWeight.itemWeights));
                    var userMatchKey = getUserSimilarityKey(user1, user2);
                    if( allUserSimilarities[userMatchKey] ) {
                        // log.debug('Skipping calculation of user similarity because it already exists for %s', userMatchKey);
                        return;
                    }

                    // indicate to other promises that this is being processed to reduce
                    allUserSimilarities[userMatchKey] = true;

                    var user2Items = _.groupBy(otherUserItemWeight.itemWeights, 'item');

                    var similarity = getUserSimilarityNumber(currentUserItemWeights, user1Items, otherUserItemWeight, user2Items);

                    // log.debug('Found cosine similarity between %s and %s to be %s', user1, user2, similarity);

                    userSimilarities.push({
                        users: [user1, user2],
                        similarity: similarity
                    });
                });

                otherUserItemWeightsCursor.on('end', () => {
                    // log.info('Found %s similar users to %s', userSimilarities.length, user1);
                    // Resolve all of this user's similarities to save at once
                    resolve(userSimilarities);
                });

            })
            .catch( (err) => {
                reject(err);
            });


    });

};

/**
 *
 */
const calculateAndSaveUserSimilarity = (allUserSimilarities, userId) => {

    return calculateUserSimilarity(allUserSimilarities, userId)
        .then((usersSimilarities) => {
            if( _.isEmpty(usersSimilarities) ) {
                return Promise.resolve();
            }

            return UserSimilarity.insertMany(usersSimilarities)
                    .then(() => {
                        return Promise.resolve();
                    });
        });
};

/**
 *
 */
const calculateUserSimilarities = (allUserIds) => {
    const allUserSimilarities = {};
    return Promise.map(allUserIds, calculateAndSaveUserSimilarity.bind(this, allUserSimilarities), { concurrency: concurrency });
};

/**
 *
 */
const recalculateUserSimilarities = () => {
    console.time('recalculateUserSimilarities')
    return ModelService.dropUserSimilarities()
        .then(ModelService.getAllUserIdsWithActivity)
        .then( calculateUserSimilarities );

};

/**
 * Updates the concurrency level used for calculating user-to-user similarities. Default: 2
 * @param {number} newConcurrency - the number of concurrent users whose similarity will be calculated against other users
 */
const setConcurrency = (newConcurrency) => {
    concurrency = newConcurrency;
};

module.exports = {
    recalculateUserSimilarities,
    setConcurrency
};
