'use strict';

/* Module Require */
const mkdirp = require('mkdirp'),
    request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    https = require ('https'),
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

function generateRefBibsFile(options, istexId, callback) {
	// read the full text TEI produced by GROBID - if any

	var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

    var teiFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/' + istexId + ".tei.xml.gz";
    var teiRefBibsFilePath = resourcePath + 'enrichment/refbibs/';

    if (!fs.existsSync(teiFullTextFilePath)) {
    	callback("file does not exist: " + teiFullTextFilePath);
        return false;
	}

    var rstream = fs.createReadStream(teiFullTextFilePath).pipe(zlib.createGunzip());
    var body = ""
    rstream.on('data', function(chunk) {
    	body += chunk;
    });
    rstream.on('finish', function (err) {
	    if (err) { 
	        console.log(err);
	        return callback(err);
	    } 
		//fs.readFile(, 'utf8', function(err, body) {

		// finding the <listBibl> is much faster with string matching than using xslt
	    var ind1 = body.indexOf("<listBibl>");
	    var ind2 = body.indexOf("</listBibl>");
	    if ( (ind1 != -1) && (ind2 != -1)) {
	        var refbibsSegment = body.substring(ind1, ind2+11);

	        // write ref bibs enrichment
	        mkdirp(teiRefBibsFilePath, function(err, made) {
	            // I/O error
	            if (err) {
	                return callback(err);
	            }

	            var writeOptions = { encoding: 'utf8' };
	            var wstream = fs.createWriteStream(teiRefBibsFilePath + istexId + ".refBibs.tei.xml.gz", writeOptions);
	            wstream.on('finish', function (err) {
	                if (err) { 
	                        console.log(err);
	                    } 
	                    console.log(white, "Refbibs written under: " + teiRefBibsFilePath, reset); 
	                    callback();
	            });

	            var compressStream = zlib.createGzip();
	            compressStream.pipe(wstream);

	            compressStream.write("<TEI>\n\t<standOff>\n\t\t<teiHeader/>\n\t\t<text>\n\t\t\t<front/>\n\t\t\t<body/>\n\t\t\t<back>\n");
	            compressStream.write(refbibsSegment)
	            compressStream.write("\n\t\t\t</back>\n\t\t</text>\n\t</standOff>\n</TEI>");
	            
	            compressStream.end();
	        });

	        downloadIstexFullText(options, istexId, refbibsSegment, function(err) {
		  		if (err) {
	                console.log(err);
	                callback();
		  		}
	            console.log(blue, "updated full text for " + line, reset);
		  	});
	    }
	});
}

/**
 * Download the PDF associated to an Istex 
 */
function downloadIstexFullText(options, istexId, refbibsSegment, callback) {
	// download the current full text file via the API:
	// url is https://api.istex.fr/document/*ISTEX_ID*/fulltext/tei
    var dest = options.temp_path + "/" + istexId + '.tei.xml';
    var file = fs.createWriteStream(dest);
    var tei_url = 'https://api.istex.fr/document/' + istexId + '/fulltext/tei';
    console.log('downloading', tei_url, '...')
    var request = https.get(tei_url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(updateFullTextFile(options, istexId, refbibsSegment, callback));  
            // close() is async, call method after close completes
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest, function(err2) { if (err2) { 
                return console.log('error removing downloaded temporary tei file'); 
            } 
        }); 
        // delete the file async
        if (callback) 
            callback(err.message);
    });
}

