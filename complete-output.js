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
    	console.log("file does not exist: " + teiFullTextFilePath)
    	if (callback)
 		   	callback();
	} else {
	    var rstream = fs.createReadStream(teiFullTextFilePath).pipe(zlib.createGunzip());
	    var body = ""
	    rstream.on('data', function(chunk) {
	    	body += chunk;
	    });
	    rstream.on('finish', function (err) {
		    if (err) { 
		    	console.log('error reading grobid tei file', err)
		        if (callback)
		        	callback();
		        return false;
		    } 

			// finding the <listBibl> is much faster with string matching than using xslt
		    var ind1 = body.indexOf("<listBibl>");
		    var ind2 = body.indexOf("</listBibl>");
		    if ( (ind1 != -1) && (ind2 != -1)) {
		        var refbibsSegment = body.substring(ind1, ind2+11);

		        // write ref bibs enrichment
		        mkdirp(teiRefBibsFilePath, function(err, made) {            
		            if (err) {
		            	// I/O error
			            console.log('io error for creating refbibs directory', err)
		            	if (callback)
		                	callback();
		                return false;
		            }

		            var writeOptions = { encoding: 'utf8' };
		            var wstream = fs.createWriteStream(teiRefBibsFilePath + istexId + ".refBibs.tei.xml.gz", writeOptions);
		            wstream.on('finish', function (err) {
		                if (err) { 
	                        console.log('error refbibs file completion', err);
	                        if (callback)
		                		callback();
		                	return false;
	                    } 
	                    console.log(white, "Refbibs written under: " + teiRefBibsFilePath, reset); 
		               	downloadIstexFullText(options, istexId, refbibsSegment, callback);
		            });

		            var compressStream = zlib.createGzip();
		            compressStream.pipe(wstream);

		            compressStream.write("<TEI>\n\t<standOff>\n\t\t<teiHeader/>\n\t\t<text>\n\t\t\t<front/>\n\t\t\t<body/>\n\t\t\t<back>\n");
		            compressStream.write(refbibsSegment)
		            compressStream.write("\n\t\t\t</back>\n\t\t</text>\n\t</standOff>\n</TEI>");
		            
		            compressStream.end();		  
			  	});
		    } else {
		    	console.log("grobid refBibs not found for " + teiFullTextFilePath);
		    	if (callback)
		        	callback();
		    }
		});
	}
}

/**
 * Download the full text associated to an Istex 
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
        file.on('error', function(err) { 
	        console.log('io error for writing downloaded fulltext file', err);
    	    if (callback) 
        	    callback();
        	return false;
        });
    })

    request.on('error', function(err) {  
        console.log('request to fulltext file failed', err);
        if (callback) 
            callback();
        return false;
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
		console.log("file does not exist: " + tempTeiFullTextFilePath);
		if (callback) 
	    	callback();
        return false;
	}
	//console.log('file has been entirely downloaded:', tempTeiFullTextFilePath)
    var rstream = fs.createReadStream(tempTeiFullTextFilePath);
    var tei = ""

    rstream.on('error', function(error) {
    	console.log("cannot read file: " + tempTeiFullTextFilePath);
    	if (callback) 
	        callback();
        return false;
    })

    rstream.on('data', function(chunk) {
    	tei += chunk;
    });

    rstream.on('close', function (err) {
    	//console.log("tmp tei file read");
	    if (err) { 
	        console.log('failed to complete tmp tei file reading', err);
	        if (callback)
		        callback();
	        return false;
	    } 

	    // check in the TEI full text if the bib refs hae been produced by grobid
	    var ind = tei.indexOf("via GROBID");
	    var toUpdate = false;
	    var respStmtToUpdate = false;
	    if (ind != -1) {
	    	// we can update the old GROBID ref bib with the new GROBID ones
	    	toUpdate = true;
	    	console.log('grobid refbibs TO update: ', istexId);
	    } else {
	    	// case we don't have ref. bib. at all, then we can update the file too
	    	var ind2 = tei.indexOf('<listBibl/>');
	    	if (ind2 != -1) {
		    	// we can update the no-ref-bib with the new GROBID ones
		    	toUpdate = true;
		    	console.log('no existing ref,, so adding grobid refbibs')
		    	// we will need to update the tei header/respStmt 
		    	respStmtToUpdate = true;
		    } else {
		    	console.log('no grobid refbibs to update', istexId);
	    	}
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
	          		// clean the tmp tei fulltext
				    fs.unlink(tempTeiFullTextFilePath, function(err2) { 
				    	if (err2) { 
			                console.log('error removing downloaded temporary tei file'); 
			            } 
			        }); 
			        if (callback)
				       	callback();
	                return false;
	            }

	            var writeOptions = { encoding: 'utf8' };
	            var wstream = fs.createWriteStream(fullTextPath + istexId + ".tei.xml.gz", writeOptions);
	            wstream.on('finish', function (err) {
	                if (err) { 
	                    console.log(err);
	                } else
	                	console.log(white, "fulltext written under: " + fullTextPath, reset); 

		            console.log('deleting tmp tei...')
				    // clean the tmp tei fulltext
				    fs.unlink(tempTeiFullTextFilePath, function(err2) { 
				    	if (err2) { 
			                console.log('error removing downloaded temporary tei file'); 
			            } 
			            if (callback)
				       		callback();
			        }); 
	            });

	            var compressStream = zlib.createGzip();
	            compressStream.pipe(wstream);

	            // catching area to be replaced
	            var ind1 = tei.indexOf("<listBibl");
				var ind2 = tei.indexOf("</listBibl>");
				if ( (ind1 != -1) && (ind2 != -1)) {

					// at this stage, we might want to remove the coordinates in the fulltext document
					// and just leave them in the enrichment file
					var regex = /coords="[0-9,;.]*" /gi;
					refbibsSegment = refbibsSegment.replace(regex, "");

					// update bib ref
					tei = tei.substring(0, ind1) + refbibsSegment + tei.substring(ind2 + 10, tei.length);				

					if (respStmtToUpdate) {
						// we need to add in the header a statement about the ref bib produced via GROBID
						// which goes under <titleStmt>
						var viaGROBID = '<respStmt><resp>Références bibliographiques récupérées via GROBID</resp><name resp="ISTEX-API">ISTEX-API (INIST-CNRS)</name></respStmt>';
						tei = tei.replace('</titleStmt>', viaGROBID+'</titleStmt>');
					}
				}
	            compressStream.write(tei);
	            compressStream.end();
	        });
	    } else {
	    	// we go on
	    	// clean the tmp tei fulltext
		    fs.unlink(tempTeiFullTextFilePath, function(err2) { 
		    	if (err2) { 
	                console.log('error removing downloaded temporary tei file'); 
	            } 
	            if (callback)
		       		callback();
	        }); 
	    }
	});
}

function processCompletion(options, output) {
	var q = async.queue(function (istexId, callback) {
	  	generateRefBibsFile(options, istexId, callback);
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
    console.info('Execution time: %dms', this_is_the_end)
}

var start;

function main() {
    var options = init();
    start = new Date()
    processCompletion(options);
}

main();