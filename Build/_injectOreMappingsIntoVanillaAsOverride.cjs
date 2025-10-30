'use strict';

// _injectOreMappingsIntoVanilla.cjs:
// This will open the vanilla Space Engineers planet defs, then inject the mod's ore mappings into the vanilla defs file,
//   preserving the original vanilla file but using the mod's ore mappings updates.

// Imports
const xmlParser = require('xml-js');
const fs = require('fs');

// Load ore mappings from local JSON file
const oreMappingsText = fs.readFileSync('./Data/ORE_MAPPINGS.json');
const oreMappings = JSON.parse(oreMappingsText);
const oreMappingsToUpdate = new Set(Object.keys(oreMappings));


// Note: These might change between version updates
const VANILLA_FILES = [
	// This holds all the vanilla planets now, including triton and pertam
	'../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/PlanetGeneratorDefinitions.sbc',

	// This holds all the tutorial planets
	'../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/PlanetGeneratorDefinitions_ModExamples.sbc',

	// To be honest, I should just scan the Data directory recursively for any files starting with PlanetGeneratorDefinitions*
	//   ... maybe next version?
];

const OUTPUT_FILE = '../Data/Override-PlanetGeneratorDefinitions.sbc';

// Map planet "def.Id.SubtypeId" to value
const planetDefs = {};

const getDataFromDefinitionsFileAndInjectOreMappings = (path) => {
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

	for (const def of defs) {
		const planetId = def.Id.SubtypeId._text;
		planetDefs[planetId] = def;
		if (!oreMappingsToUpdate.has(planetId)) throw new Error(`planetId[${planetId}] not found in oreMappingsToUpdate, do we have a new planet or did a planet get read twice?`);

		// Inject the oreMappings for this planetId into this planet's OreMappings
		if (oreMappings[planetId]) {
			console.log(`Injecting ore mappings for planet: ${planetId}`);
			oreMappingsToUpdate.delete(planetId);

			// Convert the ore mappings from JSON format to XML-JS format
			def.OreMappings = {
				Ore: oreMappings[planetId].map(ore => ({
					_attributes: ore
				}))
			};
		} else {
			throw new Error(`No custom ore mappings found for planet: ${planetId}!`);
		}
	}

};

for (const vanillaFile of VANILLA_FILES) {
	getDataFromDefinitionsFileAndInjectOreMappings(vanillaFile);
}

// Make sure we used them all -- this may not always be the case but for now it's a safe bet
if (oreMappingsToUpdate.size > 0) {
	throw new Error(`oreMappingsToUpdate still has ${oreMappingsToUpdate.size} items: ${[...oreMappingsToUpdate]} -- please investigate why!`);
}

// Let's sort the output alphabetically so that we hopefully won't have fake drift in our compiled defs file
const sortedPlanetDefs = {};
const sortedKeys = Object.keys(planetDefs).sort();
for (const key of sortedKeys) sortedPlanetDefs[key] = planetDefs[key];

// Save sorted planetary definitions
// Build the XML structure
const outputStructure = {
	_declaration: {
		_attributes: {
			version: '1.0'
		}
	},
	Definitions: {
		_attributes: {
			'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema'
		},
		PlanetGeneratorDefinitions: {
			PlanetGeneratorDefinition: Object.values(sortedPlanetDefs)
		}
	}
};

// Convert back to XML
const xml = xmlParser.json2xml(JSON.stringify(outputStructure), { compact: true, spaces: 2 });

// Write to output file
fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');

console.log();
console.log(`Successfully wrote ${Object.keys(sortedPlanetDefs).length} planet definitions to ${OUTPUT_FILE}`);
console.log();
console.log(`Planets with custom ore mappings: ${Object.keys(oreMappings).filter(k => planetDefs[k]).join(', ')}`);
console.log();
