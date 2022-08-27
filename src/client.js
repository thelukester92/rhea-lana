import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as querystring from 'querystring';
import { CookieJar } from 'tough-cookie';

wrapper(axios);

export class RheaLanaClient {
    location = 'nwa';

    jar = new CookieJar();
    sessionId = null; // string
    consignerId = null; // string
    batchId = null; // string

    async createBatch({ firstName, lastName, address, city, state, zip, phone, email, password }) {
        throw new Error('not ready yet');

        await axios.request({
            method: 'POST',
            url: `https://${this.location}.rhealana.com/wixsignup1a.asp`,
            jar: this.jar,
            params: {
                first: firstName,
                last: lastName,
                address,
                city,
                state,
                zip,
                hphone: phone,
                wphone: '', // intentionally empty
                email,
                pass1: password,
                pass2: password,
                init: 't59fayi09i', // value from landing page
                method: '70', // value from landing page
                volunteer: '0',
            },
        });

        // 302 -> GET wixsignup1a.asp (with url params of the entire post body)
        // somehow get batchnum and consigner id
        const consignerId = 'XAL';
        const batchId = '';

        await axios.request({
            url: `https://${this.location}.rhealana.com/madmimiconsignor.php`,
            jar: this.jar,
            params: {
                batchnum: batchId,
                rlaborcode: consignerId,
                thisowneremail: 'ashley@rhealana.com',
                thisownerfirst: 'Ashley',
                thisownerlast: 'Shaver',
                subdomain: this.location,
                facebooklink: 'RheaLanasNWA',
                salename: this.location,
                thisconsignoremail: email,
                madmimi: 'DONE',
                thisconsignorfirst: firstName,
                thisconsignorlast: lastName,
            },
        });

        const match = this.jar
            .getCookieStringSync(`https://${this.location}.rhealana.com/`)
            .match(/batchsessioncookie=(\d+)/);
        if (!match) {
            throw new Error('failed to fetch batchsessioncookie');
        }
        this.sessionId = match[1];

        // 302 -> wixtraining701.asp?batchnum=17TN
        // maybe skip /wixtraining702.asp?batchnum=17TN
        // maybe skip /wixtraining703.asp?batchnum=17TN
        // maybe skip /wixtraining704.asp?batchnum=17TN
        // maybe skip https://${this.location}.rhealana.com/wixform1a.asp (?batchNum&batchsessionrequest=this.sessionId)

        await axios.request({
            url: `https://${this.location}.rhealana.com/wixform1a.asp`,
            jar: this.jar,
            params: {
                batchnum: batchId,
                agree: '1',
                batchsessionrequest: this.sessionId,
                donate_default: '0',
                discount_default: '1',
            },
        });
    }

    /**
     * @param {string} consignerId
     * @param {string} password
     * @param {string?} string
     */
    async signIn(consignerId, password, batchId) {
        await axios.request({
            url: `https://${this.location}.rhealana.com/wixenroll1.asp?expired=1`,
            jar: this.jar,
        });
        await axios.request({
            method: 'POST',
            url: `https://${this.location}.rhealana.com/wixcheckin31.asp`,
            data: querystring.encode({
                ID: consignerId,
                Passwork: password,
                serverName: `${this.location}.rhealana.com`,
            }),
            jar: this.jar,
        });
        const match = this.jar
            .getCookieStringSync(`https://${this.location}.rhealana.com/`)
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
            url: `https://${this.location}.rhealana.com/wixitemadd.asp`,
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
            url: `https://${this.location}.rhealana.com/wixitemeditsave.asp`,
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
