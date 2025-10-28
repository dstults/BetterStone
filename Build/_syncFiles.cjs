'use strict';

// This syncs files that are modified here to the Space Engineers mods directory
//   so that we can test any changes

// Imports
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Constants
const args = process.argv.slice(2);
const approveMode = args.length > 0 && args[0] === 'approve';

const gitDir = path.join('..');
const gitHashes = {};

const appdata = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const deployDir = path.join(appdata, 'SpaceEngineers', 'mods', 'Better Stone');
const deployHashes = {};

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

// Get the hashes of targeted files in git
lookupFiles(gitDir, gitHashes);

// Get the hahes of targeted files in the local test copy before launching game
getFilesInDirectory(deployDir, deployHashes);

console.log();
let issuesFound = 0;
for (const key of Object.keys(gitHashes)) {
	if (deployHashes[key] === undefined) {
		console.log(`Deploy dir lacking file: ${key}`);
		const newPath = path.join(deployDir, getRelativePath(gitHashes[key].path));
		console.log('  ->', gitHashes[key].path, '->', newPath);
		if (approveMode) fs.copyFileSync(gitHashes[key].path, newPath);
		issuesFound++;
		continue;
	}
	if (gitHashes[key].hash !== deployHashes[key].hash) {
		if (key === 'modinfo.sbmi') {
			// reverse sync
			console.log(`REVERSE: Need to update file from deploy dir to git dir: ${key}`);
			console.log('  ->', deployHashes[key].path, '->', gitHashes[key].path);
			if (approveMode) fs.copyFileSync(deployHashes[key].path, gitHashes[key].path);
		} else {
			// forward sync
			console.log(`Need to update file from git dir to deploy dir: ${key}`);
			console.log('  ->', gitHashes[key].path, '->', deployHashes[key].path);
			if (approveMode) fs.copyFileSync(gitHashes[key].path, deployHashes[key].path);
		}
		delete deployHashes[key];
		issuesFound++;
		continue;
	}
	if (gitHashes[key].hash === deployHashes[key].hash) {
		//console.log(`FILE OK: ${key}`);
		delete deployHashes[key];
		continue;
	}
	throw new Error(`Unhandled exception: ${key}`);
};

for (const key of Object.keys(deployHashes)) {
	console.log(`File for deletion: ${key}`);
	console.log('  ->', deployHashes[key].path);
	if (approveMode) fs.unlinkSync(deployHashes[key].path);
	issuesFound++;
}

if (issuesFound === 0) {
	console.log('Great! All files were already in sync.');
} else {
	console.log();
	console.log(`Files needing synced: ${issuesFound}`);
}

console.log();
console.log(`Note to self: Don't forget to run _validateChanges.js before patching.`);
console.log();
