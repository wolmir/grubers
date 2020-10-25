const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const monk = require('monk');
const yup = require('yup');
const jwtMiddleware = require('express-jwt');
const jwt = require('jsonwebtoken');
const seedrandom = require('seedrandom');
const coinbase = require('coinbase-commerce-node');

const CoinbaseClient = coinbase.Client;

CoinbaseClient.init(process.env.COINBASE_API_KEY);

const GameNames = {
    TRADING_GAME: 'Trading Game',
    GRUBERS_EXCHANGE: 'Grubers Exchange'
};

const rootRng = seedrandom(process.env.ROOT_SEED);

const grainMs = {
    H1: 3600000,
    M1: 60000,
    M5: 300000,
    M15: 900000,
    D: 86400000,
};

const OrderStatus = {
    PENDING: 'pending',
    FILLED: 'filled',
    CANCELLED: 'cancelled',
    ERROR: 'error',
};

const OperationType = {
    BUY: 'buy',
    SELL: 'sell',
};

const OrderType = {
    MARKET: 'market',
    LIMIT: 'limit',
    STOP: 'stop',
};

const OrderError = {
    INSUFFICIENT_FUNDS: 'insufficient_funds',
};

/** ------ LIBRARY ------- */
const TWO_PI = Math.PI * 2;
const ONE_YEAR = 31536000000;

// function cosTable(size) {
//     const twoPi = Math.PI * 2;
//     const table = new Array(size).fill(0);
//     const piece = (twoPi / size);

//     for (let i = 0; i < size; i++) {
//         const param = piece * i;
//         table[i] = Math.cos(param);
//     }

//     return table;
// }

// function tableCos(table) {
//     const size = table.length;

//     return function (param) {
//         const piece = (Math.PI * 2) / size;
//         const round = Math.floor(param / piece);
//         // console.log(round);

//         return table[round];
//     }
// }

// const cosf = (p) => Math.cos(p);//tableCos(cosTable(10000));


/**
 * Given a percentage, returns the annual price drift of a product.
 *
 * @param {number} perc - The percentage, 0.02 for 2%, for example.
 * @param {number} t - The time in milliseconds.
 */
const driftFunc = perc => t => {
    return Math.floor((t * perc) / ONE_YEAR); // 315360000000
};

/**
 * Given a number between -1 and 1,
 * returns a number between 1 and 0;
 */
function waveFunc(n) {
    return 1.0 - (n * 0.5 + 0.5);
}

/**
 * Givem a period, in milliseconds, return a cos function with that period..
 */
const grbWaveFunc = (period, phase = 0) => (t) => {
    const periodNumber = Math.floor(t / period);
    // const newPeriod = (periodNumber % 3 === 1) ? Math.floor(period/2) : period;
    const newPeriod = period * (0.5 + waveFunc(Math.cos(periodNumber)));

    return waveFunc(Math.cos((TWO_PI / newPeriod) * (t - (phase * newPeriod)))); //  - (phase * newPeriod)
};

const waveLake = (lakeSeed, numberOfWaves, rouletteSize) => {
    const trnd = seedrandom(lakeSeed);
    const waves = new Array(numberOfWaves).fill(0);
    const weights = new Array(numberOfWaves).fill(0);

    for (let i = 0; i < numberOfWaves; i++) {
        const stretch = 1 + ((4 - (trnd() * 8)) / 10);

        waves[i] = {
            period: (100 * (3 ** i)) * stretch,
            phase: trnd(),
        };
    }

    let weightPool = rouletteSize;

    while (weightPool > 0) {
        const player = Math.floor(trnd() * waves.length);
        const points = 1.4 ** player;

        weights[player] += points;

        weightPool -= points;
    }

    return {
        waves: waves.map(({ period, phase }) => grbWaveFunc(period, phase)),
        weights: weights.map((w, i) => {
            const constant = w / (rouletteSize * 1.0);

            return (t) => {
                if (Math.floor(t / waves[i].period) % 3 === 1) {
                    return constant * 2;
                }
                return constant;
            };
        })
    };
};

function formula(initialPrice, hardLimit, weights, waves, drift, time) {
    let reduced = 0;

    const wl = waves.length;

    for (let z = 0; z < wl; z++) {
        reduced = reduced + weights[z](time) * waves[z](time);
    }

    let drifted = drift(time);

    let result = initialPrice * ((Math.abs(1 - hardLimit * reduced)) + drifted);

    return result;
}

// function zip(a1, a2) {
//     if (a1.length !== a2.length) {
//         throw new Error('Arrays are different sizes');
//     }

//     const ret = [];

//     a1.forEach((el, index) => {
//         ret.push([el, a2[index]]);
//     });

//     return ret;
// }
/** ------- LIBRARY ------ */

class CustomError {
    constructor(status, message) {
        this.status = status;
        this.message = message;
    }
}

class UnauthorizedError extends CustomError {
    constructor(message) {
        super(401, message);
    }
}

class ConflictError extends CustomError {
    constructor(message) {
        super(409, message);
    }
}

class BadRequestError extends CustomError {
    constructor(message) {
        super(400, message);
    }
}

class NotFoundError extends CustomError {
    constructor(message) {
        super(404, message);
    }
}

class UnprocessableError extends CustomError {
    constructor(message) {
        super(422, message);
    }
}
const granularityRegex = /^(M1|M5|M15|M30|H1|H4|D)$/;

const {
    MONGO_DB,
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOSTNAME,
    MONGO_PORT,
} = process.env;

const db = monk(`${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`);

// db.addMiddleware(require('monk-middleware-wrap-non-dollar-update'));

const app = express();

app.set('case sensitive routing', true);

app.use(helmet());

app.use(morgan('dev'));

// TODO: Use stricter cors config.
app.use(cors());

app.use(express.json());
app.use('/', express.static('./public'));

app.use(jwtMiddleware({
    secret: new Buffer(process.env.EVA_JWT_SECRET || 'eva-dev', 'base64'),
    algorithms: ['HS256'],
}).unless({
    path: ['/api/v1/login', '/api/v1/registration/user', '/ngsw-worker.js']
}));

const loginSchema = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string().required(),
});

const userRegistrationSchema = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string().required(),
});

const candleQuerySchema = yup.object().shape({
    ticker: yup.string().required().length(4).uppercase(),
    query: yup.object().shape({
        to: yup.number().positive().notRequired(),
        from: yup.number().positive().required(),
        granularity: yup.string().matches(granularityRegex).required(),
    }),
});

const orderRequestSchema = yup.object().shape({
    order: yup.object().shape({
        ticker: yup.string().required().length(4).uppercase(),
        type: yup.string().matches(/^(market|limit|stop)$/).required(),
        operation: yup.string().matches(/^(buy|sell)$/),
        units: yup.number().required().min(1),
        stopLoss: yup.number().notRequired(),
        takeProfit: yup.number().notRequired(),
        price: yup.number().when('type', {
            is: (type) => type === OrderType.LIMIT || type === OrderType.STOP,
            then: yup.number().required(),
            otherwise: yup.number().notRequired(),
        }),
        clientExtensions: yup.object().notRequired().shape({
            clientId: yup.string().notRequired(),
            tag: yup.string().notRequired(),
            comment: yup.string().notRequired(),
        }),
    }),
});

