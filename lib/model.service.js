'use strict';

var Promise = require('bluebird'),
	_ = require('lodash'),
	mongoose = require('mongoose');

var ObjectId = mongoose.Types.ObjectId;

require('./model.js');

var UserActivity = mongoose.model('UserActivity');
var UserActivityItem = mongoose.model('UserActivityItem');
var UserItemWeights = mongoose.model('UserItemWeights');
var ItemWeight = mongoose.model('ItemWeight');
var UserSimilarity = mongoose.model('UserSimilarity');
var UserRecommendation = mongoose.model('UserRecommendation');
var UserDoNotRecommend = mongoose.model('UserDoNotRecommend');
var UserActivityIgnored = mongoose.model('UserActivityIgnored');

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

var getAllByModel = function(model) {
    return new Promise(function(resolve, reject) {
        model
            .find()
            .then(resolve, reject);
    });
};

exports.getAllUserActivity = getAllByModel.bind(null, UserActivity);
exports.getAllUserActivityItems = getAllByModel.bind(null, UserActivityItem);
exports.getAllUserItemWeights = getAllByModel.bind(null, UserItemWeights);
exports.getAllUserSimilarities = getAllByModel.bind(null, UserSimilarity);

var dropAllByModel = function(model) {
    return new Promise(function(resolve, reject) {
        //TODO Backup to an archived version instead of wiping data?
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
exports.getActivityForUser = function(userId) {
    console.log('getting activity for ' + userId);
    return new Promise(function(resolve, reject) {
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
exports.getActivityForUserCursor = function(userId) {
    var cursor = UserActivity
        .find({ user: new ObjectId(userId) })
        .lean()
        .cursor();

    return Promise.resolve(cursor);
};

/**
 *
 */
exports.getAllUserIdsWithActivity = function() {

    // Filter out activity for users on the Ignore List
    return exports.getIgnoredList()
        .then(function(ignoredUsers) {
            var ignoredUserIds = _.map(ignoredUsers, 'user');
            return new Promise(function(resolve, reject) {
                UserActivity
                    .find({ user: { $nin: ignoredUserIds } })
                    .distinct('user', function(err, userIds) {
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
exports.getItemWeightsForUser = function(userId) {
    return new Promise(function(resolve, reject) {
        UserItemWeights
            .findOne({ user: userId })
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
exports.getCursorForUserItemWeightsForUsers = function(userIds) {
    var cursor = UserItemWeights
        .find({ 'user': { $in: userIds } })
        .lean() // do not include mongoose middleware
        .cursor();

    return Promise.resolve(cursor);
};

/**
 * Retrieves a lightweight mongo cursor for User Item Weights.
 * This is useful to guarantee that there will be overlap between a
 * set of item IDs and the other user item weights that will be looked at.
 *
 * Helps to avoid completely dissimilar users.
 */
exports.getCursorForUserItemWeightsForItems = function(itemIds) {
    var cursor = UserItemWeights
                     .find({ 'itemWeights.item': { $in: itemIds } })
                     .lean() // do not include mongoose middleware
                     .cursor();

    return Promise.resolve(cursor);
};

/**
 *
 */
exports.getAllSimilaritiesForUser = function(userId, threshold) {
    return new Promise(function(resolve, reject) {
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
exports.getAllRecommendationsForUser = function(userId) {
    return new Promise(function(resolve, reject) {
        UserRecommendation
            .findOne({ user: userId })
            .exec()
            .then(resolve, reject);
    });
};

/**
 * Retrieves a single UserDoNotRecommend object for the input user ID
 */
exports.getDoNotRecommendByUser = function(userId) {
    return new Promise(function(resolve, reject) {
        UserDoNotRecommend
            .findOne({ user: userId })
            .exec()
            .then(resolve, reject);
    });
};

/**
 *
 */
exports.getIgnoredList = function(populate) {
    return new Promise(function(resolve, reject) {
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
exports.addIgnoredUser = function(userId) {
    return new Promise(function(resolve, reject) {
        new UserActivityIgnored({ user: userId })
            .save()
            .then(resolve, reject);
    });
};

/**
 *
 */
exports.removeIgnoredUser = function(userId) {
    return new Promise(function(resolve, reject) {
        UserActivityIgnored
            .remove({ user: userId })
            .then(resolve, reject);
    });
};

exports.addUserActivityItem = function(item) {
	return new Promise(function(resolve, reject) {
        new UserActivityItem(item)
            .save()
            .then(resolve, reject);
    });
};

exports.removeUserActivityItem = function(itemId) {
	return new Promise(function(resolve, reject) {
		UserActivityItem
	        .remove({ _id: new ObjectId(itemId) })
	        .then(resolve, reject);
    });
};
