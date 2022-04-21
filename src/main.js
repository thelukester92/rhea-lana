import { Command } from 'commander';
import { upload } from './commands/upload.js';

(async () => {
    const program = new Command();
    program
        .command('upload')
        .argument('<consignerId>')
        .argument('<password>')
        .argument('<batchId>')
        .argument('<filePath>')
        .option('-n, --offset <offset>', 'number of rows to skip in the file', x => parseInt(x, 10))
        .option('--dry-run')
        .action(upload);
    await program.parseAsync();
    process.exit(0);
})().catch(err => {
    console.error('an unexpected error occurred', err);
    process.exit(1);
});
