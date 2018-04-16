'use strict';

const mongoose = require('mongoose'),
	Schema = mongoose.Schema;

/**
 * ITEM WEIGHT SCHEMA
 */
const ItemWeightSchema = new Schema({
    item: { type: String, index: true },
    itemMetadata: { type: Schema.Types.Mixed },
    weight: { type: Number }
}, {collection: 'recommendations.itemWeights'} );

const ItemWeightModel = mongoose.model('ItemWeight', ItemWeightSchema);

/**
 * USER ACTIVITY SCHEMA
 */
const UserActivitySchema = new Schema({
	user: { type: String },
	item: { type: String },
	itemMetadata: { type: Schema.Types.Mixed },
	action: { type: String },
	dateCreated: { type: Date, default: Date.now },
	lastUpdated: { type: Date, default: Date.now }
}, {collection: 'recommendations.userActivity'} );

UserActivitySchema.index({ user: 1, item: 1 });

// Set created/updated time
UserActivitySchema.pre('save', (next) => {
	const now = new Date();
	this.dateCreated = now;
	this.lastUpdated = now;
	next();
});

/**
 * USER to ITEM WEIGHT SCHEMA
 */
const UserItemWeightsSchema = new Schema({
	user: { type: String },
	itemWeights: { type: [ ItemWeightModel.schema ] },
	rowWeight: { type: Number }
}, {collection: 'recommendations.userItemWeights'} );
UserItemWeightsSchema.index({ user: 1 });

/**
 * USER SIMILARITY SCHEMA
 */
const UserSimilaritySchema = new Schema({
	users: { type: [String] },
	similarity: { type: Number }
}, {collection: 'recommendations.userSimilarities'} );
UserSimilaritySchema.index({ users: 1 });

/**
 * USER RECOMMENDATION SCHEMA
 */
const UserRecommendationSchema = new Schema({
	user: { type: String },
	recommendations: { type: [ ItemWeightModel.schema ] }
}, {collection: 'recommendations.userRecommendations'} );
UserRecommendationSchema.index({ user: 1 });

/**
 * USER DO NOT RECOMMEND SCHEMA
 */
const UserDoNotRecommendSchema = new Schema({
	user: { type: String },
	doNotRecommend: [ {
		item: { type: String },
		itemMetadata: { type: Schema.Types.Mixed }
	} ]
}, {collection: 'recommendations.userDoNotRecommend'} );
UserDoNotRecommendSchema.index({ user: 1 });

/**
 * USER ACTIVITY TO IGNORE SCHEMA
 */
const UserActivityIgnoredSchema = new Schema({
    user: { type: String, index: { unique: true } }
}, {collection: 'recommendations.userActivityIgnored'} );

mongoose.model('UserActivity', UserActivitySchema);
mongoose.model('UserItemWeights', UserItemWeightsSchema);
mongoose.model('UserSimilarity', UserSimilaritySchema);
mongoose.model('UserRecommendation', UserRecommendationSchema);
mongoose.model('UserDoNotRecommend', UserDoNotRecommendSchema);
mongoose.model('UserActivityIgnored', UserActivityIgnoredSchema);
