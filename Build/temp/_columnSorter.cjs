'use strict';

// I wrote this because I didn't sort the columns originally and that causes faux diffs to appear between versions

const fs = require('fs');

const KEY_COLUMNS = ['Source', 'TypeId', 'SubtypeId'];

const sortCsvColumns = (inputPath, outputPath) => {
	const csv = fs.readFileSync(inputPath, 'utf8');
	const lines = csv.split('\n');

	// Parse header
	const header = lines[0];
	const columns = header.split(',');

	// Create sorted column mapping - key columns first, then alphabetical
	const keyColumns = KEY_COLUMNS.filter(k => columns.includes(k));
	const otherColumns = columns.filter(k => !KEY_COLUMNS.includes(k)).sort();
	const sortedColumns = [...keyColumns, ...otherColumns];
	const columnIndexMap = sortedColumns.map(col => columns.indexOf(col));

	// Reorder all rows
	const sortedLines = lines.map(line => {
		if (!line.trim()) return line; // Keep empty lines

		const values = [];
		let inQuotes = false;
		let currentValue = '';

		// Parse CSV respecting quoted values
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if (char === '"') {
				inQuotes = !inQuotes;
				currentValue += char;
			} else if (char === ',' && !inQuotes) {
				values.push(currentValue);
				currentValue = '';
			} else {
				currentValue += char;
			}
		}
		values.push(currentValue); // Push last value

		// Reorder based on mapping
		const reordered = columnIndexMap.map(idx => values[idx] || '');
		return reordered.join(',');
	});

	fs.writeFileSync(outputPath, sortedLines.join('\n'), 'utf8');
	console.log(`✓ Sorted ${inputPath} → ${outputPath}`);
};

// Sort your CSVs
sortCsvColumns('./Tests/blueprints.csv', './Tests/blueprints-sorted.csv');
sortCsvColumns('./Tests/voxelMats.csv', './Tests/voxelMats-sorted.csv');

console.log('\nDone! Compare the -sorted.csv files with your new data.');
