'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose');

require('./model');

const UserActivity = mongoose.model('UserActivity'),
    UserItemWeights = mongoose.model('UserItemWeights'),
    ItemWeight = mongoose.model('ItemWeight'),
    UserSimilarity = mongoose.model('UserSimilarity'),
    UserRecommendation = mongoose.model('UserRecommendation'),
    UserDoNotRecommend = mongoose.model('UserDoNotRecommend'),
    UserActivityIgnored = mongoose.model('UserActivityIgnored');

const model = {
    UserActivity: UserActivity,
    UserItemWeights: UserItemWeights,
    ItemWeight: ItemWeight,
    UserSimilarity: UserSimilarity,
    UserRecommendation: UserRecommendation,
    UserDoNotRecommend: UserDoNotRecommend,
    UserActivityIgnored: UserActivityIgnored
};

const getAllByModel = (model) => {
    return new Promise((resolve, reject) => {
        model
            .find()
            .then(resolve, reject);
    });
};

/**
 * Returns a single model object found to match a particular userId
 */
const findOneByUserId = (modelSchema, userId) => {
    return new Promise((resolve, reject) => {
        modelSchema
            .findOne({ user: userId })
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
const getUserItemWeightsCursor = (field, ids) => {
    var query = {};
    query[field] = { $in: ids };
    var cursor = UserItemWeights
        .find(query)
        .lean() // do not include mongoose middleware
        .cursor();

    return Promise.resolve(cursor);
};

const dropAllByModel = (model) => {
    return new Promise((resolve, reject) => {
        model
            .remove()
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
const getActivityForUser = (userId) => {
    return new Promise((resolve, reject) => {
        UserActivity
            .find({ user: userId })
            .lean()
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
const getActivityForUserCursor = (userId) => {
    var cursor = UserActivity
        .find({ user: userId })
        .lean()
        .cursor();

    return Promise.resolve(cursor);
};

/**
 *
 */
const getAllUserIdsWithActivity = () => {

    // Filter out activity for users on the Ignore List
    return getIgnoredList()
        .then((ignoredUsers) => {
            var ignoredUserIds = _.map(ignoredUsers, 'user');
            return new Promise((resolve, reject) => {
                UserActivity
                    .find({ user: { $nin: ignoredUserIds } })
                    .distinct('user', (err, userIds) => {
                        if(err) {
                            reject(err);
                            return;
                        }
                        resolve(userIds);
                    });
            });
        });
};

/**
 *
 */
const getItemWeightsForUser = (userId) => {
    return findOneByUserId(UserItemWeights, userId);
};

/**
 *
 */
const getCursorForUserItemWeightsForUsers = (userIds) => {
    return getUserItemWeightsCursor('user', userIds);
};

/**
 * Retrieves a lightweight mongo cursor for User Item Weights.
 * This is useful to guarantee that there will be overlap between a
 * set of item IDs and the other user item weights that will be looked at.
 *
 * Helps to avoid completely dissimilar users.
 */
const getCursorForUserItemWeightsForItems = (itemIds) => {
    return getUserItemWeightsCursor('itemWeights.item', itemIds);
};

/**
 *
 */
const getAllSimilaritiesForUser = (userId, threshold) => {
    return new Promise((resolve, reject) => {
        // Query for similarities including this user
        UserSimilarity
            .find({ 'users': userId, similarity: { $gt: threshold } })
            .lean()
            .exec()
            .then( resolve, reject );
    });
};

/**
 * Returns all recommendations for the input user ID
 */
const getAllRecommendationsForUser = (userId) => {
    return findOneByUserId(UserRecommendation, userId);
};

/**
 * Retrieves a single UserDoNotRecommend object for the input user ID
 */
const getDoNotRecommendByUser = (userId) => {
    return findOneByUserId(UserDoNotRecommend, userId);
};

/**
 *
 */
const getIgnoredList = () => {
    return new Promise((resolve, reject) => {
        UserActivityIgnored
            .find({})
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
const addIgnoredUser = (userId) => {
    return new Promise((resolve, reject) => {
        new UserActivityIgnored({ user: userId })
            .save()
            .then(resolve, reject);
    });
};

/**
 *
 */
const removeIgnoredUser = (userId) => {
    return new Promise((resolve, reject) => {
        UserActivityIgnored
            .remove({ user: userId })
            .then(resolve, reject);
    });
};

module.exports = {
    addIgnoredUser,
    dropUserItemWeights: dropAllByModel.bind(null, UserItemWeights),
    dropUserSimilarities: dropAllByModel.bind(null, UserSimilarity),
    dropUserRecommendations: dropAllByModel.bind(null, UserRecommendation),
    getActivityForUser,
    getActivityForUserCursor,
    getAllRecommendationsForUser,
    getAllSimilaritiesForUser,
    getAllUserActivity: getAllByModel.bind(null, UserActivity),
    getAllUserIdsWithActivity,
    getAllUserItemWeights: getAllByModel.bind(null, UserItemWeights),
    getAllUserSimilarities: getAllByModel.bind(null, UserSimilarity),
    getCursorForUserItemWeightsForItems,
    getCursorForUserItemWeightsForUsers,
    getDoNotRecommendByUser,
    getIgnoredList,
    getItemWeightsForUser,
    model,
    removeIgnoredUser
};
