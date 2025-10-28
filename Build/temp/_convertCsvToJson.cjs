'use strict';

const fs = require('fs');

// Simple CSV parser
const parseCSV = (csvText) => {
	const lines = csvText.trim().split('\n');
	const headers = lines[0].split(',').map(h => h.trim());
	const data = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const row = {};
		const values = [];
		let current = '';
		let inQuotes = false;

		// Parse the line handling quoted values
		for (let j = 0; j < line.length; j++) {
			const char = line[j];
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				values.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
		values.push(current.trim()); // Add last value

		// Map values to headers
		for (let j = 0; j < headers.length; j++) {
			const value = values[j] || '';
			// Try to convert to number if it looks like one
			row[headers[j]] = isNaN(value) || value === '' ? value : parseFloat(value);
		}
		data.push(row);
	}

	return data;
};


// Main loop
for (const fileName of ['blueprints', 'voxelMats']) {

	// Read and parse CSV
	const csvContent = fs.readFileSync(`../tests/${fileName}.csv`, 'utf8');
	const data = parseCSV(csvContent);

	// Sort for consistent ordering
	const sorted = data.sort((a, b) => {
		if (a.Source !== b.Source) return a.Source.localeCompare(b.Source);
		if (a.TypeId && b.TypeId && a.TypeId !== b.TypeId) return a.TypeId.localeCompare(b.TypeId);
		return a.SubtypeId.localeCompare(b.SubtypeId);
	});

	// Empty strings are deleted
	for (const obj of data) {
		for (const key of Object.keys(obj)) {
			if (obj[key] === '' || obj[key] === null) delete obj[key];
			if (obj[key] === 'true') obj[key] = true;
			if (obj[key] === 'false') obj[key] = false;
		}
	}

	// Convert to JSON with tabs
	const jsonOutput = JSON.stringify(sorted, null, '\t');

	// Write to file
	fs.writeFileSync(`../tests/${fileName}.json`, jsonOutput, 'utf8');

	console.log(`Converted ${sorted.length} rows from CSV to JSON`);
	console.log(`Output saved to ../tests/${fileName}.json`);
}
