"use strict";
/**
 * Simple JSON File Storage
 * Replaces better-sqlite3 for compatibility
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snipeTargetsStore = exports.tradesStore = exports.ordersStore = exports.walletsStore = exports.usersStore = void 0;
exports.createStore = createStore;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
// Ensure data directory exists
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
function createStore(name) {
    const filePath = path_1.default.join(DATA_DIR, `${name}.json`);
    // Load existing data
    let data = [];
    if (fs_1.default.existsSync(filePath)) {
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            data = JSON.parse(content);
        }
        catch {
            data = [];
        }
    }
    const save = () => {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
    };
    return {
        data,
        save,
        findAll: () => [...data],
        findOne: (predicate) => data.find(predicate),
        findMany: (predicate) => data.filter(predicate),
        insert: (item) => {
            if (!item.id) {
                item.id = Date.now().toString();
            }
            data.push(item);
            save();
            return item;
        },
        update: (predicate, updates) => {
            const index = data.findIndex(predicate);
            if (index !== -1) {
                data[index] = { ...data[index], ...updates };
                save();
            }
        },
        delete: (predicate) => {
            const index = data.findIndex(predicate);
            if (index !== -1) {
                data.splice(index, 1);
                save();
            }
        }
    };
}
// Pre-defined stores
exports.usersStore = createStore('users');
exports.walletsStore = createStore('wallets');
exports.ordersStore = createStore('orders');
exports.tradesStore = createStore('trades');
exports.snipeTargetsStore = createStore('snipeTargets');
//# sourceMappingURL=jsonStore.js.map