import { RheaLanaClient } from '../client.js';
import { loadCsv } from '../util/csv.js';

export const upload = async (consignerId, password, batchId, filePath, { dryRun, offset }) => {
    let data = await loadCsv(filePath);
    if (dryRun) {
        console.log('===== DRY RUN =====');
    }
    if (offset) {
        data = data.slice(offset);
    }
    const client = new RheaLanaClient();
    if (!dryRun) {
        await client.signIn(consignerId, password, batchId);
    }
    for (const [i, item] of data.entries()) {
        console.log(`uploading item ${i + 1} of ${data.length}...`);
        console.log(`    ${item.desc}, Size ${item.size}, Price $${item.price}`);
        if (!dryRun) {
            await client.createItem(item);
        }
    }
};
