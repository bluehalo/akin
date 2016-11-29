# @asymmetrik/akin

[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Recommendation Engine Library based on Collaborative Filtering. Node.js implementation using MongoDB via Mongoose.

> Provides hooks for logging user activity on items referenced by an ObjectID and an optional item type. Additional methods provide execution of a scalable, collaborative filtering algorithm that outputs recommendation results for each user into a namespaced Mongo collections. These results can then be retrieved and integrated into the application as desired.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Install

Include this module as a dependency of your application in the `package.json` file. It also requires that MongooseJS is available as a peer dependency. For example:
```
{
  ...
  dependencies: {
    "mongoose": "~4.6",
    "@asymmetrik/akin": "latest"
  }
  ...
}
```

## Usage

Include the module via `require` wherever applicable:
```
var akin = require('@asymmetrik/akin');
```

The most fundamental use case of logging user activity, running the engine, and retrieving recommendations for a user is achieved via:
```
akin.activity.log(userId, itemId, 'itemType', 'action');
...
akin.run();
...
akin.recommendation.getAllRecommendationsForUser(userId);
```

There are four classes that allow for managing activity logs and recalculating recommendations at a more granular level:
### akin.model
Manages query execution for schemas

### akin.activity
1. Manage (add or remove) a user's activity for any item.
1. Calculates the first phase of the recommendation engine: user's weighted scores on items

### akin.similarity
1. Calculates the second phase of the recommendation engine: user's similarity to other users

### akin.recommendation
1. Calculates the third and final phase of the recommendation engine: collaborative filtering to generate recommendations
1. Allows for retrieval of all or a weighted random sample of recommendations
1. Marking items as `do not recommend` for a user to stop them from returning in the sampling query

## API

### recalculate all recommendations
Execute the recommendation engine based on the data supplied to the activity.log() API
> akin.run();

### activity
Add a user's activity on an item
> akin.activity.log(userId, itemId, 'itemType', 'actionType');

Remove a user's activity on an item
> akin.activity.removeLog(userId, itemId, 'actionType');

### retrieve recommendations
Get all recommendations created for a user
> akin.recommendation.getAllRecommendationsForUser(userId);

Get a sampling of recommendations created for a user based on a weighted cumulative distribution function
> akin.recommendation.sampleRecommendationsForUser(userId, numberOfSamples);

## Contribute

PRs accepted.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

Not licensed © Asymmetrik Ltd.
