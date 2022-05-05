import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as querystring from 'querystring';
import { CookieJar } from 'tough-cookie';

wrapper(axios);

export class RheaLanaClient {
    jar = new CookieJar();
    sessionId = null; // string
    consignerId = null; // string
    batchId = null; // string

    /**
     * @param {string} consignerId
     * @param {string} password
     * @param {string?} string
     */
    async signIn(consignerId, password, batchId) {
        await axios.request({
            url: 'https://fayetteville.rhealana.com/wixenroll1.asp?expired=1',
            jar: this.jar,
        });
        const response = await axios.request({
            method: 'POST',
            url: 'https://fayetteville.rhealana.com/wixcheckin31.asp',
            data: querystring.encode({
                ID: consignerId,
                Passwork: password,
                serverName: 'fayetteville.rhealana.com',
            }),
            jar: this.jar,
        });
        const match = this.jar
            .getCookieStringSync('https://fayetteville.rhealana.com/')
            .match(/batchsessioncookie=(\d+)/);
        if (!match) {
            throw new Error('login failed');
        }
        this.sessionId = match[1];
        this.consignerId = consignerId;
        this.batchId = batchId;
        // todo: determine batch id automatically?
    }

    /**
     * @param {Item} item
     */
    async createItem(item) {
        if (!this.consignerId) {
            throw new Error('not logged in');
        }
        const response = await axios.request({
            url: 'https://fayetteville.rhealana.com/wixitemadd.asp',
            params: {
                consigncode: this.consignerId,
                batchnum: this.batchId,
                description: item.desc,
                size: item.size,
                price: item.price,
                halfmark: 'No Dot',
                batchsessionrequest: this.sessionId,
            },
            jar: this.jar,
        });
        const match = response.data.match(/LAST ITEM NOT ENTERED: ?([^<]*)/i);
        if (match) {
            console.error(response.data);
            throw new Error(`failed to create item: ${match[1]}`);
        }
    };

    /**
     * @param {string} itemId
     * @param {Item} item
     */
    async updateItem(itemId, item) {
        if (!this.consignerId) {
            throw new Error('not logged in');
        }
        await axios.request({
            url: 'https://fayetteville.rhealana.com/wixitemeditsave.asp',
            params: {
                consigncode: this.consignerId,
                inventnum: this.batchId,
                itemcode: itemId,
                description: item.desc,
                basesize: item.size,
                addprice: item.price,
                halfmark: 'No Dot',
                page: '',
                batchsessionrequest: this.sessionId,
            },
            jar: this.jar,
        });
    };

    /** private */
    indexToItemId(index) {
        if (!this.consignerId) {
            throw new Error('not logged in');
        }
        const key = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const msb = Math.floor(index / key.length);
        const lsb = index % key.length;
        return `${this.consignerId}${key[msb]}${key[lsb]}`;
    };
}
