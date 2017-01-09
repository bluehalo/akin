'use strict';

let mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    Promise = require('bluebird'),
    should = require('should'),

    modelService = require('../lib/model.service');

let UserActivity = mongoose.model('UserActivity');

let mongoDbTestConnectionString = 'mongodb://localhost/akin-test';

describe('Model Service', () => {

    before(() => {
        // connect to mongo test instance
        return mongoose.connect(mongoDbTestConnectionString);
    });

    after(() => {
        UserActivity.remove({}).then(() => {
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

        let now = new Date();

        new UserActivity({
            user: Schema.ObjectId(),
            item: Schema.ObjectId(),
            itemType: 'test-type',
            action: 'test-action'
        }).save().then((userActivity) => {
            should(userActivity.itemType).equal('test-type');
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
