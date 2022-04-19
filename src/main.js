const axios = require('axios');
const fs = require('fs');
const { parse } = require('csv-parse');

const loadCsv = async path => {
    const buffer = fs.readFileSync(path);
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

(async () => {
    const [path] = process.argv.slice(2);
    if (!path) {
        throw new Error('path is required');
    }
    const data = await loadCsv(path);
    console.log(data);
    process.exit(0);
})().catch(err => {
    console.error('an unexpected error occurred', err);
    process.exit(1);
});
