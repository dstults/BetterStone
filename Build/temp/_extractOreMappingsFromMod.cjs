'use strict';

// _extractOreMappingsFromMod.cjs:
// This will open select mod files to get OreMappings from those mods files, then save to a JSON file.

// Imports
const xmlParser = require('xml-js');
const fs = require('fs');

const MOD_FILES = [
	'../Data/Override-Pertam.sbc',
	'../Data/Override-PlanetGeneratorDefinitions.sbc',
	'../Data/Override-Triton.sbc',
];

// Map planet "def.Id.SubtypeId" to value
const oreMappings = {};

const getDataFromDefinitionsFile = (path) => {
	const xml = fs.readFileSync(path, 'utf8')
	const jo = JSON.parse(xmlParser.xml2json(xml, { compact: true, spaces: 2 }));

	const defs = [];
	if (Array.isArray(jo.Definitions?.Definition)) {
		defs.push(...jo.Definitions.Definition);
	}
	if (Array.isArray(jo.Definitions?.PlanetGeneratorDefinitions?.PlanetGeneratorDefinition)) {
		defs.push(...jo.Definitions?.PlanetGeneratorDefinitions?.PlanetGeneratorDefinition);
	} else if (typeof jo.Definitions?.PlanetGeneratorDefinitions?.PlanetGeneratorDefinition === 'object') {
		defs.push(jo.Definitions?.PlanetGeneratorDefinitions?.PlanetGeneratorDefinition);
	}

	if (defs.length === 0) {
		console.debug(jo, Object.keys(jo));
		process.exit();
	}

	// Scrape the oreMappings
	for (const def of defs) {
		const planetId = def.Id.SubtypeId._text;
		const mappings = def.OreMappings.Ore.map((ore) => { return { ...ore._attributes }; });
		oreMappings[planetId] = mappings;
	}
};

for (const modFile of MOD_FILES) getDataFromDefinitionsFile(modFile);

const sortedOreMappings = {};
const sortedKeys = Object.keys(oreMappings).sort();
for (const key of sortedKeys) sortedOreMappings[key] = oreMappings[key];
console.log(oreMappings);
fs.writeFileSync('./data/ORE_MAPPINGS.json', JSON.stringify(sortedOreMappings, null, '\t'), 'utf8');
