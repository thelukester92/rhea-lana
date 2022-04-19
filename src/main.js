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
        const [desc, price, size] = [row[descIndex], row[priceIndex], row[sizeIndex]];
        results.push({ desc, price, size });
    }
    return results;
};

const signIn = async (consignerId, password) => {
    const jar = new CookieJar();
    let response = await axios.request({
        url: 'https://fayetteville.rhealana.com/wixenroll1.asp?expired=1',
        jar,
    });
    response = await axios.request({
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

(async () => {
    const [consignerId, password, batchId, path] = process.argv.slice(2);
    if (!consignerId || !password || !batchId || !path) {
        throw new Error('consignerId, password, batchId, and path are required');
    }
    const data = await loadCsv(path);
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
