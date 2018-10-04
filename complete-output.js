'use strict';

/* Module Require */
const mkdirp = require('mkdirp'),
    request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    https = require ('https'),
    zlib = require('zlib');

function generateRefBibsFile(options, istexId, callback) {

}

function updateFullTextFile(options, istexId, callback) {
	// url is https://api.istex.fr/document/*ISTEX_ID*/fulltext/tei

	// update is possible 
	// * if the following is present under respStmt:
	// <resp>Références bibliographiques récupérées via GROBID</resp>
	// * if no bib ref present at all


}

function process(options, output) {
	// file tree walk from out, getting the Istex ID along the way
	
}


/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    // start with the config file
    const config = require('./config.json');
    options.temp_path = config.temp_path;

    var attribute; // name of the passed parameter
    // get the path to the PDF to be processed
    for (var i = 2, len = process.argv.length; i < len; i++) {
        if (process.argv[i-1] == "-out") {
            options.outPath = process.argv[i];
        } else if (!process.argv[i].startsWith("-")) {
            options.action = process.argv[i];
        }
    }

    if (!options.outPath) {
        console.log("Output path is not defines");
        return;
    }

    // check the output path
    if (options.outPath) {
        fs.lstat(options.outPath, (err, stats) => {
            if (err)
                console.log(err);
            if (stats.isFile()) 
                console.log("Output path must be a directory, not a file");
            if (!stats.isDirectory())
                console.log("Output path is not a valid directory");
        });
    }
    return options;
}

function end() {
    var this_is_the_end = new Date() - start
    console.info('Execution time: %dms', this_is_the_end)
}

var start;

function main() {
    var options = init();
    start = new Date()
    process(options);
}

main();