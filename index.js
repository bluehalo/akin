'use strict';

exports.activity = require('./lib/activity.service.js');
exports.similarity = require('./lib/similarity.service.js');
exports.recommendation = require('./lib/recommendation.service.js');
exports.model = require('./lib/model.service.js');

exports.run = function() {
    return exports.activity.recalculateUserItemWeights()
           		.then(exports.similarity.recalculateUserSimilarities)
           		.then(exports.recommendation.recalculateUserRecommendations);
};
