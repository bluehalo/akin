'use strict';

const activity = require('./lib/activity.service'),
    similarity = require('./lib/similarity.service'),
    recommendation = require('./lib/recommendation.service'),
    model = require('./lib/model.service');

const run = () => {
    return activity.recalculateUserItemWeights()
            .then(similarity.recalculateUserSimilarities)
            .then(recommendation.recalculateUserRecommendations);
};

/**
 * Updates the concurrency level for each of the underlying parallel tasks.
 * @param {number} newConcurrency - the new concurrency that will be used across the library's calculations
 */
const setConcurrency = (newConcurrency) => {
    return new Promise((resolve, reject) => {
        activity.setConcurrency(newConcurrency);
        similarity.setConcurrency(newConcurrency);
        recommendation.setConcurrency(newConcurrency);
        resolve();
    });
};

/**
 * Public API
 */
module.exports = {
    activity,
    model,
    recommendation,
    run,
    setConcurrency,
    similarity
};