const timeAdvanceRequestSchema = yup.object().shape({
    amount: yup.string().required().matches(/^(M1|M5|M15|M30|H1)$/),
});

const currenciesAllowed = /^(btc|bch|dai|eth|ltc|usdc)$/;

const depositRequestSchema = yup.object().shape({
    currency: yup.string().required().matches(currenciesAllowed),
    amount: yup.number().required().positive().integer(),
});

const exchangeBidSchema = yup.object().shape({
    bid: yup.number().positive().integer().required(),
    lots: yup.number().positive().integer().required(),
});

const bidClearSchema = yup.object().shape({
    lots: yup.number().positive().integer().required(),
    currency: yup.string().required().matches(currenciesAllowed),
});

class PersistentEntity {
    constructor(body, collectionName, schema) {
        this.body = body;
        this.collectionName = collectionName;
        this.dbHandler = db.get(collectionName);
        this.schema = schema;
    }

    async validate() {
        await this.schema.validate(this.body);
    }

    async checkForConflicts(keys = {}, name = 'unknown') {
        const alreadyExists = await this.dbHandler.findOne(keys);

        if (alreadyExists) {
            throw new ConflictError(`This ${name} already exists.`);
        }
    }

    async save(data = {}) {
        if (!this.body._id) {
            await this.validate();
            await this.checkForConflicts();

            this.body = await this.dbHandler.insert({
                ...this.body,
                ...data
            });

            return this.body;
        }
    }
}

class User extends PersistentEntity {
    constructor(body) {
        super(body, 'users', yup.object().shape({
            email: yup.string().email().required(),
            password: yup.string().required(),
        }));
    }

    async checkForConflicts() {
        await super.checkForConflicts({ email: this.body.email }, 'user');
    }

    async save() {
        return await super.save({ seed: `userSeed${rootRng()}${rootRng()}`, isAdmin: false, });
    }
}

app.get('/api/v1/trading-game/account', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.TRADING_GAME,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('Account not found');
        }

        res.json({
            account,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/user', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        res.json({
            user,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/registration/user', async (req, res, next) => {
    try {
        console.log(req.body);
        const user = new User(req.body);
        const freshUser = await user.save();

        const newAccount = {
            userId: freshUser._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
            grubersBalance: 0,
            cryptos: {
                btc: 0,
                bch: 0,
                dai: 0,
                eth: 0,
                ltc: 0,
                usdc: 0,
            },
        };

        await db.get('accounts').insert(
            newAccount,
        );
        // await userRegistrationSchema.validate(req.body);

        // const users = db.get('users');

        // const userExists = await users.findOne({ email: req.body.email });

        // if (userExists) {
        //     throw new ConflictError(`This email is already in use.`);
        // }

        // const seed = `userSeed${rootRng()}${rootRng()}`;

        // const account = {
        //     time: 1000 * 3600 * 24 * 365 * 5,
        //     balance: {
        //         xmr: 0,
        //         grb: 10000.00,
        //     },
        //     /**
        //      * List of positions.
        //      * Positions = set of trades made with an instrument.
        //      * Trade = Pair of orders, where the first is a buy order and the second is a sell order.
        //      * Order = Can be a market buy, market sell, limit and stop orders.
        //      */
        //     positions: [],
        //     positionValue: 0.00,
        // };

        // await users.insert({
        //     ...req.body,
        //     seed,
        //     account,
        // });

        res.json({
            success: true
        });
    } catch (error) {
        next(error);
    }
});

class GameFactory {
    constructor() { }

    async fromName(name) {
        const game = await db.get('games').findOne({ name });

        if (!game) {
            return new NotFoundError('Game not found.');
        }

        return game;
    }
}

class Account extends PersistentEntity {
    constructor(body, user) {
        const accountSchema = yup.object().shape({
            userId: yup.string().required(),
            gameId: yup.string().required(),
        });

        super(body, 'accounts', accountSchema);

        this.user = user;
        this.body.userId = user._id;
    }

    async save(data) {
        return await super.save({
            grubersBalance: 100000,
            ...data,
        });
    }
}

class TradingGameAccount extends Account {
    constructor(body, user) {
        super(body, user);
    }

    async save() {
        const game = await new GameFactory().fromName(GameNames.TRADING_GAME);

        this.body.gameId = game._id;

        return await super.save({
            currentTime: 1000 * 3600 * 24 * 365 * 5,
        });
    }
}

app.post('/api/v1/trading-game/accounts', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const accountExists = await db.get('accounts').findOne({
            gameName: GameNames.TRADING_GAME,
            userId: user._id,
        });

        if (accountExists) {
            throw new ConflictError('This user already has a trading game account');
        }

        const account = await db.get('accounts').insert({
            userId: user._id,
            gameName: GameNames.TRADING_GAME,
            currentTime: 1000 * 3600 * 24 * 365 * 5,
            orders: {
                ids: 0,
                entries: [],
            },
            holdings: {},
            grubersBalance: 0,
            advancingTime: false,
        });
        // const tradingGameAccount = new TradingGameAccount(req.body, user);
        // const account = await tradingGameAccount.save();

        res.json({
            success: true,
            account,
        })
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/admin', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        if (!user.isAdmin) {
            throw new NotFoundError('Resource not found!');
        }

        const collections = [
            'users',
            'orders',
            'games',
            'accounts',
            'account',
            'holdings',
            'btc-bids',
            'bch-bids',
            'dai-bids',
            'eth-bids',
            'ltc-bids',
            'usdc-bids',
            'btc-offers',
            'bch-offers',
            'dai-offers',
            'eth-offers',
            'ltc-offers',
            'usdc-offers',
            'btc-blind-swaps',
            'bch-blind-swaps',
            'dai-blind-swaps',
            'eth-blind-swaps',
            'ltc-blind-swaps',
            'usdc-blind-swaps',
        ];

        const codebase = await db.get('codebase').findOne({});

        res.json({
            collections,
            codebase,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/admin', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        if (!user.isAdmin) {
            throw new NotFoundError('Resource not found!');
        }

        const opDescription = req.body;

        const collection = opDescription.collection;
        console.log(opDescription);
        const args = (opDescription.args || [])
            .map((arg) => {
                if (Array.isArray(arg)) {
                    return arg;
                }

                const res = {};

                Object.keys(arg).forEach(key => {
                    if (key.endsWith('Id') || key === '_id') {
                        console.log(key, arg[key]);
                        res[key] = monk.id(arg[key]);
                    } else {
                        res[key] = arg[key];
                    }
                });

                return res;
            });

        console.log(args);

        const result = await db.get(collection)[opDescription.operation](...args);

        res.json({
            result,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/exchange/accounts', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const accountExists = await db.get('accounts').findOne({
            gameName: GameNames.GRUBERS_EXCHANGE,
            userId: user._id,
        });

        if (accountExists) {
            throw new ConflictError('You already have an exchange account.');
        }

        const newAccount = {
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
            grubersBalance: 0,
            cryptos: {
                btc: 0,
                bch: 0,
                dai: 0,
                eth: 0,
                ltc: 0,
                usdc: 0,
            },
        };

        const result = await db.get('accounts').insert(
            newAccount,
        );

        res.json({
            success: true,
            account: result,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/market/bid', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.GRUBERS_EXCHANGE,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('No exchange account was found for this user.');
        }

        const currency = req.params.currency.toLowerCase();
        const bidRequest = {
            ...req.body,
            currency,
        };

        await exchangeBidSchema.validate(bidRequest);

        const price = bidRequest.bid;

        const total = bidRequest.lots * price;

        if (account.cryptos[bidRequest.currency] < total) {
            throw new UnprocessableError('Insufficient funds to clear this transaction.')
        }

        const propertyName = `cryptos.${bidRequest.currency}`;

        const updatedAccount = await db.get('accounts').findOneAndUpdate(
            {
                _id: account._id,
                [propertyName]: account.cryptos[bidRequest.currency],
            },
            { $inc: { [propertyName]: -total } },
        );

        if (!updatedAccount) {
            throw new ConflictError('The account was updated before the transaction could be completed.');
        }

        const bid = {
            bid: bidRequest.bid,
            lots: req.body.lots,
            accountId: account._id,
        };

        const resultBid = await db.get(`${bidRequest.currency}-bids`).insert(bid);

        res.json({
            success: true,
            bid: resultBid,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/market/offer', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.GRUBERS_EXCHANGE,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('No exchange account was found for this user.');
        }

        const currency = req.params.currency.toLowerCase();
        const offerRequest = {
            ...req.body,
            currency,
        };

        await exchangeOfferSchema.validate(offerRequest);

        const total = offerRequest.lots * 1000;

        if (account.grubersBalance < total) {
            throw new UnprocessableError('Insufficient funds to clear this transaction.')
        }

        const updatedAccount = await db.get('accounts').findOneAndUpdate(
            { _id: account._id, grubersBalance: account.grubersBalance },
            { $inc: { grubersBalance: -total } },
        );

        if (!updatedAccount) {
            throw new ConflictError('The account was updated before the transaction could be completed.');
        }

        const offer = {
            offer: req.body.offer,
            lots: req.body.lots,
            accountId: account._id,
        };

        const resultOffer = await db.get(`${currency}-offers`).insert(offer);

        res.json({
            success: true,
            offer: resultOffer,
        });
    } catch (error) {
        next(error);
    }
});

