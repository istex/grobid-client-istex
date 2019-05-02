'use strict';

/* Module Require */
const path = require('path'),
    fs = require('fs'),
    readline = require('readline');

/**
 * Select identifiers above a certain prefix.
 * usage: > node select -in resources/list.txt - prefix DEE > selection.txt
 */

function select(options) {
	if (!options.prefix){
		console.err("Prefix for selection is not defined");
		return;
	}

	const rl = readline.createInterface({
        input: fs.createReadStream(options.inPath),
        crlfDelay: Infinity
    });
         
    rl.on('line', (line) => {
        //console.log(`ISTEX ID from file: ${line}`);
        var localPrefix = line.substring(0, options.prefix.length);
        if (localPrefix > options.prefix) {
        	console.log(line);
        }
    });
}

/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    // get the path to the PDF to be processed
    for (var i = 2, len = process.argv.length; i < len; i++) {
        if (process.argv[i-1] == "-in") {
            options.inPath = process.argv[i];
        } else if (process.argv[i-1] == "-prefix") {
            options.prefix = process.argv[i];
        } 
    }

    if (!options.inPath) {
        console.log("Input path is not defines");
        return;
    }

    // check the input path
    fs.lstat(options.inPath, (err, stats) => {
        if (err)
            console.log(err);
        if (stats.isDirectory())
            console.log("Input path must be a file, not a directory");
        if (!stats.isFile()) 
            console.log("Input path must be a valid file");
    });

    return options;
}

function main() {
    var options = init();
    select(options);
}

main();