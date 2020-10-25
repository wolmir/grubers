const crypto = require('crypto');
const fetch = require('node-fetch');

class User {
    constructor(url) {
        this.token = null;
        this._user = null;

        this.url = url;
    }

    post(url, body, useToken) {
        const headers = { 'Content-Type': 'application/json' };

        if (useToken) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers,
        })
            .then((res) => {
                if (res.ok) {
                    return res;
                } else {
                    return res.json()
                        .then((data) => {
                            throw {
                                status: res.statusText,
                                data
                            };
                        });
                }
            })
            .then(res => res.json());
    }

    put(url, body = {}, useToken = true) {
        const headers = { 'Content-Type': 'application/json' };

        if (useToken) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        return fetch(url, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers,
        })
            .then((res) => {
                if (res.ok) {
                    return res;
                } else {
                    return res.json()
                        .then((data) => {
                            throw {
                                status: res.statusText,
                                data
                            };
                        });
                }
            })
            .then(res => res.json());
    }

    get(url, useToken, params) {
        let tmpUrl = url;
        const headers = { 'Content-Type': 'application/json' };

        if (useToken) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        if (params) {
            tmpUrl = tmpUrl + '?' + Object.keys(params).map((key) => {
                return `${key}=${params[key]}`;
            })
                .join('&');
        }

        return fetch(tmpUrl, {
            method: 'GET',
            headers,
        })
            .then((res) => {
                if (res.ok) {
                    return res;
                } else {
                    return res.json()
                        .then((data) => {
                            throw {
                                status: res.statusText,
                                data
                            };
                        });
                }
            })
            .then(res => res.json());
    }

    fetchCandles(product, params) {
        return this.get(`${this.url}/trading-game/products/${product}/candles`, true, params);
    }

    fetchGames() {
        return this.get(`${this.url}/games`, true);
    }

    createTradingGameAccount() {
        return this.post(`${this.url}/trading-game/accounts`, {}, true);
    }

    createExchangeAccount() {
        return this.post(`${this.url}/exchange/accounts`, {}, true);
    }

    fetchAccount() {
        return this.get(`${this.url}/trading-game/account`, true);
    }

    register(body) {
        return this.post(`${this.url}/registration/user`, body);
    }

    order(body) {
        return this.post(`${this.url}/trading-game/account/orders`, body, true);
    }

    fetchOrders() {
        return this.get(`${this.url}/trading-game/account/orders`, true);
    }

    cancelOrder(id) {
        return this.put(`${this.url}/trading-game/account/orders/${id}/cancel`, {}, true);
    }

    advanceTime(body) {
        return this.post(
            `${this.url}/trading-game/account/time-advances`,
            body,
            true
        )
    }

    deposit(accountId, body) {
        return this.post(
            `${this.url}/exchange/accounts/${accountId}/deposits`,
            body,
            true
        );
    }

    fetchAllAccounts() {
        return this.get(
            `${this.url}/accounts`,
            true,
        );
    }

    exchangeBid(currency, body) {
        return this.post(
            `${this.url}/exchange/${currency}/market/bid`,
            body,
            true,
        );
    }

    clearBid(currency, bidId, body) {
        return this.put(
            `${this.url}/exchange/${currency}/market/bid/${bidId}/clear`,
            body,
            true,
        );
    }

    login(credentials) {
        return this.post(`${this.url}/login`, credentials)
            .then((json) => {
                this.token = json.data.token;
                this._user = json.data.user;

                return json;
            });
    }

    createPassword(txt) {
        const getUtf8Bytes = (str) =>
            new Uint8Array(
                [...unescape(encodeURIComponent(str))].map(c => c.charCodeAt(0))
            );

        const keyBytes = getUtf8Bytes('a secret');
        const hmac = crypto.createHmac('sha256', keyBytes);

        hmac.update(txt);
        return hmac.digest('hex');
    }
}

