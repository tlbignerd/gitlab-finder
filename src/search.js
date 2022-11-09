require('dotenv').config()

const fs = require('fs');
const path = require('path');
const slugify = require('slugify')

const { Gitlab } = require('@gitbeaker/node');
const api = new Gitlab({
	token: process.env.API_TOKEN,
	host: process.env.API_HOST,
});

async function getGroups() {
	return await api.Groups.all({
		perPage: 100
	});
}
async function getGroupProjects(group) {
	return await api.Groups.projects(group.id, {
		perPage: 100,
		include_subgroups: false,
	});
}

async function searchInProject(project, search) {
	try {
		return await api.Search.all("blobs", search, {
			projectId: project.id,
			perPage: 100,
		});
	} catch (e) {
		console.log(e);
		process.exit();
	}
}

(async function () {

	const resultFile = path.resolve('./', `search-results__${slugify(process.env.SEARCH_KEYWORD)}.json`);

	var searchResults = {};
	if (fs.existsSync(resultFile)) {
		try {
			searchResults = JSON.parse(fs.readFileSync(resultFile));
		} catch (e) {
		}
	}

	let groups = await getGroups();
	for (let i = 0; i < groups.length; i++) {
		let group = groups[i];
		let projects = await getGroupProjects(group);
		for (let j = 0; j < projects.length; j++) {
			let project = projects[j];
			//console.log(project);process.exit;
			console.log('------------------------------------------------------------');
			console.log(project.name_with_namespace);

			if (searchResults[project.id]) {
				console.log(' > Already processed');
				continue;
			}

			searchResults[project.id] = searchResults[project.id] || {
				id: project.id,
				name: project.name_with_namespace,
				chunks: [],
			}
			await new Promise(resolve => setTimeout(resolve, 6000));

			let filter = [process.env.SEARCH_KEYWORD]
			if (process.env.SEARCH_FILE_EXTENSION) {
				filter.push(`filename:*.${process.env.SEARCH_FILE_EXTENSION}`);
			}

			let results = await searchInProject(project, filter.join(' '));
			for (let k = 0; k < results.length; k++) {
				let element = results[k];
				console.log(`+ ${element.path}`);
				element.data = element.data.replace("\t", "  ").split("\n");
				searchResults[project.id].chunks.push(element);
			}
			fs.writeFileSync(resultFile, JSON.stringify(searchResults, null, 2));

		}
	}
})();
