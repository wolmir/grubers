/**
 * Grubers
 *
 * 1. Second -> 1000
2. Minute -> 60000
3. Hour -> 3600000
4. Day -> 86400000
5. 30 Days -> 2592000000
6. 6 months -> 15552000000
7. 1 year -> 31536000000
8. 10 years -> 315360000000
9. 50 years -> 157680000000
 */
// Create Redux store
const createStore = window.Redux.createStore;
const applyMiddleware = window.Redux.applyMiddleware;
const ReduxThunk = window.ReduxThunk.default;

// Seed for the deterministic generator.
const RSEED = 'hello';
// Redux action names
const TIME_STEP = 'TIME_STEP';
const PAUSE = 'PAUSE';
const STEP_SIZE = 60000;

const ONE_YEAR = 31536000000;
const TWO_PI = 6.28;

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

const waveLake = (lakeSeed, numberOfWaves, maxPeriod, rouletteSize, roughness) => {
    const trnd = new Math.seedrandom(lakeSeed);
    const waves = new Array(numberOfWaves).fill(0);
    const weights = new Array(numberOfWaves).fill(0);
    const tsum = Math.floor((numberOfWaves * (numberOfWaves + 1)) / 2);

    for (let i = 0; i < numberOfWaves; i++) {
        const stretch = 1 + ((4 - (trnd() * 8)) / 10);

        waves[i] = {
            period: (100 * (3 ** i)) * stretch,
            phase: trnd(),
        };
        // weights[i] = 1 / numberOfWaves;

        // waves[i] = Math.floor(maxPeriod / (numberOfWaves * 1.0));
        // waves[i] = (Math.ceil(trnd() * maxPeriod));
    }

    let weightPool = rouletteSize;

    while (weightPool > 0) {
        const player = Math.floor(trnd() * waves.length);
        const points = 1.3 ** player;

        weights[player] += points;

        weightPool -= points;
    }

    // weightPool = Math.floor(roughness * rouletteSize);

    // while (weightPool > 0) {
    //     const player1 = Math.floor(trnd() * waves.length);
    //     const player2 = Math.floor(trnd() * waves.length);
    //     const d1 = Math.ceil(trnd() * 1);
    //     const d2 = Math.ceil(trnd() * 1);

    //     let winner;
    //     let loser;

    //     if ((player1 + d1) >= (player2 + d2)) {
    //         winner = player1;
    //         loser = player2;
    //     } else {
    //         winner = player2;
    //         loser = player1;
    //     }

    //     if (weights[loser] > 1) {
    //         weights[winner] += 1;
    //         weights[loser] -= 1;
    //     } else if (weights[winner] > 1) {
    //         weights[winner] -= 1;
    //         weights[loser] += 1;
    //     }

    //     weightPool -= 1;
    // }

    console.log(waves.map(({period}) => toTimeLabel(period)), weights);

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

const intRand = prng => () => Math.floor(prng() * 1000);

const rootReducer = (state, action) => {
    let rnd;

    if (!state) {
        rnd = new Math.seedrandom(`${RSEED}0`);
        let initialPrice = Math.ceil(rnd() * 400);

        const setXyz = waveLake(42, 24, 1576800000000, 10**5, 0);
        const setAbc = waveLake(43, 24, 1576800000000, 10**5, 0);

        return {
            time: 0,
            paused: true,
            products: [
                {
                    name: 'Xylanzol',
                    ticker: 'XYZ',
                    price: initialPrice,
                    initialPrice,
                    hardLimit: 4,
                    weights: setXyz.weights,
                    waves: setXyz.waves,
                    drift: (t) => driftFunc(0.02)(t)
                },
                {
                    name: 'AlphaBark',
                    ticker: 'ABC',
                    price: initialPrice,
                    initialPrice,
                    hardLimit: 4,
                    weights: setAbc.weights,
                    waves: setAbc.waves,
                    drift: (t) => driftFunc(0.02)(t)
                }
            ]
        };
    }

    rnd = new Math.seedrandom(`${RSEED}${state.time}`);

    switch (action.type) {
        case TIME_STEP:
            let time = state.time + (action.time || 86400000);

            return {
                ...state,
                time,
                products: state.products.map((product) => {
                    return updateProduct(time, product);
                })
            };

        case PAUSE:
            return {
                ...state,
                paused: !state.paused
            };
    }

    return state;
};

function updateProduct(time, product) {
    return {
        ...product,
        price: formula(product.initialPrice, product.hardLimit, product.weights, product.waves, product.drift, time)
    };
}

let store = createStore(rootReducer, applyMiddleware(ReduxThunk));

let oldState = null;

let viewState = {};

store.subscribe(() => {
    let state = store.getState();

    renderFromState(oldState, state, viewState);

    oldState = state;
});


function renderFromState(old, current, view) {
    if (!old) {
        const h1 = document.createElement('h1');
        h1.appendChild(document.createTextNode('Hello!'));
        document.body.appendChild(h1);

        const label = document.createElement('h2');
        label.classList.add('counter-label');
        document.body.appendChild(label);

        document.getElementsByClassName('counter-label')[0].innerHTML = `${current.products[0].price}`;

        const btn = document.createElement('button');
        btn.appendChild(document.createTextNode('Step'));
        btn.onclick = () => store.dispatch({ type: TIME_STEP, time: STEP_SIZE });
        document.body.appendChild(btn);

        view.pauseBtn = document.createElement('button');
        view.pauseBtn.appendChild(document.createTextNode('Pause'));
        view.pauseBtn.onclick = () => store.dispatch({ type: PAUSE });
        document.body.appendChild(view.pauseBtn);

        view.charts = current.products.map((product) => {
            const chartContainer = document.createElement('div');
            const chart = LightweightCharts.createChart(chartContainer, { width: 800, height: 300 });
            document.body.appendChild(chartContainer);

            return chart;
        });

        view.lineSeries = current.products.map((product, index) => {
            return view.charts[index].addLineSeries({
                title: product.ticker,
            });
        });
        // view.lineSeries.setData([
        //     { time: current.time / 1000.0, value: current.products[0].price }
        // ]);

        setInterval(() => {
            if (!view.paused) {
                store.dispatch({ type: TIME_STEP, time: STEP_SIZE });
            }
        }, 250);
    } else {
        document.getElementsByClassName('counter-label')[0].innerHTML = `${current.products[0].price}`;

        view.lineSeries.forEach((series, index) => {
            series.update({
                time: current.time / 1000.0,
                value: current.products[index].price
            });
        });

        view.paused = current.paused;

        view.pauseBtn.innerHTML = current.paused ? 'Play' : 'Pause';
    }
}

store.dispatch({ type: 'BEGIN' });
// store.dispatch({ type: 'INCREMENT' });
// store.dispatch({ type: 'INCREMENT' });

/**
 * Noe we need to think about the formula.
 * it needs to be simple, but deep and complex enough that it will be difficult to
 * get.
 * sum of  sine waves + noise. volatility + noise.
 * Collection of sine waves of different wavelengths, up to millisecond precision.
 * Each instrument price formula is a linear combination of the wave results,
 * in which the weights are determined by a different collection of waves.
 * The weight waves is different for each instrument, but the main waves
 * are shared. The final
 *
 * Big-wave + bignoise() + mediumwave() + mediumnoise() + smallwave() + smallnoise()
 *
 * percentage from initial price = [bigwave() + bignoise() + bigdrift()] * bigweight() + [mediumwave() + mediumnoise() + mediumdrift()] * mediumweight()
 * and so on...
 *
 * Note: In the rogulike, make things as far apart and precious as we can.
 */


function formula(initialPrice, hardLimit, weights, waves, drift, time) {
    // debugger;
    let wavers = waves.map((wave) => wave(time));
    let weigthters = weights.map(weight => weight(time));
    let zipped = zip(weigthters, wavers);
    let reduced = zipped.reduce((acc, pair) => acc + pair[0] * pair[1], 0);
    let drifted = drift(time);

    console.log(reduced);
    let result = initialPrice * ((Math.abs(1 - hardLimit * reduced)) + drifted);
    // console.log(result);
    // let newHardLimit = 2 + (20/result);
    // result = initialPrice * ((Math.abs(1 - newHardLimit * reduced)) + drifted);
    // console.log(newHardLimit);
    // console.log(result);
    // console.log('');

    return result;
}

function zip(a1, a2) {
    if (a1.length !== a2.length) {
        throw new Error('Arrays are different sizes');
    }

    const ret = [];

    a1.forEach((el, index) => {
        ret.push([el, a2[index]]);
    });

    return ret;
}

function toTimeLabel(ms) {
    const seconds = ms / 1000.0;

    if (seconds < 60) {
        return `${seconds.toFixed(1)} seconds`;
    }

    const minutes = seconds / 60.0;

    if (minutes < 60) {
        return `${minutes.toFixed(1)} minutes`;
    }

    const hours = minutes / 60.0;

    if (hours < 24) {
        return `${hours.toFixed(1)} hours`;
    }

    const days = hours / 24.0;

    if (days < 30) {
        return `${days.toFixed(1)} days`;
    }

    const months = days / 30.0;

    if (months < 12) {
        return `${months.toFixed(1)} months`;
    }

    const years = months / 12.0;

    return `${years.toFixed(1)} years`;
}