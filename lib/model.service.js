'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
    ObjectId = mongoose.Types.ObjectId;

require('./model');

let UserActivity = mongoose.model('UserActivity'),
    UserActivityItem = mongoose.model('UserActivityItem'),
    UserItemWeights = mongoose.model('UserItemWeights'),
    ItemWeight = mongoose.model('ItemWeight'),
    UserSimilarity = mongoose.model('UserSimilarity'),
    UserRecommendation = mongoose.model('UserRecommendation'),
    UserDoNotRecommend = mongoose.model('UserDoNotRecommend'),
    UserActivityIgnored = mongoose.model('UserActivityIgnored');

exports.model = {
    UserActivity: UserActivity,
    UserActivityItem: UserActivityItem,
    UserItemWeights: UserItemWeights,
    ItemWeight: ItemWeight,
    UserSimilarity: UserSimilarity,
    UserRecommendation: UserRecommendation,
    UserDoNotRecommend: UserDoNotRecommend,
    UserActivityIgnored: UserActivityIgnored
};

let getAllByModel = (model) => {
    return new Promise((resolve, reject) => {
        model
            .find()
            .then(resolve, reject);
    });
};

/**
 * Returns a single model object found to match a particular userId
 */
let findOneByUserId = (modelSchema, userId) => {
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
let getUserItemWeightsCursor = (field, ids) => {
    var query = {};
    query[field] = { $in: ids };
    var cursor = UserItemWeights
        .find(query)
        .lean() // do not include mongoose middleware
        .cursor();

    return Promise.resolve(cursor);
};

exports.getAllUserActivity = getAllByModel.bind(null, UserActivity);
exports.getAllUserActivityItems = getAllByModel.bind(null, UserActivityItem);
exports.getAllUserItemWeights = getAllByModel.bind(null, UserItemWeights);
exports.getAllUserSimilarities = getAllByModel.bind(null, UserSimilarity);

let dropAllByModel = (model) => {
    return new Promise((resolve, reject) => {
        model
            .remove()
            .exec()
            .then(resolve, reject);
    });
};

exports.dropUserItemWeights = dropAllByModel.bind(null, UserItemWeights);
exports.dropUserSimilarities = dropAllByModel.bind(null, UserSimilarity);
exports.dropUserRecommendations = dropAllByModel.bind(null, UserRecommendation);

/**
 *
 */
exports.getActivityForUser = (userId) => {
    return new Promise((resolve, reject) => {
        UserActivity
            .find({ user: new ObjectId(userId) })
            .lean()
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
exports.getActivityForUserCursor = (userId) => {
    var cursor = UserActivity
        .find({ user: new ObjectId(userId) })
        .lean()
        .cursor();

    return Promise.resolve(cursor);
};

/**
 *
 */
exports.getAllUserIdsWithActivity = () => {

    // Filter out activity for users on the Ignore List
    return exports.getIgnoredList()
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
exports.getItemWeightsForUser = (userId) => {
    return findOneByUserId(UserItemWeights, userId);
};

/**
 *
 */
exports.getCursorForUserItemWeightsForUsers = (userIds) => {
    return getUserItemWeightsCursor('user', userIds);
};

/**
 * Retrieves a lightweight mongo cursor for User Item Weights.
 * This is useful to guarantee that there will be overlap between a
 * set of item IDs and the other user item weights that will be looked at.
 *
 * Helps to avoid completely dissimilar users.
 */
exports.getCursorForUserItemWeightsForItems = (itemIds) => {
    return getUserItemWeightsCursor('itemWeights.item', itemIds);
};

/**
 *
 */
exports.getAllSimilaritiesForUser = (userId, threshold) => {
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
exports.getAllRecommendationsForUser = (userId) => {
    return findOneByUserId(UserRecommendation, userId);
};

/**
 * Retrieves a single UserDoNotRecommend object for the input user ID
 */
exports.getDoNotRecommendByUser = (userId) => {
    return findOneByUserId(UserDoNotRecommend, userId);
};

/**
 *
 */
exports.getIgnoredList = (populate) => {
    return new Promise((resolve, reject) => {
        var query = UserActivityIgnored.find({});
        if(populate) {
            query = query.populate('user');
        }
        query.exec().then(resolve, reject);
    });
};

/**
 *
 */
exports.addIgnoredUser = (userId) => {
    return new Promise((resolve, reject) => {
        new UserActivityIgnored({ user: userId })
            .save()
            .then(resolve, reject);
    });
};

/**
 *
 */
exports.removeIgnoredUser = (userId) => {
    return new Promise((resolve, reject) => {
        UserActivityIgnored
            .remove({ user: userId })
            .then(resolve, reject);
    });
};

exports.addUserActivityItem = (item) => {
	return new Promise((resolve, reject) => {
        new UserActivityItem(item)
            .save()
            .then(resolve, reject);
    });
};

exports.removeUserActivityItem = (itemId) => {
	return new Promise((resolve, reject) => {
		UserActivityItem
	        .remove({ _id: new ObjectId(itemId) })
	        .then(resolve, reject);
    });
};
