'use strict';

const mongoose = require('mongoose'),
    should = require('should'),

    ObjectId = mongoose.Types.ObjectId,

    modelService = require('../lib/model.service'),

    UserActivity = mongoose.model('UserActivity'),

    mongoDbTestConnectionString = 'mongodb://localhost/akin-test';

describe('Model Service', () => {

    before(() => {
        mongoose.Promise = global.Promise;
        // connect to mongo test instance
        return mongoose.connect(mongoDbTestConnectionString, { useMongoClient: true });
    });

    after(() => {
        return UserActivity.remove({}).then(() => {
            return UserActivity.count().then((count) => {
                should(count).equal(0);
            });
        }).then(() => {
            // disconnect from mongo test instance
            return mongoose.disconnect();
        });
    });

    it('should start with no user activity', (done) => {
        modelService.getAllUserActivity().then((results) => {
            should(results).be.a.Array();
            should(results.length).equal(0);
            done();
        });
    });

    it('should create user activity', (done) => {

        new UserActivity({
            user: ObjectId(),
            item: ObjectId(),
            itemMetadata: { type: 'test-type' },
            action: 'test-action'
        }).save().then((userActivity) => {
            should(userActivity.itemMetadata).eql({ type: 'test-type' });
            done();
        });
    });

    it('should have one user activity', (done) => {
        modelService.getAllUserActivity().then((results) => {
            should(results).be.a.Array();
            should(results.length).equal(1);
            done();
        });
    });

});
