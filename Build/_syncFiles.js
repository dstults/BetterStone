'use strict';

// Imports
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Constants
const rootDir = path.join('..');
const rootHashes = {};

const appdata = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const targetDir = path.join(appdata, 'SpaceEngineers', 'mods', 'Better Stone');
const targetHashes = {};

// List of files to merge: this will need updated if additional files/directories are added
const fileLookupList = [
	// directories
	'Data',
	'Textures',

	// files
	'asteroids.txt',
	'metadata.mod',
	'modinfo.sbmi',
	'README.md',
	'thumb.png',
];

// Functions
const getHash = (file) => {
	const fileBuffer = fs.readFileSync(file);
	const baseHash = crypto.createHash('sha256');
	const hashSum = baseHash.update(fileBuffer);
	const hex = hashSum.digest('hex');
	return hex;
};

const getRelativePath = (path) => {
	if (path.substring(0, 3) === '../') return path.slice(3);
	if (path.substring(0, 3) === '..\\') return path.slice(3);
	throw new Error(`Did not recognize path to return relative path: ${path}`);
};

const getFilesInDirectory = (base, hashes) => {
	const files = fs.readdirSync(base);
	for (const file of files) {
		const fullpath = path.join(base, file);
		const lstat = fs.lstatSync(fullpath);
		if (lstat.isDirectory()) {
			getFilesInDirectory(fullpath, hashes);
			continue;
		}
		hashes[path.basename(fullpath)] = {
			path: fullpath,
			hash: getHash(fullpath),
		};
	}
};

const lookupFiles = (base, hashes) => {
	for (const fileLookup of fileLookupList) {
		const fullpath = path.join(base, fileLookup);
		if (!fs.existsSync(fullpath)) {
			throw new Error(`ERROR: File expected but not found: ${fullpath}`);
		}
		const lstat = fs.lstatSync(fullpath);
		if (lstat.isDirectory()) {
			getFilesInDirectory(fullpath, hashes);
			continue;
		}
		hashes[path.basename(fullpath)] = {
			path: fullpath,
			hash: getHash(fullpath),
		};
	}
};

lookupFiles(rootDir, rootHashes);
getFilesInDirectory(targetDir, targetHashes);

console.log();
let issuesFound = 0;
for (const key of Object.keys(rootHashes)) {
	if (targetHashes[key] === undefined) {
		console.log(`Target lacking file: ${key}`);
		const newPath = path.join(targetDir, getRelativePath(rootHashes[key].path));
		console.log('  ->', rootHashes[key].path, '->', newPath);
		//fs.copyFileSync(rootHashes[key].path, newPath);
		issuesFound++;
		continue;
	}
	if (rootHashes[key].hash !== targetHashes[key].hash) {
		if (key === 'modinfo.sbmi') {
			// reverse sync
			console.log(`REVERSE: Need to update file from target to root: ${key}`);
			console.log('  ->', targetHashes[key].path, '->', rootHashes[key].path);
			//fs.copyFileSync(targetHashes[key].path, rootHashes[key].path);
		} else {
			// forward sync
			console.log(`Need to update file from root to target: ${key}`);
			console.log('  ->', rootHashes[key].path, '->', targetHashes[key].path);
			//fs.copyFileSync(rootHashes[key].path, targetHashes[key].path);
		}
		delete targetHashes[key];
		issuesFound++;
		continue;
	}
	if (rootHashes[key].hash === targetHashes[key].hash) {
		//console.log(`FILE OK: ${key}`);
		delete targetHashes[key];
		continue;
	}
	throw new Error(`Unhandled exception: ${key}`);
};

for (const key of Object.keys(targetHashes)) {
	console.log(`File for deletion: ${key}`);
	console.log('  ->', targetHashes[key].path);
	issuesFound++;
}

if (issuesFound === 0) {
	console.log('Great! All files should be in sync.');
} else {
	console.log();
	console.log(`Files needing synced: ${issuesFound}`);
}

console.log();
console.log(`Note to self: Don't forget to run _validateChanges.js before patching.`);
console.log();