app.put('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/market/bid/:bidId/clear', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.GRUBERS_EXCHANGE,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('No exchange account was found for this user.');
        }

        const currency = req.params.currency.toLowerCase();
        const clearBidRequest = {
            ...req.body,
            currency,
        };
        await bidClearSchema.validate(clearBidRequest);

        const bidId = req.params.bidId;

        const bid = await db.get(`${currency}-bids`).findOne({
            _id: monk.id(bidId),
        });

        if (!bid) {
            throw new NotFoundError('Bid not found');
        }

        const volume = req.body.lots;
        const price = bid.bid;
        const currencyTotal = price * volume;
        const grubersTotal = volume * 1000;

        if (account.grubersBalance < grubersTotal) {
            throw new UnprocessableError('Insufficient funds to clear this transaction.');
        }

        if (bid.lots < volume) {
            throw new UnprocessableError('The bid does not have enough lots.');
        }

        const adjustedAccount = await db.get('accounts').findOneAndUpdate(
            { _id: account._id, grubersBalance: account.grubersBalance },
            { $inc: { grubersBalance: -grubersTotal } }
        );

        if (!adjustedAccount) {
            throw new ConflictError('Account has changed before completion of transaction.');
        }

        const adjustedBid = await db.get(`${currency}-bids`).findOneAndUpdate(
            { _id: bid._id, bid: bid.bid, lots: bid.lots },
            { $inc: { lots: -volume } }
        );

        if (!adjustedBid) {
            await db.get('accounts').findOneAndUpdate(
                { _id: account._id },
                { $inc: { grubersBalance: grubersTotal } }
            );

            throw new ConflictError('Bid has changed before completion of transaction.');
        }

        if (adjustedBid.lots === 0) {
            await db.get(`${currency}-bids`).findOneAndDelete({
                _id: bid._id,
            });
        }

        await db.get('accounts').findOneAndUpdate(
            { _id: bid.accountId },
            { $inc: { grubersBalance: grubersTotal } }
        );

        const propName = `cryptos.${currency}`;

        await db.get('accounts').findOneAndUpdate(
            { _id: account._id },
            { $inc: { [propName]: currencyTotal } }
        );

        const receipt = {
            bid,
            lots: volume,
            price: bid.bid,
            currencyTotal,
            grubersTotal,
            clearedAt: Date.now(),
        };

        res.json({
            success: true,
            receipt,
        });
    } catch (error) {
        next(error);
    }
});

app.put('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/market/offer/:offerId/clear', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.GRUBERS_EXCHANGE,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('No exchange account was found for this user.');
        }

        const currency = req.params.currency.toLowerCase();
        const clearOfferRequest = {
            ...req.body,
            currency,
        };

        await offerClearSchema.validate(clearOfferRequest);

        const offerId = req.params.offerId;

        const offer = await db.get(`${currency}-offers`).findOne({
            _id: monk.id(offerId),
        });

        if (!offer) {
            throw new NotFoundError('Offer not found');
        }

        if (offer.lots < volume) {
            throw new UnprocessableError('The offer does not have enough lots.');
        }

        const volume = req.body.lots;
        const price = offer.ask;
        const currencyTotal = price * volume;
        const grubersTotal = volume * 1000;

        if (account.cryptos[currency] < currencyTotal) {
            throw new UnprocessableError('Insufficient funds to clear this transaction.');
        }

        const propName = `cryptos.${currency}`;

        const adjustedAccount = await db.get('accounts').findOneAndUpdate(
            { _id: account._id, [propName]: account.cryptos[currency] },
            { $inc: { [propName]: -currencyTotal } }
        );

        if (!adjustedAccount) {
            throw new ConflictError('Account has changed before completion of transaction.');
        }

        const adjustedOffer = await db.get(`${currency}-offers`).findOneAndUpdate(
            { _id: offer._id, ask: offer.ask, lots: offer.lots },
            { $inc: { lots: -volume } }
        );

        if (!adjustedOffer) {
            await db.get('accounts').findOneAndUpdate(
                { _id: account._id },
                { $inc: { [propName]: currencyTotal } }
            );

            throw new ConflictError('Offer has changed before completion of transaction.');
        }

        if (adjustedOffer.lots === 0) {
            await db.get(`${currency}-offers`).findOneAndDelete({
                _id: offer._id,
            });
        }

        await db.get('accounts').findOneAndUpdate(
            { _id: offer.accountId },
            { $inc: { [propName]: currencyTotal } }
        );

        await db.get('accounts').findOneAndUpdate(
            { _id: account._id },
            { $inc: { grubersBalance: grubersTotal } }
        );

        const receipt = {
            offer,
            lots: volume,
            price: offer.ask,
            currencyTotal,
            grubersTotal,
            clearedAt: Date.now(),
        };

        res.json({
            success: true,
            receipt,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/market/open-orders', async (req, res, next) => {
    try {
        const currency = req.params.currency.toLowerCase();

        const bids = await db.get(`${currency}-bids`).aggregate(
            { $sort: { bid: -1 } },
            { $project: { _id: 1, bid: 1, lots: 1 } },
        );

        const offers = await db.get(`${currency}-offers`).aggregate(
            { $sort: { ask: 1 } },
            { $project: { _id: 1, ask: 1, lots: 1 } },
        );

        res.json({
            bids,
            offers,
        });
    } catch (error) {
        next(error);
    }
});

