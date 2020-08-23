'use strict';

const _ = require('lodash'),
    weightedRandom = require('weighted-random-object'),

    ModelService = require('./model.service');

/**
 * Returns a number of samples from the input collection
 * randomly selected based on their 'weight' value
 */
const getSamples = (collection = [], sampleSize = 1) => {

    // clone the original input array since we'll be removing elements from it
    const elements = _.clone(collection);

    const actualSamples = _.min([_.size(collection), sampleSize]);

    return _.times(actualSamples, () => {
        var selected = weightedRandom(elements);
        var index = _.findIndex(elements, selected);
        elements.splice(index, 1);
        return selected;
    });

};

/**
 * Based on the input UserItemWeights object, return a map of the
 * item IDs to their weights for this user
 */
const getItemIdToWeightMap = (userItemWeights) => {
    const itemIdToWeightMap = {};
    _.forEach(_.get(userItemWeights, 'itemWeights', []), (itemWeight) => {
        itemIdToWeightMap[itemWeight.item] = itemWeight.weight;
    });
    return itemIdToWeightMap;
};

/**
 * Filter out recommendations where:
 * 1. the user requested to not see the recommendation again (the "DNR" list)
 * 2. the user has a sufficiently high weight ("they've seen it enough")
 * 3. or a sufficiently low recommendation score
 * @param {string[]} dnr the "Do Not Recommend" list to check for the recommended item
 * @param {object} itemToWeightMap the map of items to their weights
 * @param {object} recommendation the recommendation that may be filtered out
 */
const filterRecommendations = (dnr, itemToWeightMap, recommendation) => {
    // If the item is in the DNR list, ignore it
    if(!_.isEmpty(dnr) && dnr.items) {
        if (dnr.items[recommendation.item]) return false
    }

    // TODO Determine what these numbers / thresholds should be. Also, make them configurable
    return recommendation.weight > 0.5 || itemToWeightMap[recommendation.item] <= 2;
};

const addScoreToItems = (scoreMap, items) => {
    return _.map(items, (item) => {
        var recommendationScore = scoreMap[item._id];
        // log.debug('found recommendation score of %s', recommendationScore);
        return {
            score: recommendationScore,
            item: item
        };
    });
};

/**
 * For the passed-in user, retrieve up to a number of samples based on their
 * recommendations from the collaborative filtering output. Default to 20 samples
 */
const sampleRecommendationsForUser = (userId, numberOfSamples = 20) => {

    var recommendationPromise = ModelService.getAllRecommendationsForUser(userId);
    var itemWeightsPromise = ModelService.getItemWeightsForUser(userId);
    var doNotRecommendPromise = ModelService.getDoNotRecommendByUser(userId);

    return Promise.all([recommendationPromise, itemWeightsPromise, doNotRecommendPromise])
    .then(([userRecommendationsObj, userItemWeights, dnr]) => {

        var itemIdToWeightMap = getItemIdToWeightMap(userItemWeights);

        var allRecommendations = _.get(userRecommendationsObj, 'recommendations', []);

        var itemToScoreMap = {};
        _.forEach(allRecommendations, (rec) => {
            itemToScoreMap[rec.item] = rec.weight;
        });

        var filteredRecommendations = _.filter(allRecommendations, filterRecommendations.bind(this, dnr, itemIdToWeightMap));

        var sampleRecommendations = getSamples(filteredRecommendations, numberOfSamples);

        return addScoreToItems(itemToScoreMap, _.map(sampleRecommendations, 'item'));

    });
};

module.exports = {
    getSamples,
    sampleRecommendationsForUser
};
