'use strict';

const activity = require('./lib/activity.service'),
    similarity = require('./lib/similarity.service'),
    recommendation = require('./lib/recommendation.service'),
    model = require('./lib/model.service');

const run = function() {
    return activity.recalculateUserItemWeights()
            .then(similarity.recalculateUserSimilarities)
            .then(recommendation.recalculateUserRecommendations);
};

/**
 * Public API
 */
module.exports = {
    activity,
    model,
    recommendation,
    run,
    similarity
};