const BlindSwapStatus = {
    ACTIVE: 'active',
    CLOSED: 'closed',
    FINISHING: 'finishing',
};

const blindSwapRequestSchema = yup.object().shape({
    grubersAmount: yup.number().integer().min(0).required(),
    bid: yup.number().integer().min(1).required(),
});

app.post('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/blind-swaps', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.GRUBERS_EXCHANGE,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('No exchange account found for this user');
        }

        const currency = req.params.currency;

        const blindSwapRequest = {
            ...req.body,
            currency,
        };

        await blindSwapRequestSchema.validate(blindSwapRequest);

        if (
            (account.grubersBalance < blindSwapRequest.grubersAmount)
            || (account.cryptos[currency] < blindSwapRequest.bid)
        ) {
            throw new UnprocessableError('Not enough funds to complete this transaction');
        }

        const propName = `cryptos.${currency}`;

        const adjustedAccount = await db.get('accounts').findOneAndUpdate(
            { _id: account._id, [propName]: account.cryptos[currency], grubersBalance: account.grubersBalance },
            { $inc: { [propName]: -blindSwapRequest.bid, grubersBalance: -blindSwapRequest.grubersAmount } }
        );

        if (!adjustedAccount) {
            throw new ConflictError('Account has changed before completion of transaction');
        }

        const currentSwap = await db.get(`${currency}-blind-swaps`).findOneAndUpdate({
            status: BlindSwapStatus.ACTIVE,
            'firstBidder.bid': blindSwapRequest.bid,
        }, {
            $set: {
                'secondBidder.bid': blindSwapRequest.bid,
                'secondBidder.grubersAmount': blindSwapRequest.grubersAmount,
                'secondBidder.accountId': account._id,
                status: BlindSwapStatus.FINISHING,
            }
        });

        if (currentSwap) {
            let buyer = null;
            let seller = null;
            let tie = false;
            let adjustedBuyer;
            let adjustedSeller;
            let adjustedSwap;

            if (currentSwap.firstBidder.grubersAmount > currentSwap.secondBidder.grubersAmount) {
                buyer = currentSwap.secondBidder;
                seller = currentSwap.firstBidder;
            } else if (currentSwap.firstBidder.grubersAmount < currentSwap.secondBidder.grubersAmount) {
                buyer = currentSwap.firstBidder;
                seller = currentSwap.secondBidder;
            } else {
                buyer = currentSwap.firstBidder;
                seller = currentSwap.secondBidder;
                tie = true;
            }

            if (!tie) {
                adjustedBuyer = await db.get('accounts').findOneAndUpdate(
                    {
                        _id: buyer.accountId,
                    },
                    {
                        $inc: { grubersBalance: buyer.grubersAmount + seller.grubersAmount }
                    }
                );

                adjustedSeller = await db.get('accounts').findOneAndUpdate(
                    {
                        _id: seller.accountId,
                    },
                    {
                        $inc: { [propName]: buyer.bid + seller.bid }
                    }
                );

                adjustedSwap = await db.get(`${currency}-blind-swaps`).findOneAndUpdate(
                    {
                        _id: currentSwap._id,
                    },
                    {
                        $set: {
                            status: BlindSwapStatus.CLOSED,
                            buyer,
                            seller,
                            updatedOn: Date.now(),
                        },
                    }
                );
            } else {
                adjustedBuyer = await db.get('accounts').findOneAndUpdate(
                    {
                        _id: buyer.accountId,
                    },
                    {
                        $inc: { grubersBalance: buyer.grubersAmount, [propname]: buyer.bid }
                    }
                );

                adjustedSeller = await db.get('accounts').findOneAndUpdate(
                    {
                        _id: seller.accountId,
                    },
                    {
                        $inc: { grubersBalance: seller.grubersAmount, [propName]: seller.bid }
                    }
                );

                adjustedSwap = await db.get(`${currency}-blind-swaps`).findOneAndUpdate(
                    {
                        _id: currentSwap._id,
                    },
                    {
                        $set: {
                            status: BlindSwapStatus.CLOSED,
                            buyer: null,
                            seller: null,
                            updatedOn: Date.now(),
                        },
                    }
                );
            }

            res.json({
                success: true,
                blindSwap: adjustedSwap,
            });
        } else {
            const newSwap = await db.get(`${currency}-blind-swaps`).insert({
                status: BlindSwapStatus.ACTIVE,
                updatedOn: Date.now(),
                firstBidder: {
                    accountId: account._id,
                    grubersAmount: blindSwapRequest.grubersAmount,
                    bid: blindSwapRequest.bid,
                }
            });

            res.json({
                success: true,
                blindSwap: newSwap,
            });
        }
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/exchange/:currency(btc|bch|dai|eth|ltc|usdc)/blind-swaps', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        });

        if (!account) {
            throw new NotFoundError('No exchange account was found for this user');
        }

        const currency = req.params.currency;

        const swaps = await db.get(`${currency}-blind-swaps`).aggregate(
            { $match: { status: BlindSwapStatus.CLOSED } },
            { $sort: { updatedOn: -1 } },
            { $limit: 100 },
            {
                $project: {
                    'firstBidder.accountId': -1,
                    'secondBidder.accountId': -1,
                    'buyer.accountId': -1,
                    'seller.accountId': -1,
                }
            },
        );

        res.json({
            swaps,
        });
    } catch (error) {
        next(error);
    }
});

const transferGrubersSchema = yup.object().shape({
    sourceAccount: yup.string().required(),
    destinationAccount: yup.string().required(),
    amount: yup.number().integer().positive().required(),
});

app.post('/api/v1/accounts/transfer-grubers', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        await transferGrubersSchema.validate(req.body);

        const sourceAccount = await db.get('accounts').findOne({
            userId: user._id,
            gameName: req.body.sourceAccount,
        });

        if (!sourceAccount) {
            throw new NotFoundError('Source account not found');
        }

        const destinationAccount = await db.get('accounts').findOne({
            userId: user._id,
            gameName: req.body.destinationAccount,
        });

        if (!destinationAccount) {
            throw new NotFoundError('Destination account not found');
        }

        const amount = req.body.amount;

        if (sourceAccount.grubersAmount < amount) {
            throw new UnprocessableError('Not enough grubers!');
        }

        const result = await db.get('accounts').findOneAndUpdate(
            { _id: sourceAccount._id, grubersBalance: sourceAccount.grubersBalance },
            { $inc: { grubersBalance: -amount } }
        );

        if (!result) {
            throw new ConflictError('Account has changed before transaction could be completed');
        }

        await db.get('accounts').findOneAndUpdate(
            { _id: destinationAccount._id },
            { $inc: { grubersBalance: amount } }
        );

        res.json({
            success: true,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/trading-game/products/:ticker/candles', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.TRADING_GAME,
            userId: user._id,
        });

        const ticker = req.params.ticker;
        const query = req.query;

        query.to = parseInt(query.to || account.currentTime, 10);
        query.from = parseInt(query.from, 10);

        const params = { ticker, query };

        await candleQuerySchema.validate(params);

        if (query.from > account.currentTime || query.to > account.currentTime) {
            throw new BadRequestError('Time range in the future');
        }

        const timeStamps = roundedTimeStamps(query);
        const blocks = await timeBlocks(timeStamps, query.granularity);
        const candles = await createCandles(candle(user.seed, ticker), blocks);

        res.json({
            ticker,
            timeStamps,
            candles,
        });
    } catch (error) {
        next(error);
    }
});

