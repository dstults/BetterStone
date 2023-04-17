'use strict';

// The output of this script is used to track changes in vanilla values

// Imports
const xmlParser = require('xml-js');
const fs = require('fs');

// Constants
const alertText = '!!!!!!!!!!!!!!!!!!!!!!!!!!!!';

// Shared Helpers
const stringifyRecipeItem = (ent) => `${ent.SubtypeId} ${ent.TypeId}: ${ent.Amount}`;
const stringifyXYZW = (ent) => {
	const X = ent.X ? parseFloat(ent.X._text) : '-';
	const Y = ent.Y ? parseFloat(ent.Y._text) : '-';
	const Z = ent.Z ? parseFloat(ent.Z._text) : '-';
	const W = ent.W ? parseFloat(ent.W._text) : '-';
	return `x${X}|y${Y}|z${Z}|w${W}`;
};
const stringifySimpleTiling = (ent) => {
	const dInit = ent.InitialDistance ? parseFloat(ent.InitialDistance._text) : '-';
	const sInit = ent.InitialScale ? parseFloat(ent.InitialScale._text) : '-';
	const dMult = ent.DistanceMultiplier ? parseFloat(ent.DistanceMultiplier._text) : '-';
	const sMult = ent.ScaleMultiplier ? parseFloat(ent.ScaleMultiplier._text) : '-';
	return `${dInit}/${sInit}/${dMult}/${sMult}`;
};
const stringifySimpleTilingLegacy = (ent) => {
	const f1d = ent.Far1Distance ? parseFloat(ent.Far1Distance._text) : '-';
	const f2d = ent.Far2Distance ? parseFloat(ent.Far2Distance._text) : '-';
	const f1s = ent.Far1Scale ? parseFloat(ent.Far1Scale._text) : '-';
	const f2s = ent.Far2Scale ? parseFloat(ent.Far2Scale._text) : '-';
	return `old:${f1d}/${f2d}/${f1s}/${f2s}`;
};

const mergeIntoCsv = (...data) => {
	const allData = [];
	data.forEach(d => allData.push(...d));

	const columns = [];
	for (const item of allData) {
		for (const key of Object.keys(item)) {
			if (key === '_comment') continue;
			if (!columns.includes(key)) columns.push(key);
		}
	}

	const rows = [];
	rows.push(columns.join(','));

	for (const item of allData) {
		const row = [];
		for (const column of columns) {
			const value = typeof item[column] === 'string' && item[column].includes(',') ? `"${item[column]}"` : item[column] || '';
			row.push(value);
		}
		rows.push(row.join(','));
	}

	rows.push(''); // final newline
	return rows.join('\n');
};

// Interpret blueprints sbc data
const getDataFromBlueprintXml = (src, path) => {
	const xml = fs.readFileSync(path, 'utf8')
	const jo = JSON.parse(xmlParser.xml2json(xml, { compact: true, spaces: 2 }));

	const filtered = jo.Definitions.Blueprints.Blueprint.filter(bp =>
		bp.Id.SubtypeId._text.includes('OreToIngot') &&
		!bp.Id.SubtypeId._text.includes('Deconstruction')
	)

	const mapped = filtered.map(bp => {
		const prereqFmt = stringifyRecipeItem(bp.Prerequisites.Item._attributes);
		const resultsArray = bp.Result ? [bp.Result._attributes] : bp.Results.Item._attributes ? [bp.Results.Item._attributes]: bp.Results.Item.map(i => i._attributes);
		const resultsFmt = resultsArray.map(r => stringifyRecipeItem(r)).join(' + ');

		return {
			Source: src,
			SubtypeId: bp.Id.SubtypeId._text,
			BaseProductionTimeInSeconds: parseFloat(bp.BaseProductionTimeInSeconds._text),
			Prerequisites: prereqFmt,
			Results: resultsFmt,
		};
	});

	return mapped;
};

