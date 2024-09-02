import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storageFilePath = path.join(__dirname, 'storage.json');

function readStorage() {
    try {
        const data = fs.readFileSync(storageFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {}; // Return an empty object if the file doesn't exist or is empty
    }
}

function writeStorage(data) {
    fs.writeFileSync(storageFilePath, JSON.stringify(data, null, 2));
}

export function getItem(key) {
    const storage = readStorage();
    return storage[key];
}

export function setItem(key, value) {
    const storage = readStorage();
    storage[key] = value;
    writeStorage(storage);
}