async function createCandles(candlef, blocks) {
    return new Promise((resolve) => {
        const length = blocks.length;
        const candles = [];
        for (let i = 0; i < length; i++) {
            candles.push(candlef(blocks[i]));
        }

        // if (candles.length >= 2) {
        //     const last = candles.pop();
        //     const secondLast = candles.pop();

        //     if (last.closeTimeStamp === secondLast.closeTimeStamp) {
        //         candles.push(mergeCandles(last, secondLast));
        //     } else {
        //         candles.push(secondLast);
        //         candles.push(last);
        //     }
        // }
        resolve(candles);
    });
}

app.post('/api/v1/trading-game/account/orders', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            gameName: GameNames.TRADING_GAME,
            userId: user._id,
        });

        if (!account) {
            throw new NotFoundError('Account not found.');
        }

        const orderRequest = req.body;

        await orderRequestSchema.validate(orderRequest);

        const order = {
            ...orderRequest.order,
            status: OrderStatus.PENDING,
            createdAt: account.currentTime,
        };

        if (order.type === OrderType.LIMIT || order.type === OrderType.STOP) {
            if (order.stopLoss && (order.stopLoss >= order.price)) {
                throw new BadRequestError('The stop target must be lower than the price.');
            }

            if (order.takeProfit && (order.takeProfit <= order.price)) {
                throw new BadRequestError('The take profit target must be higher than than the price.');
            }

            if (order.operation === OperationType.SELL) {
                if (order.stopLoss || order.takeProfit) {
                    throw new BadRequestError('Sell orders must not have take-profit or stop-loss targets.');
                }
            }
        }

        order.id = account.orders.ids;

        const result = await db.get('accounts').update(
            { _id: account._id },
            { $push: { "orders.entries": order }, $inc: { "orders.ids": 1 } },
        );

        res.json({
            success: true,
            order,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/trading-game/account/orders', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne(
            { userId: user._id, gameName: GameNames.TRADING_GAME },
            { orders: 1 },
        );

        if (!account) {
            throw new NotFoundError('Account not found.');
        }

        res.json({
            orders: account.orders,
        });
    } catch (error) {
        next(error);
    }
});

app.put('/api/v1/trading-game/account/orders/:orderId/cancel', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const orderId = req.params.orderId;

        const result = await db.get('accounts').findOneAndUpdate(
            { userId: user._id, gameName: GameNames.TRADING_GAME },
            { $set: { 'orders.entries.$[elem].status': OrderStatus.CANCELLED } },
            {
                arrayFilters: [
                    {
                        'elem.id': orderId,
                        'elem.status': OrderStatus.PENDING,
                    }
                ]
            }
        );

        if (!result) {
            throw new NotFoundError('The order was not found. It either does not belong to this account or it was not pending.');
        }

        res.json({
            success: true,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/trading-game/account/time-advances', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOneAndUpdate(
            { userId: user._id, gameName: GameNames.TRADING_GAME, advancingTime: false },
            { $set: { advancingTime: true } },
        );

        if (!account) {
            throw new NotFoundError('The account was not found, or a time advancement is already in progress.');
        }

        const timeAdvanceRequest = req.body;

        await timeAdvanceRequestSchema.validate(timeAdvanceRequest);

        await generateTimeSteps({
            seed: user.seed,
            account,
            amount: timeAdvanceRequest.amount,
        });

        account.advancingTime = false;

        await db.get('accounts').update(
            { _id: account._id, },
            account,
            { replaceOne: true }
        );

        const resultAccount = await db.get('accounts')
            .findOne({ _id: account._id }, {
                projection: {
                    grubersBalance: 1,
                    currentTime: 1,
                    orders: 1,
                    holdings: 1,
                },
            });

        res.json({
            success: true,
            account: resultAccount,
        });
    } catch (error) {
        next(error);
    }
});

async function generateTimeSteps({
    seed,
    account,
    amount,
}) {
    const tickers = account.orders.entries.map((order) => order.ticker);

    const priceFuncs = {};

    tickers.forEach((ticker) => {
        const lakeSeed = `${seed}${ticker}42`;
        const rnd = seedrandom(lakeSeed + '0');
        const initialPrice = rnd() * 400;
        const { waves, weights } = waveLake(lakeSeed, 24, 100000);
        const drift = driftFunc(0.02);
        const hardLimit = 4;

        priceFuncs[ticker] = (time) => formula(initialPrice, hardLimit, weights, waves, drift, time);
    });

    const start = account.currentTime + 1000;
    const end = start + grainMs[amount];

    for (let time = start; time <= end; time += 1000) {
        account.currentTime = time;

        updateOrders({
            account,
            priceFuncs,
            time,
        });
    }

    return {
        account,
    };
}

/**
 * All orders are assumed to be pending.
 */
function updateOrders({
    account,
    priceFuncs,
    time,
}) {
    const orders = account.orders.entries.filter(order => order.status === OrderStatus.PENDING);
    const ordersCount = orders.length;

    for (let w = 0; w < ordersCount; w++) {
        const order = orders[w];

        if (order.status === OrderStatus.PENDING) {
            const price = priceFuncs[order.ticker](time);
            const params = {
                order,
                account,
                price,
                time,
            };

            switch (order.type) {
                case OrderType.MARKET:
                    handleMarketOrder(params);
                    break;
                case OrderType.LIMIT:
                    handleLimitOrder(params);
                    break;
                case OrderType.STOP:
                    handleStopOrder(params);
                    break;
            }
        }
    }
}

function handleStopOrder({
    order,
    account,
    price,
    time,
}) {
    if (order.operation === OperationType.BUY) {
        if (price >= order.price) {
            handleMarketOrder({
                order,
                account,
                price,
                time,
            });
        }
    } else if (order.operation === OperationType.SELL) {
        if (price <= order.price) {
            handleMarketOrder({
                order,
                account,
                price,
                time,
            });
        }
    }
}

function handleLimitOrder({
    order,
    account,
    price,
    time,
}) {
    if (order.operation === OperationType.BUY) {
        if (price <= order.price) {
            handleMarketOrder({
                order,
                account,
                price,
                time,
            });
        }
    } else if (order.operation === OperationType.SELL) {
        if (price >= order.price) {
            handleMarketOrder({
                order,
                account,
                price,
                time,
            });
        }
    }
}

