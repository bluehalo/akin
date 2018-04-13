const should = require('should'),
    sampleService = require('../lib/sample.service');

describe('Sample Service', function() {
    it('should return nothing for 0 samples', (done) => {
        let samples = [{id: '4', weight: 1}];
        let selected = sampleService.getSamples(samples, 0);
        should(selected).be.a.Array();
        should(selected.length).equal(0);
        done();
    });
    it('should return a single entry for a single input', (done) => {
        let samples = [{id: '4', weight: 1}];
        let selected = sampleService.getSamples(samples, 1);
        should(selected).be.a.Array();
        should(selected.length).equal(1);
        should(selected[0].id).equal('4');
        done();
    });
    it('should return both entries for two inputs and two samples', (done) => {
        let samples = [{id: '4', weight: 1}, {id: '5', weight: 2}];
        let selected = sampleService.getSamples(samples, 2);
        should(selected).be.a.Array();
        should(selected.length).equal(2);
        done();
    });
    it('should return a single entry for multiple inputs', (done) => {
        let samples = [{id: '4', weight: 1}, {id: '5', weight: 2}, {id: '6', weight: 20}];
        let selected = sampleService.getSamples(samples, 1);
        should(selected).be.a.Array();
        should(selected.length).equal(1);
        done();
    });
});
