'use strict';

let Promise = require('bluebird'),
	_ = require('lodash'),

    ModelService = require('./model.service'),

    UserSimilarity = ModelService.model.UserSimilarity;

/**
 * Guarantees the same unique value is generated for two user IDs
 * no matter which order they are used in
 */
let getUserSimilarityKey = (user1, user2) => {
    return _.gt(user1 + '', user2 + '') ?
            user1 + '-' + user2 :
            user2 + '-' + user1;
};

/**
 *
 */
let getUserSimilarityNumber = (userWeightRow1, user1Items, userWeightRow2, user2Items) => {

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
let calculateUserSimilarity = (allUserSimilarities, user1) => {

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
let calculateAndSaveUserSimilarity = (allUserSimilarities, userId) => {
    // log.info('Calculating similarity for %s', userId);

    return calculateUserSimilarity(allUserSimilarities, userId)
                .then((usersSimilarities) => {
                    if( _.isEmpty(usersSimilarities) ) {
                        // log.debug('Skipping empty user similarities: %j', usersSimilarities);
                        return Promise.resolve();
                    }

                    // log.debug('Saving %s user similarities for %s', usersSimilarities.length, userId);
                    return UserSimilarity.insertMany(usersSimilarities)
                            .then(() => {
                                return Promise.resolve();
                            });
                });
};

/**
 *
 */
let calculateUserSimilarities = (allUserIds) => {

    // log.info('Calculating user similarities for %s users', allUserIds.length);
    var allUserSimilarities = {};
    return Promise.map( allUserIds, calculateAndSaveUserSimilarity.bind(this, allUserSimilarities), { concurrency: 20 });

};

/**
 *
 */
module.exports.recalculateUserSimilarities = () => {
    // log.debug('Recalculating user similarities');

    return ModelService.dropUserSimilarities()
        .then(ModelService.getAllUserIdsWithActivity)
        .then( calculateUserSimilarities )
        .catch( (err) => {
            // log.error('Unable to calculate user similarities', err);
            return Promise.reject(err);
        });

};

/**
 * For unit testing support
 */
module.exports.__ = {
    calculateUserSimilarities: calculateUserSimilarities,
    calculateAndSaveUserSimilarity: calculateAndSaveUserSimilarity,
    calculateUserSimilarity: calculateUserSimilarity,
    getUserSimilarityNumber: getUserSimilarityNumber,
    getUserSimilarityKey: getUserSimilarityKey
};
