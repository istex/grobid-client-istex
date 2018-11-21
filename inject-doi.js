'use strict';

/* Module Require */
const request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    http = require ('http'),
    readline = require('readline'),
    striptags = require('striptags'),
    zlib = require('zlib'),
    parseXml = require('@rgrove/parse-xml'),
    jsonpath = require('jsonpath');

// for making console output less boring
const green = '\x1b[32m';
const red = '\x1b[31m';
const orange = '\x1b[33m';
const white = '\x1b[37m';
const blue = `\x1b[34m`;
const score = '\x1b[7m';
const bright = "\x1b[1m";
const reset = '\x1b[0m'; 

function matchDOI(options, istexId, callback) {
	// read the full text TEI produced by GROBID - if any

	var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

    var teiFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/' + istexId + ".tei.xml.gz";

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

		    // finding first the bibliographical section, which is the only place where we will inject 
		    // DOIl/ark
		    var ind1 = body.indexOf("<listBibl>");
		    var ind2 = body.indexOf("</listBibl>");
		    if ( (ind1 != -1) && (ind2 != -1)) {
		        var refbibsSegment = body.substring(ind1, ind2+11);

				// finding the <biblStruct> is much faster with string matching than using an xml parser/sax
				ind1 = 0;
				ind2 = 0;
				// first match is special, because it starts at offset 0
				var start = true;

				while(start || ((ind1 != -1) && (ind2 != -1))) {
					var base1 = ind1;
					var base2 = ind2;
					if (start) {
						start = false;
				    } else {
				    	base1 += 1;
				    	base2 += 1;
				    }
				    ind1 = refbibsSegment.indexOf("<biblStruct", base1);
				    ind2 = refbibsSegment.indexOf("</biblStruct>", base2);
			    	if ( (ind1 != -1) && (ind2 != -1) ) {
			    		// here is the XML segment corresponding to an extracted citation
			    		var citationSegment = refbibsSegment.substring(ind1, ind2+13);

			    		// if DOI is already there, we simply use it to get the ark


			    		// otherwise we use the metadata and pseudo-raw citation string 
			    		// for getting the identifiers
			    		citationSegment = citationSegment.replace(/\/title>/g, '/title>. ');
			    		citationSegment = citationSegment.replace(/\/forename>/g, '/forename> ');
			    		citationSegment = citationSegment.replace(/\/surname>/g, '/surname> ');
			    		citationSegment = citationSegment.replace(/\/persName>/g, '/persName>, ');

			    		citationSegment = citationSegment.replace(/unit="volume">/g, 'unit="volume">, vol. ');
			    		citationSegment = citationSegment.replace(/unit="issue">/g, 'unit="issue">');
			    		citationSegment = citationSegment.replace(/unit="page">/g, 'unit="page">, p. ');
			    		//console.log('tei segment: ' + citationSegment);

			    		// we strip the xml tags to get a pseudo raw citation
			    		var raw = striptags(citationSegment);
			    		// xml entities
			    		raw = raw.replace(/&amp;/g, "&")
			    		raw = raw.replace(/&quot;/g, "\"")
			    		raw = raw.replace(/&lt;/g, "<")
			    		raw = raw.replace(/&gt;/g, ">")
						raw = raw.replace(/&apos;/g, ">")
			    		
			    		raw = raw.replace(/\n/g, " ");
			    		raw = raw.replace(/\s\s+/g, ' ');
			    		raw = raw.replace(/\s, /g, ', ');

			    		console.log('raw: ' + raw);

			    		// parse the xml segment 
			    		var json = parseXml(citationSegment);
			    		console.log(json);

			    		// try to get the title and first author last name
			    		var title = jsonpath.query(json, '$..title');
			    		console.log(title);
			    		title = jsonpath.query(json, '$..title[?(@.level=="a")]');
			    		console.log(title);
			    		title = jsonpath.query(json, '$..title[?(@.level=="m")]');
			    		console.log(title);

			    		var firstAuthor = jsonpath.query(json, '$..surname[0]');
			    		console.log(firstAuthor);

			    		// try to get journal, volume, first page
			    		var jtitle = jsonpath.query(json, '$..title[?(@.level=="j")]');
						console.log(jtitle);    		
			    		var volume = jsonpath.query(json, '$..biblScope[?(@.unit=="volume")]');
			    		console.log(volume);
			    		var firstPage = jsonpath.query(json, '$..biblScope[?(@.unit=="page")].from');
			    		console.lof(firstPage);

			    		// send the usable queries to the disambiguation service with async
			    		async.waterfall([
			    			function matchRawCitationString(callback) {

                			},
                			function matchTitleAuthor(callback) {

                			},
                			function matchJournalVolumePage() {

                			}
                		], (err, results) => {
				            if (err) {
				                console.log('DOI matching error: ' + err);
				            }

				            // do something with the DOI + ark found, if any


				        });


			    	}
			    }
			}
		    callback();
		});
	}

}

function injectDOI(options) {
	var q = async.queue(function (istexId, callback) {
	  	matchDOI(options, istexId, callback);
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
    options.glutton_host = config.glutton_host;
    options.glutton_port = config.glutton_port;

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
    injectDOI(options);
}

main();