import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { parse } from 'csv-parse';
import { readFileSync } from 'fs';
import { CookieJar } from 'tough-cookie';
import * as querystring from 'querystring';

wrapper(axios);

const loadCsv = async path => {
    const buffer = readFileSync(path);
    const data = await new Promise((resolve, reject) => parse(buffer, (err, records) => err ? reject(err) : resolve(records)));

    const header = data.shift();
    const descIndex = header.findIndex(x => /description/i.test(x));
    const priceIndex = header.findIndex(x => /price/i.test(x));
    const sizeIndex = header.findIndex(x => /size/i.test(x));
    if ([descIndex, priceIndex, sizeIndex].find(x => x === undefined)) {
        throw new Error('description, price, and size columns are required');
    }

    const results = [];
    for (const row of data) {
        const desc = row[descIndex].replace(/[\u2018\u2019]/g, `'`);
        if (/[^a-z0-9 ]/.test(desc)) {
            throw new Error(`description has invalid text: ${desc}`);
        }
        const price = row[priceIndex];
        const size = row[sizeIndex];
        results.push({ desc, price, size });
    }
    return results;
};

const signIn = async (consignerId, password) => {
    const jar = new CookieJar();
    await axios.request({
        url: 'https://fayetteville.rhealana.com/wixenroll1.asp?expired=1',
        jar,
    });
    const response = await axios.request({
        method: 'POST',
        url: 'https://fayetteville.rhealana.com/wixcheckin31.asp',
        data: querystring.encode({
            ID: consignerId,
            Passwork: password,
            serverName: 'fayetteville.rhealana.com',
        }),
        jar,
    });
    const match = jar
        .getCookieStringSync('https://fayetteville.rhealana.com/')
        .match(/batchsessioncookie=(\d+)/);
    if (!match) {
        throw new Error('login failed');
    }
    return { jar, sessionId: match[1] };
};

const createItem = async (consignerId, batchId, jar, sessionId, item) => {
    const response = await axios.request({
        url: 'https://fayetteville.rhealana.com/wixitemadd.asp',
        params: {
            consigncode: consignerId,
            batchnum: batchId, 
            description: item.desc,
            size: item.size,
            price: item.price,
            halfmark: 'No Dot',
            batchsessionrequest: sessionId,
        },
        jar,
    });
    const match = response.data.match(/LAST ITEM NOT ENTERED: ?([^<]*)/i);
    if (match) {
        console.error(response.data);
        throw new Error(`a failure occurred: ${match[1]}`);
    }
};

const updateItem = async (consignerId, batchId, itemId, jar, sessionId, item) => {
    await axios.request({
        url: 'https://fayetteville.rhealana.com/wixitemeditsave.asp',
        params: {
            consigncode: consignerId,
            inventnum: batchId,
            itemcode: itemId,
            description: item.desc,
            basesize: item.size,
            addprice: item.price,
            halfmark: 'No Dot',
            page: '',
            batchsessionrequest: sessionId,
        },
        jar,
    });
};

const indexToItemId = (consignerId, index) => {
    const key = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const msb = Math.floor(index / key.length);
    const lsb = index % key.length;
    return `${consignerId}${key[msb]}${key[lsb]}`;
};

(async () => {
    const [consignerId, password, batchId, path, offset] = process.argv.slice(2);
    if (!consignerId || !password || !batchId || !path) {
        throw new Error('consignerId, password, batchId, and path are required');
    }
    let data = await loadCsv(path);
    if (offset) {
        data = data.slice(Number(offset));
    }
    const { jar, sessionId } = await signIn(consignerId, password);
    for (const [i, item] of data.entries()) {
        console.log(`uploading item ${i + 1} of ${data.length}...`);
        await createItem(consignerId, batchId, jar, sessionId, item);
    }
    process.exit(0);
})().catch(err => {
    console.error('an unexpected error occurred', err);
    process.exit(1);
});
