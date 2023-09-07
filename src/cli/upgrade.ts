import * as nconf from 'nconf';
import * as chalk from 'chalk';

import * as packageInstall from './package-install';
import { upgradePlugins } from './upgrade-plugins';

import { init as databaseInit } from '../database';
import { configs as metaConfigsInit } from '../meta';
import { run as upgradeRun } from '../upgrade';
import { buildAll as buildAllAssets } from '../meta/build';



interface Step {
    message: string;
    handler: () => Promise<void>;
}

const steps: Record<string, Step> = {
    package: {
        message: 'Updating package.json file with defaults...',
        handler: async () => {
            await Promise.resolve();
            packageInstall.updatePackageFile();
            packageInstall.preserveExtraneousPlugins();
            process.stdout.write(chalk.green('  OK\n'));
        },
    },
    install: {
        message: 'Bringing base dependencies up to date...',
        handler: () => {
            process.stdout.write(chalk.green('  started\n'));
            return new Promise<void>((resolve, reject) => {
                try {
                    packageInstall.installAll();
                    process.stdout.write((chalk.green('  OK\n') as unknown) as string);
                    resolve();
                } catch (error) {
                    const errorMessage = `Error during dependency installation: ${error as string}`;
                    console.error(errorMessage);
                    reject(error);
                }
            });
        },
    },
    plugins: {
        message: 'Checking installed plugins for updates...',
        handler: async () => {
            const initDatabase = databaseInit as () => Promise<void>; // Type assertion
            await initDatabase();
            await upgradePlugins();
        },
    },
    schema: {
        message: 'Updating NodeBB data store schema...',
        handler: async () => {
            const initDatabase = databaseInit as () => Promise<void>; // Type assertion
            await initDatabase();
            await metaConfigsInit.init();
            await upgradeRun();
        },
    },
    build: {
        message: 'Rebuilding assets...',
        handler: async () => {
            await buildAllAssets();
        },
    },
};

async function runSteps(tasks: string[]) {
    try {
        const promises = [];
        for (let i = 0; i < tasks.length; i++) {
            const step = steps[tasks[i]];
            if (step && step.message && step.handler) {
                process.stdout.write(`\n${chalk.bold(`${i + 1}. `)}${chalk.yellow(step.message.toString())}`);
                promises.push(step.handler());
            }
        }
        await Promise.all(promises);

        const message = 'NodeBB Upgrade Complete!';
        const { columns } = process.stdout;
        const spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';

        console.log(`\n\n${spaces}${chalk.green.bold(message.toString())}\n`);

        process.exit();
    } catch (err) {
        if (err instanceof Error) {
            const errorMessage: string = err.stack || 'Unknown error occurred during upgrade';
            console.error(`Error occurred during upgrade: ${errorMessage}`);
        } else {
            console.error('An error occurred during upgrade, but it does not appear to be an instance of Error.');
        }
        throw err;
    }
}
async function runUpgrade(upgrades: boolean | string[], options?: Record<string, boolean>): Promise<void> {
    console.log(chalk.cyan('\nUpdating NodeBB...'));
    options = options || {};
    // disable mongo timeouts during upgrade
    nconf.set('mongo:options:socketTimeoutMS', 0);

    if (upgrades === true) {
        let tasks = Object.keys(steps);
        if (options.package || options.install || options.plugins || options.schema || options.build) {
            tasks = tasks.filter(key => options[key]);
        }
        await runSteps(tasks);
        return;
    }

    const initDatabase = databaseInit as () => Promise<void>;
    await initDatabase();
    await metaConfigsInit.init();
    await upgradeRun(upgrades as string[]);
    process.exit(0);
}
export default runUpgrade;