function updateFullTextFile(options, istexId, refbibsSegment, callback) {
	
	// update is possible 
	// * if the following is present under respStmt:
	// <resp>Références bibliographiques récupérées via GROBID</resp>
	// * if no bib ref present at all

	// get the dowloaded full text
	var tempTeiFullTextFilePath = options.temp_path + "/" + istexId + '.tei.xml';
	if (!fs.existsSync(tempTeiFullTextFilePath)) {
    	callback("file does not exist: " + teiFullTextFilePath);
        return false;
	}
	console.log('this file has been entirely downloaded:', tempTeiFullTextFilePath)
    var rstream = fs.createReadStream(tempTeiFullTextFilePath);
    var tei = ""
    rstream.on('data', function(chunk) {
    	tei += chunk;
    });

    var ind1 = tei.indexOf("<listBibl");
	var ind2 = tei.indexOf("</listBibl>");
	if ( (ind1 == -1) || (ind2 == -1)) {
		callback("no bibrefs in TEI: " + tempTeiFullTextFilePath);
        return false;
    }

    var refbibsSegment = body.substring(ind1, ind2+11);
    rstream.on('finish', function (err) {
	    if (err) { 
	        console.log(err);
	        return callback(err);
	    } 

	    // check if the bib refs hae been produced by grobid
	    var ind = tei.indexOf("Références bibliographiques récupérées via GROBID");
	    var toUpdate = false;
	    if (ind != -1) {
	    	// we can update the ref bib with the new ones
	    	toUpdate = true;
	    } else {
	    	// case we don't have ref. bib. at all

	    	// we will need to update the tei header/respStmt 
	    }

	    if (toUpdate) {
		    var resourcePath = options.outPath+"/"+
	                                istexId[0]+"/"+
	                                istexId[1]+"/"+
	                                istexId[2]+"/"+
	                                istexId+"/";

	    	var fullTextPath = resourcePath + 'fulltext/';

	    	// write ref bibs enrichment
	        mkdirp(fullTextPath, function(err, made) {
	            // I/O error
	            if (err) {
	                return callback(err);
	            }

	            var writeOptions = { encoding: 'utf8' };
	            var wstream = fs.createWriteStream(fullTextPath + istexId + ".tei.xml.gz", writeOptions);
	            wstream.on('finish', function (err) {
	                if (err) { 
	                        console.log(err);
	                    } 
	                    console.log(white, "fulltext written under: " + fullTextPath, reset); 
	                    callback();
	            });

	            var compressStream = zlib.createGzip();
	            compressStream.pipe(wstream);

	            compressStream.write(tei);
	            
	            compressStream.end();
	        });

	    }
	});
}

function processCompletion(options, output) {
	var q = async.queue(function (istexId, callback) {
        //callGROBID(options, file, callback);
        //downloadIstexPDF(options, istexId, callback);
        generateRefBibsFile(options, istexId, function(err) {
	  		if (err)
                console.log(err);
            console.log(blue, "processed bib refs for " + line, reset);
	  	});
	  	/*downloadIstexFullText(options, line, function(err) {
	  		if (err)
                console.log(err);
            console.log(blue, "updated full text for " + line, reset);
	  	});*/

    }, options.concurrency);

    q.drain = function() {
        console.log(red, "\nall tasks completed!", reset);
        end();
    }

	const rl = readline.createInterface({
	  	input: fs.createReadStream(options.inPath)
	});

	rl.on('line', (line) => {
        //console.log(`ISTEX ID from file: ${line}`);
        q.push(line, function (err) {  
            if (err) { 
                return console.log('error in adding tasks to queue'); 
            }  
            console.log(orange, 'task is completed', reset);  
        });
    });
}


/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    // start with the config file
    const config = require('./config.json');
    options.temp_path = config.temp_path;

    // default service is full text processing
    //options.action = "processFulltextDocument";
    options.concurrency = 50; // number of concurrent call to the ISTEX API
    var attribute; // name of the passed parameter
    // get the path to the PDF to be processed
    for (var i = 2, len = process.argv.length; i < len; i++) {
        if (process.argv[i-1] == "-in") {
            options.inPath = process.argv[i];
        } else if (process.argv[i-1] == "-out") {
            options.outPath = process.argv[i];
        } else if (process.argv[i-1] == "-n") {
            options.concurrency = parseInt(process.argv[i], 10);
        } /*else if (!process.argv[i].startsWith("-")) {
            options.action = process.argv[i];
        }*/
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
    console.info('Execution time: %dms', this_is_the_end)
}

var start;

function main() {
    var options = init();
    start = new Date()
    processCompletion(options);
}

main();