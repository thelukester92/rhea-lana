import { parse } from 'csv-parse';
import { readFileSync } from 'fs';

/**
interface Item {
    desc: string;
    price: string;
    size: string;
}
*/

/** @returns Item[] */
export const loadCsv = async path => {
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
    for (const [i, row] of data.entries()) {
        const desc = row[descIndex].replace(/[\u2018\u2019]/g, `'`);
        if (/[^a-z0-9 '-]/i.test(desc)) {
            throw new Error(`description on row ${i + 1} has invalid text: ${desc}`);
        }
        const price = row[priceIndex];
        const size = row[sizeIndex];
        results.push({ desc, price, size });
    }
    return results;
};
