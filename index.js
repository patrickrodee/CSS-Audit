var fs = require('fs');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var chalk = require('chalk');
var Table = require('cli-table');

function getCssContent (callback) {
	console.log(chalk.red("Requesting..."));
	request("http://www.zingchart.com/css/common.css", function (err, response, body) {
		var cssLines = body.split('\n');
		callback(err, cssLines);
	});
}

function filterCssLines (css, callback) {
	console.log(chalk.yellow("Filtering..."));
	var filteredCss = css.filter(function (line) {
		var hasSelector = line.indexOf("{") > -1;
		var isNotMediaQuery = line.indexOf("@") < 0 && line.indexOf("max-") < 0 && line.indexOf("min-") < 0 && line.indexOf("and") < 0;
		var startsWithCharacter = !/^[0-9]/.test(line.trim());
		var doesNotIncludePseudo = !/(?:hover)|(?:after)|(?:before)|(?:focus)|(?:disabled)|(?:link)|(?:visited)|(?:active)|(?:\:\:selection)|(?:scrollbar)|(?:\:{1,2}\-[webkit|moz|ms])/g.test(line);
		var isNotComment = line.indexOf("/*") < 0;
		var include = hasSelector && isNotMediaQuery && startsWithCharacter && doesNotIncludePseudo && isNotComment;
		return include;
	});
	callback(null, filteredCss);
}

function mapCssRules (rules, callback) {
	console.log(chalk.green("Mapping..."));
	var mappedCss = rules.map(function (line) {
		var end = line.indexOf("{");
		var selector = line.slice(0, end).trim();
		return selector;
	});
	callback(null, mappedCss);
}

function getPages (rules, callback) {
	console.log(chalk.blue("Requesting again..."));
	request("http://www.zingchart.com/sitemap.xml", function (err, response, body) {
		var $ = cheerio.load(body, {
			xmlMode: true
		});
		var pages = $('url loc').map(function (index, element) {
			return $(this).text();
		}).get();
		callback(err, rules, pages);
	});
}

function checkRules (rules, pages, callback) {
	var result = {
		used: 0,
		unused: 0,
		rules: {}
	};
	rules.forEach(function (rule) {
		result.rules[rule] = [];
	});
	async.each(pages, function (page, done) {
		if (page.indexOf("assetId") < 0) {
			request(page, function (err, response, body) {
				var used = 0;
				var unused = 0;
				var $ = cheerio.load(body);
				rules.forEach(function (rule) {
					if ($(rule).length > 0) {
						result.rules[rule].push(page);
						used += 1;
					}
					else {
						unused += 1;
					}
				});
				result.used += used;
				result.unused += unused;
				console.log(chalk.green("  ✔  ︎") + page);
				done(null);
			});
		}
		else {
			done(null);
		}
	}, function (error) {
		var name = 'css_audit_' + new Date().toDateString().split(' ').join('-') + '.json';
		fs.writeFile(name, JSON.stringify(result,null,'\t'), function (error) {
			if (error) throw error;
			console.log(chalk.green("\tWrote to file"));
			callback(null, result);
		});
	});
}

function displayResults (rules, callback) {
	var table = new Table({
		head: ['Page', 'Status'],
		colWidths: [50, 10]
	});
	for (var key in rules.rules) {
		var rule = rules.rules[key];
		table.push([key, (rule.length > 0 ? chalk.green(rule.length) : chalk.red('✘') )]);
	}

}

async.waterfall([
	getCssContent,
	filterCssLines,
	mapCssRules,
	getPages,
	checkRules,
	displayResults
], function (err, output) {
	console.log(output);
});

/*
// 1. Get CSS
request('http://www.zingchart.com/css/common.css', function (err, response, body) {
	// 2. Make CSS into array of strings
	var cssLines = body.split('\n');
	// 3. Filter out lines that don't have a selector or are media queries.
	async.filter(cssLines, function (line, done1) {
		done1(line.indexOf("{") > -1 && line.indexOf("@") < 0 && !/^[0-9]/.test(line.trim()) && line.indexOf(":hover") > 0 && line.indexOf(":focus") > 0 && line.indexOf(":disabled") > 0);
	}, function (ruleLines) {
		// 4. Map the filtered rules to elements with just the selector
		async.map(ruleLines, function (line, done) {
			var end = line.indexOf("{");
			var selector = line.slice(0, end).trim();
			done(null, selector);
		}, function (err, rules) {
			// 5. Hit up the sitemap.xml
			var rules = rules;
			request('http://www.zingchart.com/sitemap.xml', function (err, response, body) {
				var $ = cheerio.load(body, {
					xmlMode: true
				});
				// 6. Get all the pages from the sitemap
				var pages = $('url loc').map(function (index, element) {
					return $(this).text();
				}).get();
				// 7. Hit up every page in the sitemap
				async.map(pages, function (url, done) {
					request(url, function (err, response, body) {
						var $ = cheerio.load(body);
						var status = {
							page: url,
							rules: {
								used: [],
								total: rules.length
							}
						};
						console.log(status);
						rules.forEach(function (rule) {
							console.log(rule);
							if ($(rule).length > 0) {
								status.rules.used.push(rule);
							}
						});
						done(null, status);
					});
				}, function (err, output) {
					console.log(output);
				});
			});
		});
	});
});
*/