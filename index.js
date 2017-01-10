'use strict';

exports.activity = require('./lib/activity.service');
exports.similarity = require('./lib/similarity.service');
exports.recommendation = require('./lib/recommendation.service');
exports.model = require('./lib/model.service');

exports.run = function() {
    return exports.activity.recalculateUserItemWeights()
           		.then(exports.similarity.recalculateUserSimilarities)
           		.then(exports.recommendation.recalculateUserRecommendations);
};