// Interpret voxel materials sbc data
const getDataFromVoxelMatsXml = (src, path) => {
	const xml = fs.readFileSync(path, 'utf8')
	const jo = JSON.parse(xmlParser.xml2json(xml, { compact: true, spaces: 2 }));
	
	const filtered = jo.Definitions.VoxelMaterials.VoxelMaterial.filter(i => true);

	const ignoreKeys = [
		// Metadata and typos
		'_attributes',
		'_text',
		// Manual
		'Id',
		'AsteroidGeneratorSpawnProbabilityMultiplier',
		'MinedOreRatio',
		'MinedOre',
	];
	const numericKeys = [
		'MinedOreRatio',
		'AsteroidGeneratorSpawnProbabilityMultiplier',
		'MinVersion',
		'Friction',
		'Restitution',
		'Far1Distance',
		'Far1Scale',
		'Far2Distance',
		'Far2Scale',
		'Far3Distance',
		'Far3Color',
		'ExtDetailScale',
		'Scale',
		'SpecularPower',
		'SpecularShininess',
	];

	const mapped = filtered.map(mat => {
		// if (mat.Id.SubtypeId._text === 'debug_name_here') {
		// 	console.log(mat);
		// 	process.exit();
		// }
	
		const obj = {
			Source: src,
			TypeId: mat.Id.TypeId._text,
			SubtypeId: mat.Id.SubtypeId._text,
			AsteroidGeneratorSpawnProbabilityMultiplier: mat.AsteroidGeneratorSpawnProbabilityMultiplier ? parseFloat(mat.AsteroidGeneratorSpawnProbabilityMultiplier._text) : null,
			MinedOreRatio: mat.MinedOreRatio?._text || alertText,
			MinedOre: mat.MinedOre?._text || alertText,
		};
		for (const [key, value] of Object.entries(mat)) {
			if (ignoreKeys.includes(key)) continue;
			const mk = mat[key];
			if (Object.keys(mk).length === 0) {
				obj[key] = '-';
			} else if (numericKeys.includes(key)) {
				obj[key] = parseFloat(value._text);
			} else if (mk.X || mk.Y || mk.Z || mk.W) {
				obj[key] = stringifyXYZW(mk);
			} else if (mk.InitialDistance || mk.InitialScale || mk.DistanceMultiplier || mk.ScaleMultiplier) {
				obj[key] = stringifySimpleTiling(mk);
			} else if (mk.Far1Distance || mk.Far2Distance || mk.Far1Scale || mk.Far2Scale) {
				obj[key] = stringifySimpleTilingLegacy(mk);
			} else if (mk.Color) {
				obj[key] = mk.Color._text;
			} else if (mk.Normal) {
				obj[key] = mk.Normal._text;
			} else if (mk._attributes?.Hex) {
				obj[key] = mk._attributes.Hex;
			} else {
				obj[key] = typeof mk?._text === 'string' ? mk._text : alertText;
			}
		}
		return obj;
	});

	return mapped;
};

if (!fs.existsSync('./Tests')) fs.mkdir('./Tests');

const blueprints = mergeIntoCsv(
	getDataFromBlueprintXml('vanilla', '../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/Blueprints.sbc'),
	getDataFromBlueprintXml('mod', '../Data/Mod-Blueprints.sbc'),
);
fs.writeFileSync('./Tests/blueprints.csv', blueprints, 'utf8');

const voxelMats = mergeIntoCsv(
	getDataFromVoxelMatsXml('vanilla', '../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/VoxelMaterials_asteroids.sbc'),
	getDataFromVoxelMatsXml('mod', '../Data/Mod-VoxelMaterials_asteroids.sbc'),
	getDataFromVoxelMatsXml('vanilla', '../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/VoxelMaterials_planetary.sbc'),
	getDataFromVoxelMatsXml('van+', '../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/VoxelMaterialsTriton.sbc'),
	getDataFromVoxelMatsXml('van+', '../../../SteamLibrary/steamapps/common/SpaceEngineers/Content/Data/VoxelMaterialsPertam.sbc'),
);
fs.writeFileSync('./Tests/voxelMats.csv', voxelMats, 'utf8');