function beginTest() {
    const user = new User('http://localhost/api/v1');
    const userPassword = user.createPassword('coffee');

    const admin = new User('http://localhost/api/v1');
    const adminPassword = user.createPassword('Telles@210casa');

    admin.login({
        email: 'wolmir.nemitz@gmail.com',
        password: adminPassword,
    })
        .catch((error) => {
            console.log(error);
        })
        .then(() => {
            return user.register({
                email: 'john.doe@host.com',
                password: userPassword
            })
        })
        .then(() => {
            return user.register({
                email: 'john.doe@host.com',
                password: userPassword
            })
        })
        .catch((error) => {
            console.log(error);
        })
        .then(() => {
            return user.login({
                email: 'john.doe@host.com',
                password: userPassword
            });
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.fetchGames();
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.createTradingGameAccount();
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.fetchCandles('SBUX', {
                from: 1000 * 3600 * 24 * 367,
                to: 1000 * 3600 * 24 * 365 * 6,
                granularity: 'H1',
            });
        })
        .catch((error) => {
            console.log(error);
        })
        .then(() => {
            return user.fetchCandles('SBUX', {
                from: 1000 * 3600 * 24 * 367,
                to: 1000 * 3600 * 24 * 368,
                granularity: 'H1',
            });
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.fetchCandles('SBUX', {
                from: 1000 * 3600 * 24 * 365 * 4,
                granularity: 'D',
            });
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.fetchAccount();
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.createExchangeAccount();
        })
        .then((res) => {
            console.log('Exchange Account >> ');
            console.log(JSON.stringify(res, null, 2));
            return res;
        })
        .then((res) => {
            const accountId = res.account._id;
            return admin.deposit(accountId, {
                currency: 'btc',
                amount: 300,
            });
        })
        .then(() => {
            return user.fetchAllAccounts();
        })
        .then((res) => {
            console.log('All Accounts >> ');
            console.log(JSON.stringify(res, null, 2));
            return res;
        })
        .then(() => {
            return user.exchangeBid('btc', {
                bid: 1,
                lots: 300,
            });
        })
        .then((res) => {
            console.log('Exchange bid >> ');
            console.log(JSON.stringify(res, null, 2));
            return res;
        })
        .then((res) => {
            const bidId = res.bid._id;

            return admin.clearBid('btc', bidId, {
                lots: 300,
            });
        })
        .then((res) => {
            console.log('Exchange clear bid >> ');
            console.log(JSON.stringify(res, null, 2));
            return res;
        })
        .then(() => {
            return user.fetchAllAccounts();
        })
        .then((res) => {
            console.log('All accounts after bid clear >> ');
            console.log(JSON.stringify(res, null, 2));
            return res;
        })
        .then(() => {
            return admin.fetchAllAccounts();
        })
        .then((res) => {
            console.log('All admin accounts after bid clear >> ');
            console.log(JSON.stringify(res, null, 2));
            return res;
        })
        .then(() => {
            return user.order({
                order: {
                    ticker: 'SBUX',
                    stopLoss: 347.0,
                    takeProfit: 400.0,
                    type: 'market',
                    operation: 'buy',
                    units: 100,
                },
            });
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.fetchOrders();
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.advanceTime({
                amount: 'M15',
            });
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.order({
                order: {
                    ticker: 'SBUX',
                    stopLoss: 34.0,
                    takeProfit: 400.0,
                    price: 123,
                    type: 'limit',
                    operation: 'buy',
                    units: 100,
                },
            });
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));

            return res.order.id;
        })
        .then((id) => {
            return user.advanceTime({
                amount: 'M15',
            })
                .then((res) => {
                    console.log(JSON.stringify(res, null, 2));

                    return id;
                })
        })
        .then((id) => {
            return user.cancelOrder(id);
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        .then(() => {
            return user.fetchOrders();
        })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
        })
        // .then(() => {
        //     return user.createExchangeAccount();
        // })
        .catch((error) => {
            console.log(error);
        });
}

beginTest();