/**
 * Simple scripts for counting in parallel ISTEX files produced by the other processing programs
 */

/* Module Require */
const request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    http = require ('http'),
    readline = require('readline'),
    zlib = require('zlib');

// for making console output less boring
const green = '\x1b[32m';
const red = '\x1b[31m';
const orange = '\x1b[33m';
const white = '\x1b[37m';
const blue = `\x1b[34m`;
const score = '\x1b[7m';
const bright = "\x1b[1m";
const reset = '\x1b[0m'; 

var nb_full = 0;
var nb_ref = 0;
var nb_tei = 0;

function countFile(options, istexId, callback) {

	var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

    // enrichment fulltext
    var teiFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/' + istexId + ".tei.xml.gz";
    
    // bib ref
    var teiBibRefFilePath = resourcePath + 'enrichment/refbibs/' + istexId + ".refBibs.tei.xml.gz";
    
    // istex fulltext tei
    var istexFullTextFilePath = resourcePath + 'fulltext/tei/' + istexId + ".xml.gz";

    if (fs.existsSync(teiFullTextFilePath)) {
		nb_full++;
 	}
 	if (fs.existsSync(teiBibRefFilePath)) {
		nb_ref++;
 	}
 	if (fs.existsSync(istexFullTextFilePath)) {
		nb_tei++;
 	}

 	if (callback)
 		callback();
}

function countFiles(options) {
	var q = async.queue(function (istexId, callback) {
	  	countFile(options, istexId, callback);
    }, options.concurrency);

    q.drain = function() {
        console.log(red, "\nall tasks completed!", reset);
        end();
    }

	const rl = readline.createInterface({
        input: fs.createReadStream(options.inPath),
        crlfDelay: Infinity
    });

	rl.on('line', (line) => {
        q.push(line, function (err) {  
            if (err) { 
                return console.log('error in adding tasks to queue'); 
            }  
            if (nb_full % 1000 == 0) {
		 		// update file count
		 		process.stdout.cursorTo(0); 
		 		process.stdout.clearLine();
		 		var total = nb_full + nb_ref + nb_ref; 
		 		process.stdout.write("Total counted TEI files: " + orange + total + reset);
		 	}
        });
    });
}

/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    options.concurrency = 10; // number of concurrent call to the ISTEX API
    var attribute; // name of the passed parameter
    // get the path to the PDF to be processed
    for (var i = 2, len = process.argv.length; i < len; i++) {
        if (process.argv[i-1] == "-in") {
            options.inPath = process.argv[i];
        } else if (process.argv[i-1] == "-out") {
            options.outPath = process.argv[i];
        } else if (process.argv[i-1] == "-n") {
            options.concurrency = parseInt(process.argv[i], 10);
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
    console.info('Execution time: %ds', this_is_the_end/1000);

    process.stdout.write("Number of found enrichment fulltext TEI files: " + orange + nb_full + reset + "\n");
    process.stdout.write("Number of found bibref TEI files: " + orange + nb_ref + reset + "\n");
    process.stdout.write("Number of found fulltext/tei TEI files: " + orange + nb_ref + reset + "\n");
}

var start;

function main() {
    var options = init();
    start = new Date()
    countFiles(options);
}

main();