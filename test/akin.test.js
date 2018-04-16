let akin = require('../index'),
    _ = require('lodash'),
    mongoose = require('mongoose'),
    should = require('should');

let mongoDbTestConnectionString = 'mongodb://localhost/akin-test',
    UserActivity = akin.model.model.UserActivity,
    UserItemWeights = akin.model.model.UserItemWeights;

describe('AKIN Recommendation Engine', () => {

    let user1 = 'user01',
        user2 = 'user02',
        item1 = 'item01',
        item2 = 'item02';

    before(() => {
        mongoose.Promise = global.Promise;
        // connect to mongo test instance
        return mongoose.connect(mongoDbTestConnectionString, { useMongoClient: true });
    });

    after(() => {
        var activity = UserActivity.remove({}),
            itemWeights = UserItemWeights.remove({});

        return Promise.all([activity, itemWeights])
        .then(() => {
            return UserActivity.count().then((count) => {
                should(count).equal(0);
            });
        }).then(() => {
            // disconnect from mongo test instance
            return mongoose.disconnect();
        });
    });

    it('should start with no user activity', (done) => {
        akin.model.getAllUserActivity().then((results) => {
            should(results).be.a.Array();
            should(results.length).equal(0);
            done();
        });
    });

    it('should calculate scores for test set', function(done) {
        akin.activity.log(user1, item1, 'item', 'view')
        .then(() => { return akin.activity.log(user1, item2, 'item', 'view'); })
        .then(() => { return akin.activity.log(user2, item1, 'item', 'view'); })
        .then(akin.run)
        .then(() => {
            return akin.model.getAllRecommendationsForUser(user2);
        })
        .then((results) => {
            var recommendations = results.recommendations;
            should(recommendations).be.a.Array();
            should(recommendations.length).equal(2);
            var item2Recommendation = _.find(recommendations, ['item', item2]);
            should(item2Recommendation.weight).equal(0.7071067811865475);
            done();
        })
        .catch(done);
    });

});