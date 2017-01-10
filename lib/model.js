'use strict';

var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var UserActivityStruct = {
	user: { type: Schema.ObjectId, index: true },
	item: { type: Schema.ObjectId, index: true },
	itemType: { type: String },
	action: { type: String },
	dateCreated: { type: Date, default: Date.now },
	lastUpdated: { type: Date, default: Date.now }
};
var ItemWeightStruct = {
    item: { type: Schema.ObjectId, index: true },
    itemType: { type: String },
    weight: { type: Number }
};
var ItemWeightSchema = new Schema(ItemWeightStruct, {collection: 'recommendations.itemWeights'} );
var ItemWeightModel = mongoose.model('ItemWeight', ItemWeightSchema);

var UserItemWeightsStruct = {
	user: { type: Schema.ObjectId, index: true },
	itemWeights: { type: [ ItemWeightModel.schema ] },
	rowWeight: { type: Number }
};

var UserSimilarityStruct = {
	users: { type: [Schema.ObjectId], index: true },
	similarity: { type: Number }
};

var UserRecommendationStruct = {
	user: { type: Schema.ObjectId, index: true },
	recommendations: { type: [ ItemWeightModel.schema ] }
};

var UserDoNotRecommendStruct = {
	user: { type: Schema.ObjectId, index: true },
	doNotRecommend: [ {
		item: { type: Schema.ObjectId },
		itemType: { type: String }
	} ]
};

var UserActivityIgnoredStruct = {
    user: { type: Schema.ObjectId, index: { unique: true } }
};

var ItemStruct = {
	name: { type: String },
	itemType: { type: String },
	img: { type: String }
};

var ItemSchema = new Schema(ItemStruct, {collection: 'recommendations.userActivityItems'} );
var UserActivitySchema = new Schema(UserActivityStruct, {collection: 'recommendations.userActivity'} );
var UserItemWeightsSchema = new Schema(UserItemWeightsStruct, {collection: 'recommendations.userItemWeights'} );
var UserSimilaritySchema = new Schema(UserSimilarityStruct, {collection: 'recommendations.userSimilarities'} );
var UserRecommendationSchema = new Schema(UserRecommendationStruct, {collection: 'recommendations.userRecommendations'} );
var UserDoNotRecommendSchema = new Schema(UserDoNotRecommendStruct, {collection: 'recommendations.userDoNotRecommend'} );
var UserActivityIgnoredSchema = new Schema(UserActivityIgnoredStruct, {collection: 'recommendations.userActivityIgnored'} );

// Set created/updated time
UserActivitySchema.pre('save', (next) => {
	var now = new Date();
	this.dateCreated = now;
	this.lastUpdated = now;
	next();
});

mongoose.model('UserActivityItem', ItemSchema);
mongoose.model('UserActivity', UserActivitySchema);
mongoose.model('UserItemWeights', UserItemWeightsSchema);
mongoose.model('UserSimilarity', UserSimilaritySchema);
mongoose.model('UserRecommendation', UserRecommendationSchema);
mongoose.model('UserDoNotRecommend', UserDoNotRecommendSchema);
mongoose.model('UserActivityIgnored', UserActivityIgnoredSchema);
