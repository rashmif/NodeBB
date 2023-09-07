"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf = __importStar(require("nconf"));
const chalk = __importStar(require("chalk"));
const packageInstall = __importStar(require("./package-install"));
const upgrade_plugins_1 = require("./upgrade-plugins");
const database_1 = require("../database");
const meta_1 = require("../meta");
const upgrade_1 = require("../upgrade");
const build_1 = require("../meta/build");
const steps = {
    package: {
        message: 'Updating package.json file with defaults...',
        handler: () => __awaiter(void 0, void 0, void 0, function* () {
            yield Promise.resolve();
            packageInstall.updatePackageFile();
            packageInstall.preserveExtraneousPlugins();
            process.stdout.write(chalk.green('  OK\n'));
        }),
    },
    install: {
        message: 'Bringing base dependencies up to date...',
        handler: () => {
            process.stdout.write(chalk.green('  started\n'));
            return new Promise((resolve, reject) => {
                try {
                    packageInstall.installAll();
                    process.stdout.write(chalk.green('  OK\n'));
                    resolve();
                }
                catch (error) {
                    const errorMessage = `Error during dependency installation: ${error}`;
                    console.error(errorMessage);
                    reject(error);
                }
            });
        },
    },
    plugins: {
        message: 'Checking installed plugins for updates...',
        handler: () => __awaiter(void 0, void 0, void 0, function* () {
            const initDatabase = database_1.init; // Type assertion
            yield initDatabase();
            yield (0, upgrade_plugins_1.upgradePlugins)();
        }),
    },
    schema: {
        message: 'Updating NodeBB data store schema...',
        handler: () => __awaiter(void 0, void 0, void 0, function* () {
            const initDatabase = database_1.init; // Type assertion
            yield initDatabase();
            yield meta_1.configs.init();
            yield (0, upgrade_1.run)();
        }),
    },
    build: {
        message: 'Rebuilding assets...',
        handler: () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, build_1.buildAll)();
        }),
    },
};
function runSteps(tasks) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const promises = [];
            for (let i = 0; i < tasks.length; i++) {
                const step = steps[tasks[i]];
                if (step && step.message && step.handler) {
                    process.stdout.write(`\n${chalk.bold(`${i + 1}. `)}${chalk.yellow(step.message.toString())}`);
                    promises.push(step.handler());
                }
            }
            yield Promise.all(promises);
            const message = 'NodeBB Upgrade Complete!';
            const { columns } = process.stdout;
            const spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';
            console.log(`\n\n${spaces}${chalk.green.bold(message.toString())}\n`);
            process.exit();
        }
        catch (err) {
            if (err instanceof Error) {
                const errorMessage = err.stack || 'Unknown error occurred during upgrade';
                console.error(`Error occurred during upgrade: ${errorMessage}`);
            }
            else {
                console.error('An error occurred during upgrade, but it does not appear to be an instance of Error.');
            }
            throw err;
        }
    });
}
function runUpgrade(upgrades, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk.cyan('\nUpdating NodeBB...'));
        options = options || {};
        // disable mongo timeouts during upgrade
        nconf.set('mongo:options:socketTimeoutMS', 0);
        if (upgrades === true) {
            let tasks = Object.keys(steps);
            if (options.package || options.install || options.plugins || options.schema || options.build) {
                tasks = tasks.filter(key => options[key]);
            }
            yield runSteps(tasks);
            return;
        }
        const initDatabase = database_1.init;
        yield initDatabase();
        yield meta_1.configs.init();
        yield (0, upgrade_1.run)(upgrades);
        process.exit(0);
    });
}
exports.default = runUpgrade;
