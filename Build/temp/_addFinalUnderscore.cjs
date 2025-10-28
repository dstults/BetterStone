'use strict';

// In order to prevent the JSON final comma diff issue, I'm adding a field `"_": "_"` to every object

const fs = require('fs');

for (const file of ['../tests/blueprints.json', '../tests/voxelMats.json']) {
	const text = fs.readFileSync(file, 'utf8');
	const arr = JSON.parse(text);
	for (const obj of arr) {
		obj._ = '_';
	}
	const newText = JSON.stringify(arr, null, '\t');
	fs.writeFileSync(file, newText, 'utf8');
}