function handleMarketOrder({
    order,
    account,
    price,
    time,
}) {
    if (order.operation === OperationType.BUY) {
        const value = order.units * price;
        const commission = 0.01 * value;
        const total = value + commission;

        if (account.grubersBalance < total) {
            order.status = OrderStatus.ERROR;
            order.error = OrderError.INSUFFICIENT_FUNDS;
            return;
        }

        order.status = OrderStatus.FILLED;
        order.filledAt = time;
        order.fillPrice = price;

        order.receipt = {
            price,
            units: order.units,
            grossAmount: value,
            commissionRate: 0.01,
            commission,
            netAmmount: total,
        };

        account.grubersBalance -= total;

        const position = account.holdings[order.ticker];

        if (position) {
            position.units += order.units;
        } else {
            account.holdings[order.ticker] = {
                ticker: order.ticker,
                units: order.units,
                accountId: account._id,
            };
        }

        if (order.stopLoss) {
            const stopOrder = {
                ...order,
            };

            delete stopOrder.id;
            delete stopOrder.stopLoss;
            delete stopOrder.takeProfit;
            delete stopOrder.filledAt;
            delete stopOrder.fillPrice;
            delete stopOrder.receipt;

            stopOrder.operation = OperationType.SELL;
            stopOrder.type = OrderType.STOP;
            stopOrder.price = order.stopLoss;
            stopOrder.createdAt = time;
            stopOrder.status = OrderStatus.PENDING;

            stopOrder.orderId = order.id;

            stopOrder.id = account.orders.ids;
            account.orders.ids += 1;

            account.orders.entries.push(stopOrder);
        }

        if (order.takeProfit) {
            const limitOrder = {
                ...order,
            };

            delete limitOrder.id;
            delete limitOrder.stopLoss;
            delete limitOrder.takeProfit;
            delete limitOrder.filledAt;
            delete limitOrder.fillPrice;
            delete limitOrder.receipt;

            limitOrder.operation = OperationType.SELL;
            limitOrder.type = OrderType.LIMIT;
            limitOrder.price = order.takeProfit;
            limitOrder.createdAt = time;
            limitOrder.status = OrderStatus.PENDING;

            limitOrder.orderId = order.id;

            limitOrder.id = account.orders.ids;
            account.orders.ids += 1;

            account.orders.entries.push(limitOrder);
        }

        if (order.orderId && order.status === OrderStatus.FILLED) {
            account.orders.entries.forEach((candidate) => {
                if (
                    candidate.orderId === order.orderId
                    && candidate.status !== OrderStatus.FILLED
                ) {
                    candidate.status = OrderStatus.CANCELLED;
                }
            });
        }
    } else if (order.operation === OperationType.SELL) {
        const position = account.holdings[order.ticker];

        if (!position || position.units < order.units) {
            order.status = OrderStatus.ERROR;
            order.error = OrderError.INSUFFICIENT_HOLDINGS;
            return;
        }

        const total = order.units * price;

        order.status = OrderStatus.FILLED;
        order.filledAt = time;
        order.fillPrice = price;

        order.receipt = {
            price,
            units: order.units,
            grossAmount: total,
            commissionRate: 0,
            commission: 0,
            netAmmount: total,
        };

        position.units -= order.units;

        account.grubersBalance += total;

        if (order.orderId && order.status === OrderStatus.FILLED) {
            account.orders.entries.forEach((candidate) => {
                if (
                    candidate.orderId === order.orderId
                    && candidate.status !== OrderStatus.FILLED
                ) {
                    candidate.status = OrderStatus.CANCELLED;
                }
            });
        }
    }
}

async function getAccount(req) {
    const user = await requestingUser(req);

    const game = await db.get('games').findOne({
        name: GameNames.TRADING_GAME,
    });

    const account = await db.get('accounts').findOne({
        gameId: game._id,
        userId: user._id,
    });

    if (!account) {
        throw new NotFoundError('Account not found.');
    }

    return {
        user,
        account,
    };
}

async function getMoneroAccount(req) {
    const user = await requestingUser(req);

    const game = await db.get('games').findOne({
        name: GameNames.GRUBERS_EXCHANGE,
    });

    const account = await db.get('accounts').findOne({
        gameId: game._id,
        userId: user._id,
    });

    if (!account) {
        throw new NotFoundError('Account not found.');
    }

    return {
        user,
        account,
    };
}


/**
 * We need to move forward in time.
 * Mas allowed will be 1 hour, or 3600 seconds.
 * we need to get the pending orders, and check them
 * second by second.
 * We need to think about the take-profit and stop orders,
 * When do they get cancelled?
 * We might need to have trades, after all.
 * When you enter and order and it gets filled,
 * a new trade is created, with the corresponding stop.
 * You can then close it partially, or modify the stop
 * and take-profit orders.
 * So for every second we check both the pending orders and
 * the ongoing trades.
 */

async function requestingUser(req) {
    const email = req.user.sub;

    const user = await db.get('users').findOne({ email }, { projection: { password: false, seed: false, } });

    if (!user) {
        throw new UnauthorizedError('User not found.');
    }

    return user;
}

function candle(seed, ticker) {
    const lakeSeed = `${seed}${ticker}42`;
    const rnd = seedrandom(lakeSeed + '0');
    const initialPrice = rnd() * 400;
    const { waves, weights } = waveLake(lakeSeed, 24, 100000);
    const drift = driftFunc(0.02);
    const hardLimit = 4;

    let isoFormat = false;

    return function (block) {
        const range = block.closeTimeStamp - block.openTimeStamp;
        let divisor = 100;

        if (range >= 86400000) {
            divisor = 24;
        } else if (range >= 3600000) {
            divisor = 12;
        } else if (range > 60000) {
            divisor = range / 60000;
        } else {
            divisor = 5;
        }

        const subBlockSize = Math.floor(range / divisor);
        const start = block.openTimeStamp;
        const end = block.closeTimeStamp;
        let counter = start;
        const values = [];

        while (counter <= end) {
            const value = formula(initialPrice, hardLimit, weights, waves, drift, counter);
            values.push(value);
            counter += subBlockSize;
        }

        const open = values[0];
        const close = values[values.length - 1];
        const high = Math.max(...values);
        const low = Math.min(...values);

        block.openTimeStamp = block.openTimeStamp / 1000;
        block.closeTimeStamp = block.closeTimeStamp / 1000;

        return {
            ...block,
            open,
            close,
            high,
            low,
        };
    };
}

async function timeBlocks({ timeStampFrom, timeStampTo }, granularity) {
    return new Promise((resolve) => {
        const blockSize = grainMs[granularity];
        const roundedFrom = Math.floor(timeStampFrom / blockSize) * blockSize;
        const range = (timeStampTo - roundedFrom);
        const count = Math.floor(range / blockSize);
        const remainder = range % blockSize;

        let main = [];

        for (let j = 0; j < count; j++) {
            const openTimeStamp = roundedFrom + blockSize * j;
            main.push({
                openTimeStamp,
                closeTimeStamp: openTimeStamp + blockSize - 1,
            });
        }

        if (remainder) {
            main = main.concat([{
                openTimeStamp: roundedFrom + blockSize * count,
                closeTimeStamp: (roundedFrom + blockSize * count) + remainder,
            }]);
        }

        resolve(main);
    });
}

