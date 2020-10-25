const url = 'http://localhost';
const oneYear = 31536000000;

let globalStyles = {};

function resetMargin() {
    document.body.style.margin = '20px auto';
    document.body.style.maxWidth = '800px';
}

function unsetMargin() {
    document.body.style.margin = '0';
    document.body.style.maxWidth = 'unset';
}

/**
 * What does an indicator need?
 * an indciato nrneeds an interface
 * it will use different types od charts.
 * so the indicator needs to have an interface to get the prices,
 * calculate them and return a set of values for the chart.
 */
let activeCharts = {
    current: 'CRIS',
    globalConfig: {
        timeRange: {
            from: 0,
            granularity: 'D',
        },
        indicators: [],
    },
    CRIS: {},
};

const canonNext = (error, goBack) => {
    if (error !== 'startOver') {
        clearScreen();
        createAndAppend('h1', (e) => {
            e.innerHTML = 'It\'s an error!';
            e.style.color = '#F50057';
        });
        subTitle('And it\'s a bloody awful one!');

        pageImg('/assets/alert.svg');

        if (error.response) {
            if (error.response.status === 401) {
                localStorage.clear();
                begin();
            } else {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                jsonCode(error.response.data);
                jsonCode(error.response.status);
                jsonCode(error.response.headers);
            }
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            jsonCode(error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            jsonCode(error.message);
        }

        console.error(error);
    } else {
        console.log('got here');
    }

    if (goBack) {
        button('Back', goBack);
    }
};

async function begin() {
    clearScreen();

    h1('Gruber$!');

    const token = localStorage.getItem('token');

    if (token) {
        welcomePage(canonNext);
    } else {
        firstPageOptions(canonNext);
    }
    // chartPage();
}

function logout() {
    localStorage.clear();
    window.location.reload();
}

function chartPage() {
    subTitle('Charts')
    const chart = lwChart({ width: 800, height: 400 });
    const lineSeries = chart.addLineSeries();
    lineSeries.setData([
        { time: '2019-04-11', value: 80.01 },
        { time: '2019-04-12', value: 96.63 },
        { time: '2019-04-13', value: 76.64 },
        { time: '2019-04-14', value: 81.89 },
        { time: '2019-04-15', value: 74.43 },
        { time: '2019-04-16', value: 80.01 },
        { time: '2019-04-17', value: 96.63 },
        { time: '2019-04-18', value: 76.64 },
        { time: '2019-04-19', value: 81.89 },
        { time: '2019-04-20', value: 74.43 },
    ]);
}

function firstPageOptions(next) {
    clearScreen();
    h1('Gruber$!');
    pageImg('/assets/main-pic.svg')
    subTitle('Welcome!')
    p('Gruber$ is a platform where you play games and trade your winnings with other players for cryptocurrency! ')
    p('Get started by creating an account, or logging in if you are already a member:')
    button('Login', async () => await login(next));
    button('Register', async () => await registration(next));
}

// attribution 1 <a href="https://www.freepik.com/vectors/background">Background vector created by freepik - www.freepik.com</a>

async function login(next) {
    try {
        await beginForm('Login', async () => {
            pageImg('/assets/login.svg')
            write('<strong>Email</strong>')
            const email = await read('Email')
            write('<strong>Password</strong>')
            const password = await read('Password', 'password');

            const response = await apiLogin({ email, password }, next);

            if (response && response.data && response.data.success) {
                console.log(response);
                const token = response.data.data.token;

                localStorage.setItem('token', token);

                await welcomePage(next);
            }
        }, () => firstPageOptions(next));
    } catch (error) {
        next(error);
    }
}

async function adminPage(next) {
    try {
        clearScreen();
        title('Admin Dashboard');
        subTitle('Welcome!');

        const newNext = (error) => next(error, () => adminPage(next));

        await colChooser(newNext);
    } catch (error) {
        next(error, () => adminPage(next));
    }
}

function list(items, parent) {
    createAndAppend('ul', (ul) => {
        items.forEach(item => {
            createAndAppend('li', (li) => {
                li.innerHTML = item;
            }, ul);
        });
    }, parent);
}

async function colChooser(next) {
    try {
        write('');
        const response = await apiGet('/api/v1/admin');

        const collections = response.data.collections;

        const codebase = response.data.codebase;

        list(collections);

        commandSection(next, codebase);

        // const options = collections.map(collection => {
        //     return [collection, () => ];
        // });

        // options.push(['Logout', () => logout()]);

        // buttonGroup(options);
    } catch (error) {
        if (error === 'startOver') {
            colChooser(next);
        } else {
            next(error);
        }
    }
}

async function commandSection(next, codebase) {
    try {
        write('');
        title('Command Prompt');
        const ctx = {};
        eval(codebase.code);
        ctx.giveCryptos = (accountId, currency, amount) => {
            return ctx.findOneAndUpdate('accounts', [{ _id: accountId }, {
                $inc: { [`cryptos.${currency}`]: amount },
            }]);
        };// 5f84d35d86c18500ed9748b1

        ctx.populate = async () => {
            const response = await apiPost('/api/v1/admin', ctx.findAll('accounts'), next);
            const accounts = response.data.result.filter(acc => acc.gameName === 'Grubers Exchange');

            accounts.forEach(async (acc) => {
                await ctx.send(ctx.giveCryptos(acc._id, 'btc', 10000));
                await ctx.send(ctx.giveGrubers(acc._id, 10000));
            });
        };

        // ctx.populate = async () => {
        //     let userAcc = await ctx.send(ctx.findUser('user'));
        //     userAcc = userAcc.data.user._id;

        //     let user2Acc = await ctx.send(ctx.findUser('user2'));
        //     user2Acc = user2Acc.data.user._id;

        //     const 
        // };
        await rawCmd(next, ctx);
        // buttonGroup([
        //     ['Raw', () => rawCmd(next, collection)],
        // ]);
    } catch (error) {
        next(error);
    }
}

function gambiParser(txt) {
    if (!txt) {
        return JSON.parse(txt);
    }

    if (!txt.length) {
        return {};
    }
}

/**
 * Language example:
 * program searchUser emailBit
 * co query
 * set query collection 'users'
 * set query operation 'find'
 * set query args []
 * co textOp
 * co search
 * set search $search emailBit
 * set textOp $text search
 * push query args textOp
 * send query response
 * ret response
 * end
 * 
 * searchUser wolmir
 */

async function rawCmd(next, c) {
    try {
        subTitle('Enter the command:');
        let script = await read('>_');

        let ret = null;

        eval(`ret= (() => ${script})()`);

        if (ret && ret.then) {
            ret.then(() => rawCmd(next, c));
        } else {
            preCode(JSON.stringify(ret, null, 4));
            rawCmd(next, c);
        }
    } catch (error) {
        next(error);
    }
}

async function welcomePage(next) {
    try {
        const userResponse = await apiGet('/api/v1/user');
        const user = userResponse.data.user;

        if (user.isAdmin) {
            adminPage(next);
            return;
        }

        clearScreen();
        title('My accounts')
        pageImg('/assets/banking.svg')

        const response = await apiGet('/api/v1/accounts')

        const accounts = response
            .data.accounts;

        const tgAccount = accounts.find((account) => account.gameName === 'Trading Game');

        if (tgAccount) {
            localStorage.setItem('hasTradingGameAccount', 'true');
        }

        createAndAppend('table', (table) => {
            createAndAppend('thead', (thead) => {
                thead.innerHTML = `
                    <tr>
                        <th>Game Name</th>
                        <th>Gruber$ balance</th>
                        <th>Actions</th>
                    </tr>
                `;
            }, table)

            createAndAppend('tbody', (tbody) => {
                accounts.forEach((account) => {
                    createAndAppend('tr', (tr) => {
                        createAndAppend('td', (td) => {
                            td.innerHTML = account.gameName;
                        }, tr)

                        createAndAppend('td', (td) => {
                            td.innerHTML = account.grubersBalance.toFixed(2);
                        }, tr);

                        createAndAppend('td', (td) => {
                            button('Manage', () => manageAccount(next, account), td);
                        }, tr)
                    }, tbody);
                });
            }, table)
        })

        button('Logout', () => logout());
        button('Browse Games', async () => await gamesPage(next));
        button('Transfer Gruber$', () => transferGrubers(next));
        button('Gruber$ Exchange', () => grubersExchangePage(next));
    } catch (error) {
        next(error)
    }
}

function details(summary, info) {
    createAndAppend('details', (e) => {
        createAndAppend('summary', sum => sum.innerHTML = summary, e);
        createAndAppend('p', p => p.innerHTML = info, e);
    });
}

async function manageAccount(next, account) {
    try {
        clearScreen()
        title('Manage account');
        subTitle(`Domain: ${account.gameName}`);

        write(`<strong>Account ID:</strong> ${account._id}`);
        write(`<strong>Gruber$ Balance:</strong> ${account.grubersBalance}`);

        if (account.gameName === "Grubers Exchange") {
            h3('Cryptocurrency balances*:')
            details(
                '*Balances are given in multiples of the smallest unit. (click for info)',
                `
                <pre>
                <code>
                Bitcoin:      10<sup>-8</sup>  BTC
                Bitcoin Cash: 10<sup>-8</sup>  BCH
                DAI:          10<sup>-18</sup> DAI
                Ethereum:     10<sup>-18</sup> ETH
                Litecoin:     10<sup>-8</sup>  LTC
                USDC:         10<sup>-8</sup>  USDC
                </code>
                </pre>
                `
            )

            Object.keys(account.cryptos).forEach(currency => {
                const balance = account.cryptos[currency];
                let normalized = balance;

                if (normalized > 0) {
                    if (currency === 'dai' || currency === 'eth') {
                        normalized = normalized / (10 ** 18);
                    } else {
                        normalized = normalized / (10 ** 8);
                    }

                    normalized = ` (${normalized}${currency.toUpperCase()})`;
                }

                write(`
                <strong>${currency.toUpperCase()}:</strong> ${balance}${normalized}
                `);
            });

            button('Cryptocurrency Deposits', () => depositPage(next));
            button('Request withdrawal', () => requestWithdrawal(next, account));
            button('Home', () => welcomePage(next));
        }
    } catch (error) {
        next(error);
    }
}

async function requestWithdrawal(next, account) {
    try {
        await beginForm('Withdrawal', async () => {
            write('Please select the currency:');

            let currency;

            while (!currency) {
                currency = await fSelect([
                    { value: null, name: ''},
                    { value: 'btc', name: 'Bitcoin' },
                    { value: 'bch', name: 'Bitcoin Cash' },
                    { value: 'ltc', name: 'Litecoin' },
                    { value: 'dai', name: 'DAI' },
                    { value: 'eth', name: 'Ethereum' },
                    { value: 'usdc', name: 'USD Coin' },
                ]);
            }

            write('Enter the amount you wish to withdraw:');
            let amount = await read('0', 'number');
            amount = parseInt(amount, 10);

            write('Write the destination address/account:');
            const address = await read('Wallet address');

            const response = await apiPost(`/api/v1/exchange/withdrawals`, {
                currency,
                amount,
                address,
            });

            if (response && response.data) {
                manageAccount(next, response.data.account);
            }
        }, () => manageAccount(next, account));
    } catch (error) {
        next(error);
    }
}

async function fSelect(options, parent) {
    return new Promise((resolve) => {
        const elt = select(options, (value) => {
            resolve(value);

            elt.setAttribute('disabled', true);
        }, parent);
    });
}

async function depositPage(next) {
    try {
        clearScreen();
        title('Deposits');

        pageImg('/assets/blind-swap3.svg');

        write(`
        We use the Coinbase Commerce service to receive cruptocurrency deposits.
        If you confirm the action you'll see a link to a Coinbase payment page
        where you can inform any value in any of our accepted cryptocurrencies.
        `);

        write(`
        It takes less than 1 hour for Coinbase to confirm the transaction, but it
        may take up to one business day for us to confirm it. In any case, you can see
        the status of you deposits here. Thank you for understanding!
        `);

        let deposits = await apiGet(`/api/v1/exchange/account/deposits`);

        deposits = deposits.data.deposits
            .map((raw) => {
                const timeline = raw.charge.timeline;
                const lastStatus = timeline[timeline.length - 1];
                const lastUpdated = new Date(lastStatus.time).toLocaleString();
                const currentStatus = lastStatus.status;
                let amounts = raw.charge.payments.map((payment) => {
                    return {
                        currency: payment.value.crypto.currency,
                        amount: payment.value.crypto.amount,
                    };
                });

                return {
                    lastUpdated,
                    currentStatus,
                    amounts,
                };
            })
            .filter(i => i);

        table({
            columns: ['lastUpdated', 'currentStatus', 'amounts'],
            columnLabels: ['Last Update', 'Status', 'Amount Received'],
            rows: deposits,
            emptyMessage: 'You made no deposits so far.',
            cells: {
                amounts: (listOfAmounts, td) => {
                    list(listOfAmounts.map(am => `${am.amount} ${am.currency}`), td);
                },
            },
        });

        button('Make deposit', async () => {
            clearScreen();
            title('Preparing the payment link, please wait just a minute...');
            let chargeData = await apiPost('/api/v1/exchange/account/deposits', {}, next);

            chargeData = chargeData.data.charge;

            clearScreen();
            title('Payment')
            subTitle('Powered by <a href="https://www.coinbase.com/" target="_blank">Coinbase</a>')

            write('Please use the link below to complete your deposit:');

            write(`
            <a href="${chargeData.hosted_url}" target="_blank">${chargeData.hosted_url}</a>
            `);

            button('Back', () => depositPage(next));
        });

        button('Home', () => welcomePage(next));
    } catch (error) {
        next(error);
    }
}

async function grubersExchangePage(next) {
    try {
        clearScreen();
        title('Exchange');
        pageImg('/assets/exchange.svg');
        subTitle('Welcome to the Gruber$ Blind Swap exchange!')
        h3('How it works')
        write('1. First, select a currency to exchange for Gruber$.')
        write(`
        2. Select a category to participate in. The category represents the cryptocurrency atomic units at stake.<br>
        For example: The BTC 100 category represents 100 satoshis (1 satoshi = 0.00000001 BTC).
        `)
        write(`
        3. If you want to sell Gruber$, write an arbitrary amount of Gruber$ to put at stake too. If you'd like to buy,
        then just put 0 in the field and click <em>Send</em>.
        `)
        write(`
        4. The system will withdraw the number of crypto units corresponding to the category number and also the Gruber$ amount from your exchange account.
        It will return an error if the account doesn't have the needed amounts.
        `)
        write(`
        5. If there is no pending blind swap from a previous user in the same category, the system will save yours as pending and will wait for another
        user to submit his request.
        `)
        write(`
        6. If there is a pending swap, or if another user submitted his request later, then the system will compare the Gruber$ amounts from
        each request.<br>
        The user that entered the <b>highest</b> amount of <b>Gruber$</b> will be the nominal <b>seller</b> and will forfeit the Gruber$,
        but will earn the other user's crypto coins (In the BTC 100 category, that would be 100 satoshis, for example).<br>
        The user that entered the <b>lowest</b> amount of Gruber$ will be the nominal <b>buyer</b> and will receive the other user's Gruber$ at stake,
        but will forfeit the crypto amount.
        `)
        write('Please select a currency:')
        buttonGroup([
            ['Bitcoin', () => blindSwapPage(next, 'btc', '/assets/btc.png')],
            ['Bitcoin Cash', () => blindSwapPage(next, 'bch', '/assets/bch.svg')],
            ['Litecoin', () => blindSwapPage(next, 'ltc', '/assets/ltc.png')],
            ['DAI', () => blindSwapPage(next, 'dai', '/assets/dai.svg')],
            ['Ethereum', () => blindSwapPage(next, 'eth', '/assets/eth.png')],
            ['USDC', () => blindSwapPage(next, 'usdc', '/assets/usdc.svg')],
            ['Home', () => welcomePage(next)],
        ]);
        // subTitle('<img src="/assets/btc.png" style="width: 50px;"> Bitcoin/Gruber$');
        // await exchangeSummary(next, 'btc');
        // subTitle('<img src="/assets/bch.svg" style="width: 50px;"> Bitcoin Cash/Gruber$');
        // await exchangeSummary(next, 'bch');
        // subTitle('<img src="/assets/ltc.png" style="width: 50px;"> Litecoin/Gruber$');
        // await exchangeSummary(next, 'ltc');
        // subTitle('<img src="/assets/eth.png" style="width: 50px;"> Ethereum/Gruber$');
        // await exchangeSummary(next, 'eth');
        // subTitle('<img src="/assets/dai.svg" style="width: 50px;"> Dai/Gruber$');
        // await exchangeSummary(next, 'dai');
        // subTitle('<img src="/assets/usdc.svg" style="width: 50px;"> USD Coin/Gruber$');
        // await exchangeSummary(next, 'usdc');
    } catch (error) {
        next(error);
    }
}

async function blindSwapPage(next, currency, imgSrc) {
    try {
        clearScreen();
        title(`<img src="${imgSrc}" style="width: 50px;"> ${currency.toUpperCase()}`);
        let swaps = await apiGet(`/api/v1/exchange/${currency}/blind-swaps`);
        swaps = swaps.data.swaps;

        if (!swaps.length) {
            write('No swaps so far.')
        } else {
            write('TODO')
        }

        write('Choose a category')
        preCode(`1 unit = 0.00000001 ${currency.toUpperCase()}`)
        const categories = [
            ['100', () => blindSwapForm(next, currency, 100)],
            ['1K', () => blindSwapForm(next, currency, 1000)],
            ['10K', () => blindSwapForm(next, currency, 10000)],
            ['100K', () => blindSwapForm(next, currency, 100000)],
        ];
        buttonGroup([
            ...categories,
            ['Check again', () => blindSwapPage(next, currency, imgSrc)],
            ['Back', () => grubersExchangePage(next)],
        ]);
    } catch (error) {
        next(error);
    }
}

async function blindSwapForm(next, currency, category) {
    try {
        let error;
        let grubersAmount = 0;

        do {
            error = null;

            write('How much Gruber$? (0 if you\'d like to buy instead)');
            grubersAmount = await read('0', 'number');

            grubersAmount = parseInt(grubersAmount || 0, 10);
            console.log(grubersAmount);

            if (isNaN(grubersAmount) || (grubersAmount < 0)) {
                error = `Please enter a valid number`
            }

            if (error) {
                tellError(error);
            }
        } while (error);

        const body = {
            grubersAmount,
            bid: category,
        };

        const response = await apiPost(`/api/v1/exchange/${currency}/blind-swaps`, body, next);

        const blindSwap = response.data.blindSwap;

        if (!blindSwap.secondBidder) {
            write('Thanks! Your bid was registered and is currently pending!');
            write('When another user submits a bid in the same category we\'ll compare them and name the buyer and seller.')
        } else {
            h3('Results');

            const buyer = blindSwap.buyer;
            const seller = blindSwap.seller;

            if (!blindSwap.buyer) {
                write('It was a tie!');
                write('Both parties submitted the same Gruber$ amount and their cryptos and Gruber$ were restored.')
            } else {
                write(`The <strong>buyer</strong> of the transaction entered <strong>${buyer.grubersAmount}</strong> Gruber$.`)
                write(`The <strong>seller</strong> of the transaction entered <strong>${seller.grubersAmount}</strong> Gruber$.`)
            }
        }

        button('Back', () => grubersExchangePage(next));

    } catch (error) {
        next(error)
    }
}

async function exchangeSummary(next, coin) {
    try {
        let swaps = await apiGet(`/api/v1/exchange/${coin}/blind-swaps`);
        swaps = swaps.data.swaps;

        if (!swaps.length) {
            write('No swaps so far!');
        }
        // let openOrders = await apiGet(`/api/v1/exchange/${coin}/market/open-orders`);
        // openOrders = openOrders.data;

        // const sortedOrders = [];

        // openOrders.bids.forEach(bid => {
        //     let category = sortedOrders.find(so => so.price === bid.bid);

        //     if (!category) {
        //         category = {
        //             price: bid.bid,
        //             bids: bid.lots,
        //             offers: 0,
        //         };
        //         sortedOrders.push(category);
        //     } else {
        //         category.bids += bid.lots;
        //     }
        // });

        // openOrders.offers.forEach(offer => {
        //     let category = sortedOrders.find(so => so.price === offer.ask);

        //     if (!category) {
        //         category = {
        //             price: offer.ask,
        //             bids: 0,
        //             offers: offer.lots,
        //         };
        //         sortedOrders.push(category);
        //     } else {
        //         category.offers += offer.lots;
        //     }
        // });

        // sortedOrders.sort((a, b) => b.price - a.price);

        // h3('Marketplace');
        // button('What\'s this?', () => helpPage(next, 'Marketplace'));
        // table({
        //     columns: ['price', 'bids', 'offers'],
        //     columnLabels: ['Price', 'Bids', 'Offers'],
        //     rows: sortedOrders,
        //     emptyMessage: 'No bids or offers available at this time.',
        //     cells: {
        //         price: (p, td) => {
        //             td.innerHTML = prettifyPrice(p);
        //         },
        //     },
        // });
        // write('<br>')
    } catch (error) {
        next(error);
    }
}

function helpPage(next, topic) {
    const topics = {
        Marketplace: () => {
            clearScreen();
            title('The Marketplace')
            pageImg('/assets/exchange.svg')
            subTitle('Note: place a video here.')
            write(`
            There are two approaches that participants can take to exchange Gruber$ for Cryptocurrency and vice-versa:
            The marketplace and the <a onclick="helpPage(canonNext, 'Blind Swap')">blind swaps</a>.
            `);
            write(`
            In the marketplace participants exchange Gruber$ and crytocurrencies through <strong>bids</strong> and <strong>offers</strong>.
            `);
            write(`
            A <strong>bid</strong> is the intent to purchase a precise amount of <strong>lots</strong> (1 lot = 1,000 Gruber$) at an
            exact price per lot denoted in multiples of the smallest possible denomination of a specific cryptocurrency.
            `)
            write(`
            <strong>Let me give an example of a bid:</strong><br>
            In Bitcoin, the smallest possible denomination is 0.00000001 BTC, also known as 1 <strong>satoshi</strong>.
            In the Bitcoin/Gruber$ marketplace, if you see a bid with price 1234 and 100 lots, it means the bidder wants
            to purchase 100 lots (100,000 Gruber$) at a price of 1234 satoshis per lot. That is, 0.00001234 BTC per lot.
            `)
            write(`
            An <strong>offer</strong>, on the other hand, is the intent to sell a precise amount of <strong>lots</strong> at an
            exact price per lot denoted in multiples of the smallest possible denomination of a specific cryptocurrency.
            `)
            write(`
            <strong>Example of an offer:</strong><br>
            In Ethereum, the smallest possible denomination for this platform is 0.000000001 ETH, also know as 1 <strong>Gwei</strong>.
            So, an offer of 100 lots with price 1234 means the seller is asking 1234 Gwei or 0.000001234 ETH for each lot he is willing to sell.
            `)
            write(`
            You don't need to create bids and offers to participate, though. If you would like to buy some lots and you see
            an offer you like, you can click the <strong>Buy</strong> 
            `);
        },
    };

    button('Back', () => grubersExchangePage(next));
    topics[topic](next);
}

function prettifyPrice(price) {
    return price;
}

function h3(txt, parent) {
    txtTag('h3', txt, parent);
}

async function transferGrubers(next) {
    try {
        await beginForm('Transfer Gruber$', async () => {
            let accounts = await apiGet('/api/v1/accounts');

            accounts = accounts.data.accounts;

            write('Please choose the source account:');

            const options = [{ name: '', value: null }].concat(accounts.map(account => ({
                value: account.gameName,
                name: account.gameName,
            })));

            select(options, (sourceAccount) => {
                write('Now select the destination account: ');
                select(options, async (destinationAccount) => {
                    write('Now enter the desired amount to transfer:')
                    const amount = await read('0', 'number');

                    write('Please wait a few seconds...');

                    const response = await apiPost('/api/v1/accounts/transfer-grubers', {
                        sourceAccount,
                        destinationAccount,
                        amount: parseInt(amount, 10),
                    }, next);

                    if (response && response.data && response.data.success) {
                        welcomePage(next);
                    }
                });
            });
        }, () => welcomePage(next));
    } catch (error) {
        next(error);
    }
}

async function gamesPage(next) {
    try {
        clearScreen()
        title('Games')
        write('This is our list of available games so far.')

        const games = [{
            name: 'Trading Game',
            img: '/assets/stock-prices.svg',
            description: 'A stock market simulator with thousands of assets to trade!',
            moreDetails: () => tradingGamePage(next)
        }];

        games.forEach((game) => {
            subTitle(game.name)
            img(game.img, '40%')
            write(game.description)
            button('More Details', game.moreDetails)
        })
    } catch (error) {
        next(error)
    }
}

async function tradingGamePage(next) {
    try {
        clearScreen()

        let tgAccount;

        try {
            tgAccount = await apiGet('/api/v1/trading-game/account');//localStorage.getItem('hasTradingGameAccount');
            tgAccount = tgAccount.data.account;
        } catch (error) {
            console.error(error);
        }

        if (tgAccount) {
            activeCharts.globalConfig.timeRange.to = tgAccount.currentTime;
            activeCharts.globalConfig.timeRange.from = tgAccount.currentTime - oneYear;
            tradingGameMainPage(next, tgAccount, 'CRIS')
        } else {
            title('Trading Game')
            pageImg('/assets/stock-prices.svg')
            write('In this game you participate in a simulated stock market created just for you!')
            const txt = `
            There are hundreds of thousands of stocks listed in the exchange that you can build
            a portfolio with. You can enter stop-loss and take-profit orders, as well as limit
            and stop entry orders.
        `;
            write(txt);

            button('Start playing!', () => createTradingGameAccountPage(next));
        }
    } catch (error) {
        next(error)
    }
}

async function createTradingGameAccountPage(next) {
    try {
        clearScreen();

        const response = await apiPost('/api/v1/trading-game/accounts', {});

        if (response && response.data && response.data.success) {
            localStorage.setItem('hasTradingGameAccount', 'true');

            const tgAccount = response.data.account;

            activeCharts.globalConfig.timeRange.to = tgAccount.currentTime;
            activeCharts.globalConfig.timeRange.from = tgAccount.currentTime - oneYear;
            tradingGameMainPage(next, tgAccount, 'CRIS');
        } else {
            throw 'Call Wolmir, please. Something went wrong'
        }
        console.log(response);
    } catch (error) {
        next(error);
    }
}

async function tradingGameMainPage(next, account, ticker, fullscreen) {
    try {
        if (typeof account !== 'object') {
            throw 'account is not an object';
        }

        let tgAccount = await apiGet('/api/v1/trading-game/account');

        tgAccount = tgAccount.data.account;

        clearScreen();
        title('Trading Game');
        subTitle(`Current balance: ${tgAccount.grubersBalance.toFixed(2)}`)
        let bigDiv = undefined;

        if (fullscreen) {
            unsetMargin();

            bigDiv = createAndAppend('div', (e) => {
                e.style.width = '100%';
                e.style.height = '700px';
            })
        } else {
            resetMargin();
        }

        setUpOrderMarkers(next, ticker || activeCharts.current || 'CRIS', tgAccount);

        await tgChart(ticker || activeCharts.current || 'CRIS', activeCharts.globalConfig, bigDiv);
        write('')
        let btnGroup = [
            ['Logout', () => logout()],
            ['Configure chart', () => configureChart(next, tgAccount)],
            ['Fullscreen', () => tradingGameMainPage(next, tgAccount, ticker, true)],
            ['Search stock', () => searchStockPage(next, tgAccount)],
            ['Buy', () => buyStockPage(next, tgAccount, ticker || activeCharts.current || 'CRIS')],
            ['My orders', () => ordersPage(next, tgAccount)],
            ['My portfolio', () => portfolioPage(next)],
            ['Back', () => welcomePage(next)],
        ];

        if (fullscreen) {
            btnGroup = [
                ['Exit fullscreen', () => tradingGameMainPage(next, tgAccount, ticker, false)]
            ];
        }
        buttonGroup(btnGroup);

        if (!fullscreen) {
            write('Time jumps')
            button('+1 Min', () => timeJump(next, 'M1'));
            button('+15 Min', () => timeJump(next, 'M15'));
        }
    } catch (error) {
        next(error);
    }
}

function setUpOrderMarkers(next, ticker, tgAccount) {
    try {
        activeCharts[ticker] = activeCharts[ticker] || {};

        activeCharts[ticker].markers = [];

        tgAccount.orders.entries
            .filter(order => order.ticker === ticker)
            .filter(order => order.status === 'filled')
            .filter(order => order.filledAt >= activeCharts.globalConfig.timeRange.from)
            .forEach(filled => {
                activeCharts[ticker].markers.push({
                    time: Math.floor(filled.filledAt / 1000),
                    position: (filled.operation === 'buy') ? 'belowBar' : 'aboveBar',
                    color: (filled.operation === 'buy') ? 'rgb(201, 255, 125)' : 'rgb(255, 125, 125)',
                    shape: (filled.operation === 'buy') ? 'arrowUp' : 'arrowDown',
                    text: `${filled.operation.toUpperCase()}@${filled.fillPrice.toFixed(2)}`,
                    size: 2,
                });
            });

    } catch (error) {
        next(error);
    }
}

async function portfolioPage(next) {
    try {
        clearScreen();
        title('My portfolio');
        let tgAccount = await apiGet('/api/v1/trading-game/account');
        tgAccount = tgAccount.data.account;

        button('Back', () => tradingGameMainPage(next, tgAccount));

        const holdings = Object.keys(tgAccount.holdings)
            .map(key => tgAccount.holdings[key])
            .filter(holding => holding.units > 0);

        table({
            columns: ['ticker', 'units', 'sell'],
            columnLabels: [
                'Stock',
                'Units',
                'Sell',
            ],
            rows: holdings,
            cells: {
                sell: (_, td, holding) => {
                    button('Sell', () => sellPage(next, holding), td);
                },
            },
        })
    } catch (error) {
        next(error);
    }
}

async function sellPage(next, holding) {
    try {
        await beginForm(`Sell ${holding.ticker}`, async () => {
            write('How many units would you like to sell?')
            let units = await read(`${holding.units}`, 'number');

            if (!units || !units.length) {
                units = holding.units;
            }

            write('Selling...');

            const payload = {
                order: {
                    ticker: holding.ticker,
                    type: 'market',
                    operation: 'sell',
                    units: parseInt(units, 10),
                },
            };

            await apiPost('/api/v1/trading-game/account/orders', payload, next);

            const account = await apiGet('/api/v1/trading-game/account');

            ordersPage(next, account);
        }, () => portfolioPage(next));
    } catch (error) {
        next(error);
    }
}

async function timeJump(next, timeframe) {
    try {
        const response = await apiPost('/api/v1/trading-game/account/time-advances', { amount: timeframe });

        let account = await apiGet('/api/v1/trading-game/account');

        account = account.data.account;

        activeCharts.globalConfig.timeRange.to = account.currentTime;

        tradingGameMainPage(next, account);
    } catch (error) {
        next(error);
    }
}

async function buyStockPage(next, tgAccount, ticker) {
    try {
        await beginForm(`Buy ${ticker}`, async () => {
            write('Would like to buy at market or use a limit or stop order?');
            buttonGroup([
                ['Market', () => buyAtMarket(next, tgAccount, ticker)],
                ['Limit', () => buyAtLimit(next, tgAccount, ticker)],
                ['Stop', () => buyAtStop(next, tgAccount, ticker)],
            ]);
        }, () => tradingGameMainPage(next, tgAccount));
    } catch (error) {
        next(error);
    }
}

async function buyAtMarket(next, tgAccount, ticker) {
    try {
        await beginForm(`Buy ${ticker} - Market`, async () => {
            write('How many stocks would you like to purchase?');
            const volume = await read('Units', 'number');
            write('Stop loss:')
            const stopLoss = await read('Leave blank to not set a stop loss', 'number');
            write('Take profit:')
            const takeProfit = await read('Leave blank to not set a take profit', 'number');

            const payload = {
                order: {
                    ticker,
                    type: 'market',
                    operation: 'buy',
                    units: volume,
                    stopLoss,
                    takeProfit,
                }
            };

            if (!payload.order.stopLoss || !payload.order.stopLoss.length) {
                delete payload.order.stopLoss
            }

            if (!payload.order.takeProfit || !payload.order.takeProfit.length) {
                delete payload.order.takeProfit
            }

            const response = await apiPost('/api/v1/trading-game/account/orders', payload, next);

            if (response && response.data.success) {
                ordersPage(next, tgAccount);
            }
        }, () => tradingGameMainPage(next, tgAccount));
    } catch (error) {
        next(error);
    }
}

async function ordersPage(next, tgAccount) {
    try {
        clearScreen();
        title('My orders');
        const response = await apiGet('/api/v1/trading-game/account/orders');
        const orders = response.data.orders.entries;
        const upperCell = (i, td) => { td.innerHTML = (i + '').toUpperCase(); };
        table({
            columns: [
                'createdAt',
                'ticker',
                'type',
                'operation',
                'units',
                'status',
            ],
            columnLabels: [
                'Date',
                'Stock',
                'Type',
                'Operation',
                'Units',
                'Status'
            ],
            rows: orders,
            cells: [
                (i, td) => { td.innerHTML = new Date(i).toUTCString() },
                upperCell,
                upperCell,
                upperCell,
                upperCell,
                (status, td, order) => {
                    if (status === 'error') {
                        td.innerHTML = `
                          Error: ${order.error}
                        `;
                    } else {
                        td.innerHTML = status.toUpperCase();
                    }
                },
            ],
        });

        button('Home', () => tradingGameMainPage(next, tgAccount));
    } catch (error) {
        next(error);
    }
}

async function searchStockPage(next, tgAccount) {
    try {
        beginForm('Stock search', async () => {
            write('Type any four-letter ticker symbol:')
            let ticker;
            do {
                ticker = await read('WXYZ');

                if (ticker.length !== 4) {
                    write('Only four-letter tickers are valid!');
                }
            } while (!ticker || ticker.length !== 4);

            activeCharts.current = ticker.toUpperCase();

            tradingGameMainPage(next, tgAccount);
        }, () => tradingGameMainPage(next, tgAccount))
    } catch (error) {
        next(error);
    }
}

async function buttonGroup(options) {
    const allButtons = [];

    createAndAppend('div', (div) => {
        options.forEach(async (option) => {
            const btnPromise = await button(option[0], () => {
                const btns = div.getElementsByTagName('button');

                for (let i = 0; i < btns.length; i++) {
                    btns[i].setAttribute('disabled', true);
                }

                option[1]();
            }, div);

            allButtons.push(btnPromise);
        });
    })

    return Promise.all(allButtons);
}

async function configureChart(next, tgAccount) {
    try {
        const oldConfig = { ...activeCharts };

        beginForm('Chart configuration', () => {
            buttonGroup([
                ['Timeframe', () => timeFrameConfig(next, tgAccount)],
                ['Indicators', () => indicatorsConfig(next, tgAccount)],
            ]);
        }, () => {
            activeCharts = oldConfig;
            tradingGameMainPage(next, tgAccount);
        })
    } catch (error) {
        next(error);
    }
}

async function indicatorsConfig(next, tgAccount) {
    try {
        subTitle('Your indicators so far:')
        table({
            columns: ['name', 'actions'],
            columnLabels: ['Name', 'Actions'],
            rows: activeCharts.globalConfig.indicators.map((indicator) => {
                return {
                    name: indicator.name,
                    actions: [
                        {
                            actionName: 'Remove',
                            handler: () => {
                                activeCharts.globalConfig.indicators = activeCharts.globalConfig.indicators.filter(i => i !== indicator);
                            },
                        }
                    ],
                };
            }),
            cells: [
                (i, td) => { td.innerHTML = i },
                (actions, td) => {
                    actions.forEach((action) => {
                        button(action.actionName, action.handler, td);
                    });
                }
            ],
        });

        button('Add indicator', () => addIndicator(next, tgAccount));
    } catch (error) {
        next(error);
    }
}

function addIndicator(next, tgAccount) {
    try {
        subTitle('Indicator settings')
        write('Please select the indicator you would like to add:');

        const indicatorConfigs = {
            'sma': () => smaConfig(next, tgAccount),
            'ema': () => emaConfig(next, tgAccount),
            'macd': () => macdConfig(next, tgAccount),
        };
        select([
            { name: '', value: '' },
            { name: 'Simple Moving Average', value: 'sma' },
            { name: 'Exponential Moving Average', value: 'ema' },
            { name: 'Moving Average Convergence/Divergence (MACD)', value: 'macd' },
        ], (value) => {
            if (value && value.length) {
                indicatorConfigs[value]();
            }
        });
    } catch (error) {
        next(error);
    }
}

function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toRGB({ hue, saturation, lightness }) {
    return hslToHex(hue, saturation, lightness);
}

async function smaConfig(next, tgAccount) {
    return maConfig('Simple Moving Average', 'SMA', (period) => (ticks, index, series) => {
        const avg = smaCalc(ticks, index, period);

        if (avg) {
            series[0].data.push({
                time: ticks(0).time,
                value: avg,
            });
        }
    }, next, tgAccount);
}

async function emaConfig(next, tgAccount) {
    return await maConfig('Exponential Moving Average', 'EMA', (period) => {
        const Sm = (2 / (period + 1));

        return (ticks, index, series) => {
            if (index === (period - 1)) {
                const avg = smaCalc(ticks, index, period);

                series[0].data.push({
                    time: ticks(0).time,
                    value: avg,
                });
            } else if (index >= period) {
                const previous = series[0].data[series[0].data.length - 1].value;
                const eavg = (ticks(0).value - previous) * Sm + previous;

                series[0].data.push({
                    time: ticks(0).time,
                    value: eavg,
                });
            }
        }
    }, next, tgAccount);
}

function lastOf(arr) {
    return arr[arr.length - 1];
}

function ticksFunc(arr) {
    return (n) => {
        const actual = arr.length - 1 - n;

        if (actual < 0) {
            return null;
        }

        return arr[actual];
    };
}

async function macdConfig(next, tgAccount) {
    try {
        beginForm('Moving Average Convergence/Divergence', async () => {
            write('Fast EMA Period:')
            let fperiod = await read('12', 'number');

            if (!fperiod || !fperiod.length) {
                fperiod = 12;
            } else {
                fperiod = parseInt(fperiod, 10);
            }

            write('Slow EMA Period:')
            let speriod = await read('26', 'number');

            if (!speriod || !speriod.length) {
                speriod = 26;
            } else {
                speriod = parseInt(speriod, 10);
            }

            write('Signal line EMA Period:')
            let mperiod = await read('9', 'number');

            if (!mperiod || !mperiod.length) {
                mperiod = 9;
            } else {
                mperiod = parseInt(mperiod, 10);
            }

            subTitle('Colors')
            subTitle('MACD line color:')
            const macdColor = await colorPicker();

            subTitle('Signal line color:')
            const signalColor = await colorPicker();

            subTitle('Histogram upper bar ascending color:')
            write('These are the bars <strong>above</strong> the Zero baseline which have a <strong>higher</strong> value than the previous bar.')
            const histoUpperAscendingColor = await colorPicker({ hue: 122, saturation: 50, lightness: 28 });

            subTitle('Histogram upper bar descending color:')
            write('These are the bars <strong>above</strong> the Zero baseline which have a <strong>lower</strong> value than the previous bar.')
            const histoUpperDescendingColor = await colorPicker({ hue: 122, saturation: 50, lightness: 58 });

            subTitle('Histogram lower bar ascending color:')
            write('These are the bars <strong>below</strong> the Zero baseline which have a <strong>higher</strong> value than the previous bar.')
            const histoLowerAscendingColor = await colorPicker({ hue: 360, saturation: 50, lightness: 70 });

            subTitle('Histogram lower bar descending color:')
            write('These are the bars <strong>below</strong> the Zero baseline which have a <strong>lower</strong> value than the previous bar.')
            const histoLowerDescendingColor = await colorPicker({ hue: 360, saturation: 50, lightness: 39 });

            const fEmas = [];
            const sEmas = [];
            const macds = [];
            const signals = [];
            let lastBar = 0;

            const lCalcSma = (ticks, period) => {
                let sma = 0;

                for (let i = 0; i < period; i++) {
                    const t = ticks(i);
                    let value = t.value || t;
                    sma += value;
                }

                sma = sma / period;

                return sma;
            };

            const calcEma = (ticks, period, data) => {
                const Sm = (2 / (period + 1));
                const t = ticks(0);
                const price = t.value || t;

                return (price - data[data.length - 1]) * Sm + data[data.length - 1];
            };

            const calculate = (ticks, index, series) => {
                const currentTick = ticks(0);
                if (index === (fperiod - 1)) {
                    fEmas.push(lCalcSma(ticks, fperiod));
                }

                if (index === (speriod - 1)) {
                    sEmas.push(lCalcSma(ticks, speriod));
                }

                if (index >= fperiod) {
                    fEmas.push(calcEma(ticks, fperiod, fEmas));
                }

                if (index >= speriod) {
                    sEmas.push(calcEma(ticks, speriod, sEmas));
                }

                if (fEmas.length && sEmas.length) {
                    const macdValue = lastOf(fEmas) - lastOf(sEmas);
                    macds.push(macdValue);

                    series[0].data.push({
                        time: currentTick.time,
                        value: macdValue,
                    });
                }

                if (macds.length === mperiod) {
                    const signalValue = lCalcSma(ticksFunc(macds), mperiod);
                    signals.push(signalValue);

                    series[1].data.push({
                        time: currentTick.time,
                        value: signalValue,
                    });
                }

                if (macds.length > mperiod) {
                    const signalValue = calcEma(ticksFunc(macds), mperiod, signals);
                    signals.push(signalValue);

                    series[1].data.push({
                        time: currentTick.time,
                        value: signalValue,
                    });
                }

                if (signals.length) {
                    const barValue = lastOf(macds) - lastOf(signals);
                    const bar = {
                        time: currentTick.time,
                        value: barValue,
                        color: '#ffffff',
                    };

                    if (barValue > 0) {
                        if (barValue >= lastBar) {
                            bar.color = histoUpperAscendingColor;
                        } else {
                            bar.color = histoUpperDescendingColor;
                        }
                    } else if (barValue < 0) {
                        if (barValue >= lastBar) {
                            bar.color = histoLowerAscendingColor;
                        } else {
                            bar.color = histoLowerDescendingColor;
                        }
                    }

                    lastBar = barValue;

                    bar.color = toRGB(bar.color);

                    series[2].data.push(bar);
                }
            };

            const scaleMargins = {
                top: 0.6,
                bottom: 0,
            };

            activeCharts.globalConfig.indicators.push({
                name: 'MACD',
                charts: [
                    {
                        type: 'line',
                        priceScale: 'macdScale',
                        customOptions: {
                            lineWidth: 1,
                            color: toRGB(macdColor),
                            scaleMargins,
                        },
                    },
                    {
                        type: 'line',
                        priceScale: 'macdScale',
                        customOptions: {
                            lineWidth: 1,
                            color: toRGB(signalColor),
                            scaleMargins,
                        },
                    },
                    {
                        type: 'histogram',
                        priceScale: 'macdScale',
                        customOptions: {
                            scaleMargins,
                        },
                    },
                ],
                calculate,
            });

            tradingGameMainPage(next, tgAccount);
        }, () => tradingGameMainPage(next, tgAccount));
    } catch (error) {
        next(error);
    }
}

async function maConfig(tableName, chartName, calculate, next, tgAccount) {
    try {
        beginForm(tableName, async () => {
            write('Period:')
            const period = await read('Period', 'number');
            write('Choose a line color:');
            const color = await colorPicker();
            write('Line width:');
            let lineWidth = await read('1', 'number');

            activeCharts.globalConfig.indicators.push(
                movingAverage(chartName, period, color, calculate(parseInt(period, 10)), lineWidth),
            );

            tradingGameMainPage(next, tgAccount);
        }, () => addIndicator(next, tgAccount));
    } catch (error) {
        next(error);
    }
}

function movingAverage(name, period, color, calculate, lineWidth) {
    return {
        name: `${name} (${period})`,
        charts: [{
            priceScale: 'right',
            type: 'line',
            customOptions: {
                color: toRGB(color),
                lineWidth: lineWidth || 1,
            },
        }],
        calculate,
    };
}

function smaCalc(ticks, index, period) {
    if (index < (period - 1)) {
        return null;
    }

    let avg = 0;
    let count = 0;

    for (let j = 0; j < period; j++) {
        const tick = ticks(j);

        if (tick) {
            avg += tick.value;
            count += 1;
        }
    }

    avg = avg / count;

    return avg;
}

function colorPicker(initial) {
    return new Promise((resolve, reject) => {
        let color = initial || {
            hue: 180,
            saturation: 50,
            lightness: 50,
        };

        createAndAppend('div', (div) => {
            div.style.width = '100%';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-around';

            let colorSquare;

            const changeColor = (values) => {
                color = {
                    ...color,
                    ...values,
                };

                colorSquare.style.backgroundColor = `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`;
            };

            createAndAppend('div', (leftPanel) => {
                leftPanel.style.display = 'flex';
                leftPanel.style.flexDirection = 'column';
                leftPanel.style.justifyContent = 'center';
                leftPanel.style.alignItems = 'center';
                range('HUE', '{{ value }}', 0, 360, color.hue, (value) => {
                    changeColor({ hue: parseInt(value, 10) });
                }, leftPanel);
                range('SATURATION', '{{ value }}%', 0, 100, color.saturation, (value) => {
                    changeColor({ saturation: parseInt(value, 10) });
                }, leftPanel);
                range('LIGHTNESS', '{{ value }}%', 0, 100, color.lightness, (value) => {
                    changeColor({ lightness: parseInt(value, 10) });
                }, leftPanel);
            }, div);

            createAndAppend('div', (rightPanel) => {
                rightPanel.style.display = 'flex';
                rightPanel.style.flexDirection = 'column';
                rightPanel.style.justifyContent = 'center';
                rightPanel.style.alignItems = 'center';

                createAndAppend('div', (square) => {
                    colorSquare = square;
                    square.style.width = '400px';
                    square.style.height = '400px';
                    square.style.border = '10px solid black';
                    square.style.backgroundColor = `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`;
                }, rightPanel);
            }, div);
        });

        button('Done', () => resolve(color));
    });
}

function range(label, feedbackTemplate, min, max, initial, onChange, parent) {
    createAndAppend('div', (div) => {
        write(label, div);
        let feedback;
        createAndAppend('input', (e) => {
            e.setAttribute('type', 'range');
            e.setAttribute('min', min);
            e.setAttribute('max', max);

            e.value = initial;

            e.addEventListener('input', () => {
                feedback.innerHTML = feedbackTemplate.replace('{{ value }}', e.value);
                onChange(e.value);
            });
        }, div);

        feedback = createAndAppend('p', () => { }, div);

        feedback.innerHTML = feedbackTemplate.replace('{{ value }}', initial);

    }, parent);
}

/**
 * Displays a table.
 *
 * Config: {
 * columns: string[],
 * columnLabels: string[],
 * rows: any[],
 * emptyMessage?: string,
 * cells: (object | array) of functions
 * }
 */
function table(config) {
    createAndAppend('table', (table) => {
        createAndAppend('thead', (thead) => {
            createAndAppend('tr', (tr) => {
                config.columnLabels.forEach((label) => {
                    createAndAppend('th', (th) => {
                        th.innerHTML = label;
                    }, tr);
                });
            }, thead)
        }, table)

        createAndAppend('tbody', (tbody) => {
            if (!config.rows.length && config.emptyMessage) {
                createAndAppend('tr', (tr) => {
                    createAndAppend('td', (td) => {
                        td.setAttribute('colspan', config.columns.length);
                        td.innerHTML = config.emptyMessage;
                    }, tr);
                }, tbody);
            }

            config.rows.forEach((row) => {
                createAndAppend('tr', (tr) => {
                    config.columns.forEach((column, index) => {
                        createAndAppend('td', (td) => {
                            const cellData = row[column];

                            if (Array.isArray(config.cells)) {
                                config.cells[index](cellData, td, row);
                            } else {
                                if (config.cells[column]) {
                                    config.cells[column](cellData, td, row);
                                } else {
                                    td.innerHTML = row[column];
                                }
                            }
                        }, tr);
                    });
                }, tbody);
            });
        }, table)
    })
}

async function timeFrameConfig(next, tgAccount) {
    try {
        const oneDay = 86400000;
        const fiveYears = oneDay * 365 * 5;
        const selectTimeRange = (maxRange, granularity) => async () => {
            // const range = await dateRangeSlider({
            //     min: tgAccount.currentTime - maxRange,
            //     max: tgAccount.currentTime,
            //     maxRange,
            // });

            const range = {
                from: tgAccount.currentTime - maxRange,
            };

            activeCharts.globalConfig.timeRange = range;
            activeCharts.globalConfig.timeRange.granularity = granularity;

            tradingGameMainPage(next, tgAccount);
        };

        write('Select a timeframe')
        await buttonGroup([
            ['1 Minute', selectTimeRange(oneDay * 6, 'M1')],
            ['15 Minutes', selectTimeRange(oneDay * 30, 'M15')],
            ['1 Hour', selectTimeRange(oneDay * 120, 'H1')],
            ['Daily', selectTimeRange(fiveYears, 'D')],
        ]);
    } catch (error) {
        next(error);
    }
}

async function dateRangeSlider({ min, max, maxRange }) {
    return new Promise((resolve, reject) => {
        const bailOut = (event) => {
            if (event.key === 'Escape') {
                document.removeEventListener('keyUp', bailOut);
                reject('startOver');
            }
        };

        document.addEventListener('keyup', bailOut);

        let ball1Selected = false;
        let ball2Selected = false;

        let ball1;
        let ball2;

        let from = min;
        let to = max;

        let ball1X = 0;
        let ball2X = 0;

        let fromLabel;
        let toLabel;

        let maxRangeInPixels = 0;

        const elt = createAndAppend('div', (e) => {
            e.style.position = 'relative';
            e.style.width = '100%';
            e.style.height = '5px';
            e.style.backgroundColor = '#363636';
            e.style.userSelect = 'none';

            createAndAppend('h3', (span) => {
                fromLabel = span;
                fromLabel.innerHTML = `From: ${min}`
                span.style.paddingRight = '20px';
                span.style.paddingTop = '30px';
                span.style.userSelect = 'none';
            }, e);

            createAndAppend('h3', (span) => {
                toLabel = span;
                toLabel.innerHTML = `To: ${max}`
                span.style.paddingRight = '20px';
                span.style.userSelect = 'none';
            }, e);

            button('Done', () => {
                document.removeEventListener('keyUp', bailOut);

                resolve({
                    to,
                    from,
                });
            }, e);

            createAndAppend('div', (ball) => {
                ball1 = ball;
                ball.style.width = '20px';
                ball.style.height = '20px';
                ball.style.border = '1px solid black';
                ball.style.borderWidth = '1px';
                ball.style.borderRadius = '50%';
                ball.style.backgroundColor = '#0076d1';
                ball.style.position = 'absolute';
                ball.style.right = '0';
                ball.style.top = '-8px';

                ball.onmousedown = (event) => {
                    ball1Selected = true;
                    ball2Selected = false;
                };
            }, e);

            createAndAppend('div', (ball) => {
                ball2 = ball;
                ball.style.width = '20px';
                ball.style.height = '20px';
                ball.style.border = '1px solid black';
                ball.style.borderWidth = '1px';
                ball.style.borderRadius = '50%';
                ball.style.backgroundColor = '#0076d1';
                ball.style.position = 'absolute';
                ball.style.left = '0';
                ball.style.top = '-8px';

                ball.onmousedown = (event) => {
                    ball1Selected = false;
                    ball2Selected = true;
                };
            }, e);

            document.onmouseup = () => {
                ball1Selected = false;
                ball2Selected = false;
            };

            document.onmousemove = (event) => {
                const bounds = e.getBoundingClientRect();
                const left = (event.clientX - bounds.x);

                if (ball1Selected && ball1) {
                    // if (from >= min && (to <= max)) {
                    if (event.clientX >= bounds.left && (event.clientX <= (bounds.left + bounds.width))) {
                        ball1X = left;
                        ball1.style.left = `${left}px`;

                        const diff = Math.abs(ball1X - ball2X);
                        const maxDiff = diff - maxRangeInPixels;
                        const factor = (ball1X - ball2X) / diff;
                        const off = maxDiff * factor;

                        if (diff > maxRangeInPixels) {
                            ball2X += off;
                            ball2.style.left = `${ball2X}px`;
                        }
                    }
                } else if (ball2Selected && ball2) {
                    // if (from >= min && (to <= max)) {
                    if (event.clientX >= bounds.left && (event.clientX <= (bounds.left + bounds.width))) {
                        ball2X = left;
                        ball2.style.left = `${left}px`;

                        const diff = Math.abs(ball1X - ball2X);
                        const maxDiff = diff - maxRangeInPixels;
                        const factor = (ball2X - ball1X) / diff;
                        const off = maxDiff * factor;

                        if (diff > maxRangeInPixels) {
                            ball1X += off;
                            ball1.style.left = `${ball1X}px`;
                        }
                    }
                }

                const ball1Rel = ball1X / bounds.width;
                const ball2Rel = ball2X / bounds.width;

                if (ball1X > ball2X) {
                    to = Math.floor(ball1Rel * (max - min) + min);
                    from = Math.floor(ball2Rel * (max - min) + min);
                } else {
                    to = Math.floor(ball2Rel * (max - min) + min);
                    from = Math.floor(ball1Rel * (max - min) + min);
                }

                fromLabel.innerHTML = `From: ${new Date(from).toUTCString()}`;
                toLabel.innerHTML = `To: ${new Date(to).toUTCString()}`;
            };
        });

        ball1X = ball1.getBoundingClientRect().left;
        ball2X = ball2.getBoundingClientRect().left;

        maxRangeInPixels = (maxRange / (max - min)) * elt.getBoundingClientRect().width;
    });
}

function select(options, onSelect, parent) {
    return createAndAppend('select', (e) => {
        options.forEach(option => {
            createAndAppend('option', (opt) => {
                opt.setAttribute('value', option.value || option.name);
                if (option.selected) {
                    opt.setAttribute('selected', option.selected);
                }
                opt.innerHTML = option.name;
            }, e)
        });

        e.addEventListener('change', (event) => {
            if (onSelect) {
                onSelect(event.target.value);
            }
        });
    }, parent);
}

async function tgChart(ticker, config, parent) {
    let width = 800;//document.body.clientWidth;
    let height = 400;//document.body.clientHeight - bounds.height;

    if (parent) {
        const rect = parent.getBoundingClientRect();

        width = rect.width;
        height = rect.height;
    }

    lwChart({
        width,
        height,
        layout: {
            backgroundColor: '#10151c',
            textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
            vertLines: {
                color: 'rgba(197, 203, 206, 0.2)',
            },
            horzLines: {
                color: 'rgba(197, 203, 206, 0.2)',
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
            scaleMargins: {
                top: 0.05,
                bottom: 0.25,
            },
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
    }, async (chart, container) => {
        container.style.position = 'relative';

        // const series = chart.addAreaSeries({
        //     topColor: '#62BD4899',
        //     bottomColor: '#62BD4800',
        //     lineColor: '#62BD48FF',
        //     lineWidth: 3
        // });

        const series = chart.addCandlestickSeries();

        const from = config.timeRange.from;
        const to = config.timeRange.to;
        const granularity = config.timeRange.granularity;

        const response = await apiGet(`/api/v1/trading-game/products/${ticker}/candles`, { from, to, granularity });

        const data = response.data.candles.map((candle) => {
            // return {
            //     time: candle.closeTimeStamp,
            //     value: candle.close,
            // };

            return {
                time: candle.closeTimeStamp,
                open: candle.open,
                close: candle.close,
                high: candle.high,
                low: candle.low,
                value: candle.close,
            }
        });

        activeCharts.globalConfig.indicators.forEach((indicator) => {
            const seriesFuncs = {
                'line': 'addLineSeries',
                'area': 'addAreaSeries',
                'histogram': 'addHistogramSeries',
            };

            const indicatorSeries = indicator.charts.map(indicatorChart => {
                const seriesOptions = {
                    priceScaleId: indicatorChart.priceScale || 'right',
                    title: indicator.name,
                    ...(indicatorChart.customOptions || {}),
                };

                return {
                    series: chart[seriesFuncs[indicatorChart.type]](seriesOptions),
                    data: [],
                };
            });

            data.forEach((_, index) => {
                const ticks = (n) => {
                    const actual = index - n;

                    if (actual < 0) {
                        return null;
                    }

                    return data[actual];
                };

                indicator.calculate(ticks, index, indicatorSeries);
            });

            indicatorSeries.forEach((plotting) => {
                plotting.series.setData(plotting.data);
            });
        });

        series.setData(data);

        if (activeCharts[ticker]) {
            const markers = activeCharts[ticker].markers;

            if (markers) {
                series.setMarkers(markers);
            }
        }

        let toolTip = document.createElement('div');
        toolTip.className = 'three-line-legend';
        container.appendChild(toolTip);
        toolTip.style.position = 'absolute';
        toolTip.style.display = 'block';
        toolTip.style.left = 3 + 'px';
        toolTip.style.top = 3 + 'px';
        toolTip.style.zIndex = '1';

        const tickerFontSize = config ? (config.tickerFontSize || '24px') : '24px';

        function setLastBarText() {
            let dateStr = data[data.length - 1].time.year + ' - ' + data[data.length - 1].time.month + ' - ' + data[data.length - 1].time.day;

            if (!data[data.length - 1].time.year) {
                dateStr = new Date(data[data.length - 1].time * 1000).toUTCString();
            }
            toolTip.innerHTML = `<div style="font-size: ${tickerFontSize}; margin: 4px 0px; color: white"> ${ticker}</div>
            <div style="font-size: 22px; margin: 4px 0px; color: white">${data[data.length - 1].value}</div>
            <div style="color: white">${dateStr}</div>`;
        }

        setLastBarText();

        chart.subscribeCrosshairMove(function (param) {
            if (param === undefined || param.time === undefined || param.point.x < 0 || param.point.x > width || param.point.y < 0 || param.point.y > height) {
                setLastBarText();
            } else {
                dateStr = param.time.year + ' - ' + param.time.month + ' - ' + param.time.day;

                if (!param.time.year) {
                    dateStr = new Date(param.time * 1000).toUTCString();
                }
                var price = param.seriesPrices.get(series);
                toolTip.innerHTML = '<div style="font-size: 24px; margin: 4px 0px; color: white"> ' + ticker + '</div>' + '<div style="font-size: 22px; margin: 4px 0px; color: white">' + (Math.round(price.close * 100) / 100).toFixed(2) + '</div>' + '<div style="color: white">' + dateStr + '</div>';
            }
        })
    }, parent);
}

async function apiGet(endpoint, params) {
    const token = localStorage.getItem('token');

    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return axios.get(`${url}${endpoint}`, { headers, params });
}

async function registration(next) {
    try {
        await beginForm('Registration', async () => {
            pageImg('/assets/registration.svg')
            write('Let\'s begin! We need an email and a password. And that\'s it!')
            write('Please enter your email, first:')
            const email = await read('Email')

            let password;
            let confirmation;
            let passwordError = null;

            do {
                passwordError = null;
                write('Now enter a good password:')
                password = await passwordField()
                write('Please confirm your password by typing it again:')
                confirmation = await passwordField('Confirm your password')
                if (password !== confirmation) {
                    passwordError = 'The passwords didn\'t match!'
                }

                if (passwordError) {
                    tellError(passwordError)
                }
            } while (passwordError);

            write('Now we wait just a second...')
            const response = await apiRegister({ email, password }, next)

            if (response) {
                login(next)
            }
        }, () => firstPageOptions(next));
    } catch (error) {
        next(error);
    }
}

function tellError(txt) {
    const color = getColor();
    setColor('red');
    p(txt);
    setColor(color);
}

function title(txt) {
    h1(txt)
}

function subTitle(txt) {
    h2(txt)
}

function pageImg(src) {
    createAndAppend('div', (div) => {
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.paddingTop = '50px';
        div.style.paddingBottom = '50px';
        createAndAppend('img', (e) => {
            e.setAttribute('src', src);
            e.style.width = '60%';
        }, div)
    });
}

function img(src, width) {
    createAndAppend('img', (e) => {
        e.setAttribute('src', src);
        e.style.width = width;
    });
}

function write(txt, parent) {
    p(txt, parent)
}

function setColor(color) {
    globalStyles.color = color;
}

function getColor() {
    return globalStyles.color;
}

async function apiRegister(body, onError) {
    return await apiPost(`/api/v1/registration/user`, body, onError);
}

async function apiLogin(body, onError) {
    return await apiPost(`/api/v1/login`, body, onError);
}

async function apiPost(endpoint, body, onError) {
    try {
        const token = localStorage.getItem('token');

        const headers = {};

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return await axios.post(`${url}${endpoint}`, body, { headers });
    } catch (error) {
        if (!onError) {
            throw error;
        }
        onError(error)
    }
}

function p(txt, parent) {
    txtTag('p', txt, parent)
}

function lwChart(options, callback, parent) {
    createAndAppend('div', (e) => {
        chart = LightweightCharts.createChart(e, options);
        callback(chart, e);
    }, parent);
}

function jsonCode(data) {
    let txt = JSON.stringify(data, null, 4);

    if (txt === '{}') {
        txt = data;
    }

    preCode(txt);
}

function preCode(txt) {
    createAndAppend('pre', (e) => {
        createAndAppend('code', (codeNode) => {
            codeNode.innerHTML = txt;
        }, e)
    });
}

async function read(placeholder, type = 'text', rows = 0) {
    return new Promise((resolve, reject) => {
        if (!rows) {
            createAndAppend('input', (e) => {
                e.setAttribute('placeholder', placeholder);
                e.setAttribute('type', type);
                e.style.width = '100%';
                e.onkeyup = (event) => {
                    if (event.key === 'Enter') {
                        e.setAttribute('disabled', true);
                        resolve(e.value);
                    } else if (event.key === 'Escape') {
                        reject('startOver');
                    }
                };
            });
        } else {
            const ta = createAndAppend('textarea', (e) => {
                e.setAttribute('placeholder', placeholder);
                e.setAttribute('rows', rows);
                e.style.width = '100%';
                e.onkeyup = (event) => {
                    if (event.key === 'Escape') {
                        reject('startOver');
                    }
                };
            });

            button('Send', () => {
                ta.setAttribute('disabled', true);
                resolve(ta.value);
            });

            ta.focus();
        }
    });
}

async function readLarge(placeholder, rows) {
    return await read(placeholder, null, rows);
}

async function passwordField(placeholder = 'Password') {
    return await read(placeholder, 'password')
}

async function beginForm(name, mainProcedure, goBack) {
    const startPoint = async () => {
        clearScreen();
        title(name)
        write('If you make a mistake, press <code>Esc</code> to start over.');

        if (goBack) {
            button('Cancel', () => goBack());
            write('');
        }

        try {
            await mainProcedure();
        } catch (error) {
            if (error === 'startOver') {
                startPoint();
            } else {
                throw error;
            }
        }
    };

    await startPoint();
}

function clearScreen() {
    document.body.innerHTML = '';
    document.onmouseup = () => { };
    document.onmousedown = () => { };
    document.onmousemove = () => { };
}

function h1(txt) {
    txtTag('h1', txt);
}

function h2(txt) {
    txtTag('h2', txt);
}

function button(label, onClick, parent) {
    return new Promise((resolve, reject) => {
        createAndAppend('button', (e) => {
            e.innerHTML = label;
            e.onclick = async () => {
                try {
                    if (onClick) {
                        const result = await onClick();
                        resolve(result);
                    }
                } catch (error) {
                    reject(error);
                }

                e.setAttribute('disabled', true);
            };
        }, parent || document.body);
    });
}

function txtTag(tag, txt, parent) {
    createAndAppend(tag, (e) => {
        e.innerHTML = txt;
    }, parent);
}

function createAndAppend(tag, callback, parent = null) {
    let container = parent || document.body;
    const e = document.createElement(tag);
    Object.keys(globalStyles)
        .forEach((styleProp) => {
            e.style[styleProp] = globalStyles[styleProp];
        });

    callback(e);

    container.appendChild(e);
    e.focus();

    return e;
}