function roundedTimeStamps({ to, from, granularity }) {
    const result = {
        timeStampFrom: Math.floor(from / grainMs[granularity]) * grainMs[granularity],
        timeStampTo: to,
    };

    return result;
}

app.post('/api/v1/exchange/accounts/:accountId/deposits', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        if (!user.isAdmin) {
            throw new UnauthorizedError('Your user account does not have authorization to perform this action!');
        }

        const accountId = monk.id(req.params.accountId);

        const account = await db.get('accounts').findOne({
            _id: accountId,
            gameName: GameNames.GRUBERS_EXCHANGE,
        });

        if (!account) {
            throw new NotFoundError('This exchange account was not found!');
        }

        const depositRequest = req.body;
        await depositRequestSchema.validate(depositRequest);

        const propName = `cryptos.${depositRequest.currency}`;

        const result = await db.get('accounts').findOneAndUpdate(
            {
                _id: accountId,
            },
            {
                $inc: { [propName]: depositRequest.amount }
            }
        );

        res.json({
            success: true,
            result,
        });
    } catch (error) {
        next(error);
    }
});

const withDrawalRequestSchema = yup.object().shape({
    currency: yup.string().required().matches(/^(btc|ltc|bch|eth|dai|usdc)$/),
    amount: yup.number().required().positive().min(0),
    address: yup.string().required(),
});

app.post('/api/v1/exchange/withdrawals', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        });

        if (!account) {
            throw new NotFoundError('Account not found');
        }

        await withDrawalRequestSchema.validate(req.body);

        const currency = req.body.currency;
        const propName = `cryptos.${currency}`;

        if (account.cryptos[currency] < req.body.amount) {
            throw new UnprocessableError('This account does not have the requested amount');
        }

        const adjustedAccount = await db.get('accounts')
            .findOneAndUpdate(
                { _id: account._id, [propName]: account.cryptos[currency] },
                { $inc: { [propName]: -req.body.amount } },
            );

        if (!adjustedAccount) {
            throw new ConflictError(`The account has changed before the transaction could be completed!`);
        }

        const withdrawal = await db.get('withdrawals').insert({
            accountId: account._id,
            currency,
            amount: req.body.amount,
            address: req.body.address,
            status: 'open',
            createdAt: Date.now(),
        });

        res.json({
            withdrawal,
            account: adjustedAccount,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/exchange/withdrawal/:withdrawalId/cancel', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        });

        if (!account) {
            throw new NotFoundError('Account not found');
        }

        const withdrawal = await db.get('withdrawals').findOneAndUpdate(
            {
                _id: monk.id(req.params.withdrawalId),
                accountId: account._id,
                status: 'open',
            },
            { $set: { status: 'cancelled' }, },
        );

        if (!withdrawal) {
            throw new NotFoundError('Withdrawal not found');
        }

        const propName = `cryptos.${withdrawal.currency}`;

        const adjustedAccount = await db.get('accounts').findOneAndUpdate(
            { _id: account._id },
            { $inc: { [propName]: withdrawal.amount } },
        );

        res.json({
            withdrawal,
            account: adjustedAccount,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/exchange/withdrawals', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        let query = {};

        if (user.isAdmin) {
            query.status = 'open';
        } else {
            const account = await db.get('accounts').findOne({ userId: user._id });

            query.accountId = account._id;
        }

        const withdrawals = await db.get('withdrawals').find(query);

        res.json({
            withdrawals,
        })
    } catch (error) {
        next(error);
    }
});

const clearWithdrawalSchema = yup.object().shape({
    transactionData: yup.object().required(),
    fee: yup.number().integer().min(0).required(),
})

app.post('/api/v1/exchange/withdrawal/:withdrawalId/clear', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        if (!user.isAdmin) {
            throw new NotFoundError('Resource not found!');
        }

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        });

        if (!account) {
            throw new NotFoundError('Account not found!');
        }

        await clearWithdrawalSchema.validate(req.body);

        const amountTransfered = req.body.amountTransfered;

        const withdrawal = await db.get('withdrawals')
            .findOneAndUpdate(
                { _id: monk.id(req.params.withdrawalId), status: 'open' },
                {
                    $set: {
                        status: 'closed',
                        receipt: {
                            clearedAt: Date.now(),
                            fee: req.body.fee,
                            amountTransfered
                        },
                    },
                },
            );

        if (!withdrawal) {
            throw new NotFoundError('Withdrawal not found');
        }

        res.json({
            withdrawal,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/games', async (req, res, next) => {
    try {
        await requestingUser(req);

        const games = await db.get('games').find({});

        res.json({
            games,
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/accounts', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const accounts = await db.get('accounts').find({
            userId: user._id,
        });

        res.json({
            accounts,
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/v1/exchange/account/deposits', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        })

        if (!account) {
            throw new NotFoundError('Account not found!');
        }

        const chargeData = {
            name: 'Grubers Exchange Deposit',
            description: `User: ${user.email} Account: ${account._id}.`,
            pricing_type: 'no_price',
            metadata: {
                customer_id: user._id,
                customer_email: user.email,
                customer_account: account._id,
            },
        };

        const response = await createChargePromise(chargeData);

        if (response && response.id) {
            const retrievedCharge = await retrieveChargePromise(response.id);

            const savedCharge = await db.get('charges').insert({
                charge: retrievedCharge,
                accountId: account._id,
                status: 'NEW',
            });

            res.json({
                charge: retrievedCharge,
            });
        } else {
            throw new CustomError(500, 'Coinbase API problem');
        }
    } catch (error) {
        next(error);
    }
});

app.get('/api/v1/exchange/account/deposits', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        })

        if (!account) {
            throw new NotFoundError('Account not found!');
        }

        const deposits = await db.get('charges').find({
            accountId: account._id,
        });

        res.json({
            deposits,
        });
    } catch (error) {
        next(error);
    }
});

app.put('/api/v1/exchange/account/deposits/:depositId/check', async (req, res, next) => {
    try {
        const user = await requestingUser(req);

        const account = await db.get('accounts').findOne({
            userId: user._id,
            gameName: GameNames.GRUBERS_EXCHANGE,
        });

        if (!account) {
            throw new NotFoundError('Account not found!');
        }

        let deposit = await db.get('charges').findOne({
            _id: monk.id(req.params.depositId),
        });

        if (!deposit) {
            throw new NotFoundError('Deposit not found!');
        }

        if (deposit.status !== 'COMPLETED' || deposit.status !== 'RESOLVED') {
            const charge = deposit.charge;

            const retrievedCharge = await retrieveChargePromise(charge.id);

            if (!retrievedCharge) {
                throw new NotFoundError('Coinbase charge not found!');
            }

            const newStatus = retrievedCharge.timeline[retrievedCharge.timeline.length - 1].status;

            deposit = await findOneAndUpdate(
                { _id: deposit._id },
                { $set: { charge: retrievedCharge, status: newStatus } }
            );

            if (newStatus === 'COMPLETED') {
                const payment = retrievedCharge.payments[0].value.crypto;

                const updatedAccount = await db.get('accounts').findOneAndUpdate(
                    { _id: account._id },
                    { $inc: { [`cryptos.${payment.currency}`]: payment.amount } },
                );
            }
        }

        res.json({ deposit });
    } catch (error) {
        next(error);
    }
});

async function listChargesPromise(untilId) {
    const Charge = coinbase.resources.Charge;
    return new Promise((resolve, reject) => {
        const results = [];
        let foundIt = false;
        let starting_after;

        const goOn = () => {
            Charge.list({ starting_after }, (error, list, pagination) => {
                if (error) {
                    reject(error);
                } else {
                    list.forEach(charge => {
                        if (charge.id !== untilId) {
                            results.push(charge);
                        } else {
                            foundIt = true;
                        }
                    });

                    if (foundIt || !list.length) {
                        resolve(results.reverse());
                    } else {
                        starting_after = pagination.cursor_range[1];
                        goOn();
                    }
                }
            });
        };

        goOn();
    });
}

async function retrieveChargePromise(id) {
    return new Promise((resolve, reject) => {
        const Charge = coinbase.resources.Charge;

        Charge.retrieve(id, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        })
    })
}

async function createChargePromise(data) {
    return new Promise((resolve, reject) => {
        const Charge = coinbase.resources.Charge;

        Charge.create(data, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

app.post('/api/v1/login', async (req, res, next) => {
    try {
        await loginSchema.validate(req.body);

        const users = db.get('users');

        const user = await users.findOne({
            email: req.body.email,
            password: req.body.password
        }, {
            projection: {
                _id: 1,
                email: 1,
                isAdmin: 1,
            },
        });

        if (!user) {
            throw new UnauthorizedError(`Wrong email or password`);
        }

        const token = jwt.sign(
            {
                iat: new Date().getTime(),
                userType: user.isAdmin ? 'admin' : 'regular',
            },
            new Buffer(process.env.EVA_JWT_SECRET || 'eva-dev', 'base64'),
            {
                expiresIn: '2 Days',
                subject: user.email,
            });

        if (!user.isAdmin) {
            delete user.isAdmin;
        }

        res.json({
            success: true,
            data: {
                token,
                user
            }
        });
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.log(error);
    if (error.status) {
        res.status(error.status);
    } else if (error.name === 'UnauthorizedError') {
        res.status(401);
    } else if (error.name === 'ValidationError') {
        res.status(400);
    } else {
        res.status(500);
    }

    res.json({
        success: false,
        error: {
            message: error.message,
            stack: process.env.NODE_ENV === 'production' ? '' : error.stack,
        },
    });
})

// app.get('/', (req, res) => {
//     res.json({
//         message: 'Working'
//     });
// });

const port = process.env.PORT || 8080;

// /** BEGINNING OF FORBIDDEN SECTION **/
dropDatabase()
//     /** END OF FORBIDDEN SECTION **/
//     .then(() => setupDatabase())
//     .catch(err => console.error(err));

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});

function setupDatabase() {
    return db.get('venueOwners')
        .createIndex({ email: 1 });
}


function dropDatabase() {
    console.log('Dropping the base');

    const collections = [
        'users',
        'orders',
        'games',
        'accounts',
        'account',
        'holdings',
        'btc-bids',
        'bch-bids',
        'dai-bids',
        'eth-bids',
        'ltc-bids',
        'usdc-bids',
        'btc-offers',
        'bch-offers',
        'dai-offers',
        'eth-offers',
        'ltc-offers',
        'usdc-offers',
        'btc-blind-swaps',
        'bch-blind-swaps',
        'dai-blind-swaps',
        'eth-blind-swaps',
        'ltc-blind-swaps',
        'usdc-blind-swaps',
        'codebase',
        'charges',
    ];

    const promises = collections.map((collection) => db.get(collection).drop());

    const chores = [
        async () => {
            return await db.get('users').createIndex({ email: 'text' });
        },
        async () => {
            return await db.get('codebase').insert({
                code: `
                ctx.toCol = (collection, operation, args) => ({
                    collection,
                    operation,
                    args,
                });
        
                const { toCol } = ctx;
        
                ctx.findUser = (txt) => toCol('users', 'find', [{
                    $text: { $search: txt }
                }]);
        
                ctx.findAccount = (userId) => toCol('accounts', 'find', [{
                    userId,
                }]);
        
                ctx.findAll = collection => toCol(collection, 'find', [{}]);
        
                ctx.findOneAndUpdate = (collection, args) => toCol(collection, 'findOneAndUpdate', args);
        
                ctx.giveGrubers = (accountId, amount) => ctx.findOneAndUpdate('accounts', [
                    { _id: accountId },
                    { $inc: { grubersBalance: amount } }
                ]);
        
                ctx.send = async (payload) => {
                    const response = await apiPost('/api/v1/admin', payload, next);
        
                    const result = response.data.result;
        
                    subTitle('Result:')
                    preCode(JSON.stringify(result, null, 4));
                };
                `,
            });
        },
    ];

    return Promise.all(promises)
        .then(() => console.log('Base dropped.'))
        .then(() => {
            return db.get('accounts').createIndex({ gameName: 1, userId: 1 }, { unique: true });
        })
        .then(() => {
            return db.get('games').createIndex({ name: 1 }, { unique: true });
        })
        .then(() => {
            const bids = [
                'btc-bids',
                'bch-bids',
                'dai-bids',
                'eth-bids',
                'ltc-bids',
                'usdc-bids',
            ];

            return Promise.all(bids.map(col => db.get(col).createIndex({ bid: -1 })));
        })
        .then(() => {
            const offers = [
                'btc-offers',
                'bch-offers',
                'dai-offers',
                'eth-offers',
                'ltc-offers',
                'usdc-offers',
            ];

            return Promise.all(offers.map(col => db.get(col).createIndex({ ask: 1 })));
        })
        .then(() => {
            const swaps = [
                'btc-blind-swaps',
                'bch-blind-swaps',
                'dai-blind-swaps',
                'eth-blind-swaps',
                'ltc-blind-swaps',
                'usdc-blind-swaps',
            ];

            return Promise.all(swaps.map(col => db.get(col).createIndex({ updatedOn: -1 })));
        })
        .then(() => {
            const chorePromises = chores.map(async (chore) => await chore());

            return Promise.all(chorePromises);
        })
        .then(() => {
            return db.get('games').bulkWrite([
                { insertOne: { document: { name: GameNames.TRADING_GAME } } },
                { insertOne: { document: { name: GameNames.GRUBERS_EXCHANGE } } },
            ]);
        })
        .then(() => {
            return db.get('users').bulkWrite([
                {
                    insertOne: {
                        document: {
                            email: 'wolmir.nemitz@gmail.com',
                            password: 'Te amo Bruxinha!',
                            seed: 'Cristina',
                            isAdmin: true,
                        }
                    }
                }
            ]);
        })
        .then(results => {
            const userId = results.insertedIds[0];

            const account = {
                userId,
                gameName: GameNames.GRUBERS_EXCHANGE,
                grubersBalance: 10 ** 9,
                cryptos: {
                    btc: 0,
                    bch: 0,
                    dai: 0,
                    eth: 0,
                    ltc: 0,
                    usdc: 0,
                },
            };

            return db.get('accounts').insert(account);
        })
        .then(() => {
            console.log('Base populated');
        })
        .catch(error => {
            console.log(error);
        })
}