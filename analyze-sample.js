 'use strict';

/* Module Require */
const mkdirp = require('mkdirp'),
    request = require('request'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    https = require ('https'),
    readline = require('readline'),
    zlib = require('zlib'),
    xpath = require('xpath'),
	dom = require('xmldom').DOMParser;


// for making console output less boring
const green = '\x1b[32m';
const red = '\x1b[31m';
const orange = '\x1b[33m';
const white = '\x1b[37m';
const blue = `\x1b[34m`;
const score = '\x1b[7m';
const bright = "\x1b[1m";
const reset = '\x1b[0m';

// register information for all the document from the sample
var records = []

function analyzeFile(options, istexId, callback) {
	// read the full text TEI produced by GROBID - if any

	var resourcePath = options.outPath+"/"+
                                istexId[0]+"/"+
                                istexId[1]+"/"+
                                istexId[2]+"/"+
                                istexId+"/";

    var teiGrobidFullTextFilePath = resourcePath + 'enrichment/istex-grobid-fulltext/' + istexId + ".tei.xml";
    var teiFulltextFilePath = resourcePath + 'fulltext/' + istexId + ".tei.xml";

    async.waterfall([

    	function processTeiFulltext(callb) {
		    if (!fs.existsSync(teiFulltextFilePath)) {
		    	console.log("TEI fulltext file does not exist: " + teiFulltextFilePath)
		    	//if (callback)
		 		//   	return callback();
		 		callb(null, 0);
			} else {
			    var rstream = fs.createReadStream(teiFulltextFilePath);
			    var body = ""
			    rstream.on('data', function(chunk) {
			    	body += chunk;
			    });
			    rstream.on('end', function (err) {
				    if (err) { 
				    	console.log('error reading TEI fulltext file', err)
				        return callb(null, null);
				    } 

				    // we just keep the fileDesc 
				    var ind1 = body.indexOf("<teiHeader");
				    var ind2 = body.indexOf("</teiHeader>");
				    //var ind1 = body.indexOf("<fileDesc");
				    //var ind2 = body.indexOf("</fileDesc>");
				    if (ind1 == -1 || ind2 == -1)
				    	console.log("Invalid TEI, no tei header!");

				    var header = body.substring(ind1, ind2+12);

				    // grab the date, publisher, document type
				    const doc = new dom().parseFromString(header);
			   	
		    		// date
		    		var date = xpath.select('//date[@type="published"]/@when', doc);
		    		if (date && date.length > 0) {
		    			// just grab the value
		    			date = date[0].textContent;
		 		   		// we keep just the year
		 		   		var ind = date.indexOf("-");
		 		   		if (ind != -1)
		 		   			date = date.substring(0, ind);
		    		} else
		    			date = "";

		    		// publisher
		    		var publisher = "";
		    		var publishers = xpath.select('//publisher//text()', doc);
		    		//var publishers = select('//availability/p', doc);
		    		if (publishers && publishers.length > 0) {
		    			var i = 0;
		    			while((publisher.length == 0) && i<publishers.length) {
			    			publisher = publishers[i].textContent;
			    			i++;
		    			}
		    		} 

		    		if (publisher.length == 0) {
			    		publishers = xpath.select('//publisher', doc);
			    		//var publishers = select('//availability/p', doc);
			    		if (publishers && publishers.length > 0) {
			    			var i = 0;
			    			while((publisher.length == 0) && i<publishers.length) {
				    			publisher = publishers[i].textContent;
				    			i++;
			    			}
			    		}
			    	} 
			    	if (publisher.length == 0) {
			    		// if publisher nodes still empty, there's an obscure problem with xpath,
			    		// and we need to grab them directly on the string
			    		var ind1 = header.indexOf("<publisher>");
			    		if (ind1 != -1) {
			    			var ind2 = header.indexOf("</publisher>", ind1+1);
			    			if (ind2 != -1) {
			    				publisher = header.substring(ind1+11, ind2);
			    			}
			    		}
			    	}

		    		// document type
		    		var allDocType = [];
					var docTypes = xpath.select('//notesStmt/note/@type', doc);
		    		if (docTypes && docTypes.length > 0) {
		    			for(var docType in docTypes) {
		    				if (docTypes[docType].textContent !== "content" &&
		    					docTypes[docType].textContent !== "content-type" && 
		    					docTypes[docType].textContent !== "publication-type") {
		    					if (!allDocType.includes(docTypes[docType].textContent))
				    				allDocType.push(docTypes[docType].textContent);
		    				} else {
		    					var docSubTypes = xpath.select('//notesStmt/note/@subtype', doc);
					    		if (docSubTypes && docSubTypes.length > 0) {
					    			for(var docSubType in docSubTypes) {
					    				if (!allDocType.includes(docSubTypes[docSubType].textContent))
						    				allDocType.push(docSubTypes[docSubType].textContent);
					    			}
					    		}
					    	}
		    			}
		    		} 
		    		if (allDocType.length == 0) {
		    			var ind = body.indexOf("type=\"research-article");
		    			if (ind != -1) {
		    				allDocType.push("research-article");
		    			}
		    			ind = body.indexOf("type=\"brief-communication");
		    			if (ind != -1) {
		    				allDocType.push("brief-communication");
		    			}
		    			ind = body.indexOf("type=\"article");
		    			if (ind != -1) {
		    				allDocType.push("article");
		    			}
		    		}

				    var entry = {
				    	id: istexId,
				    	date: date,
				    	publisher: publisher,
				    	docTypes: allDocType
				    } 

				    records.push(entry);

				    //if (callback)
		 		   	//	callback();
		 		   	callb(null, records);
				});
			}
		},

		function processTeiGrobidFullText(records, callb) {

		    if (!fs.existsSync(teiGrobidFullTextFilePath)) {
		    	console.log("GROBID file does not exist: " + teiGrobidFullTextFilePath)
		    	if (callback)
		 		   	callback();
			} else {
			    var rstream = fs.createReadStream(teiGrobidFullTextFilePath);
			    var body = ""
			    rstream.on('data', function(chunk) {
			    	body += chunk;
			    });
			    rstream.on('end', function (err) {
				    if (err) { 
				    	console.log('error reading grobid tei file', err)
				    } 

		    		//console.log(body);
				    const doc = new dom().parseFromString(body);
			   	
		    		// check for abstract
		    		var abstract = xpath.select('string(//abstract)', doc);
		    		if (abstract && abstract.length > 0) {
		    			// just grab the value
		    			abstract = abstract[0].textContent;
		    		} else
		    			abstract = "";
		    		
		    		if (abstract === "") {
			    		var ind1 = body.indexOf("<abstract>");
			    		if (ind1 != -1) {
			    			var ind2 = body.indexOf("</abstract>");
			    			if (ind2 != -1) {
			    				//console.log(ind1, ind2);
			    				abstract = body.substring(ind1+11, ind2);
			    			}
			    		}
			    	}

			    	// check for keywords
					var keywords = xpath.select('string(//keywords)', doc);
		    		if (keywords && keywords.length > 0) {
		    			// just grab the value
		    			keywords = keywords[0].textContent;
		    		} else 
		    			keywords = "";
			    	
			    	if (keywords === "") {
			    		ind1 = body.indexOf("<keywords>");
			    		if (ind1 != -1) {
			    			var ind2 = body.indexOf("</keywords>");
			    			if (ind2 != -1) {
			    				//console.log(ind1, ind2);
			    				keywords = body.substring(ind1+11, ind2);
			    			}
			    		}
			    	}

		    		for(var record in records) {
		    			if (records[record].id === istexId) {
		    				records[record].abstract_size = abstract.length;
		    				records[record].keywords_size = keywords.length;
		    			}
		    		}


				    callb(null, records);
				});
			}
		}
	], function (err, results) {
		if (err) {
			console.log(err.message);
			if (callback)
		 		callback();
		}

    	// Here, results is an array of the value from each function
    	//console.log([1]); 

    	if (callback)
		 	callback();
	});


}	


function analyze(options) {
	var q = async.queue(function (istexId, callback) {
	  	analyzeFile(options, istexId, callback);
    }, options.concurrency);

    q.drain = function() {
        console.log(red, "\nall tasks completed!", reset);
        console.log(records.length, "records");
        var csv = [];
        for(var r in records) {
        	if (validRecord(records[r])) {
	        	var line = records[r].id + "\t" + 
	        		records[r].date + "\t" + 
	        		simplifyPublisher(records[r].publisher) + "\t"; 
	        	line += records[r].docTypes[0]+"\t";
	        	if (records[r].docTypes.length == 2)
	        		line += records[r].docTypes[1];
	        	line += "\t";
	        	if (records[r].abstract_size)
		        	line += records[r].abstract_size;
		        line += "\t";
		        if (records[r].keywords_size)
		        	line += records[r].keywords_size;
        		line += "\t";
        		csv.push(line);
        	}
        }
        fs.writeFile("resources/sample-records.csv", csv.join("\n"), function(err) {
	    	if(err) {
	        	return console.log(err);
	    	}

	    	console.log("The records were saved in csv!");
	    }); 

        fs.writeFile("resources/sample-records.json", JSON.stringify(records), function(err) {
	    	if(err) {
	        	return console.log(err);
	    	}

	    	console.log("The records were saved in json!");
	    }); 

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

function validRecord(record) {
	if ( (record.date && record.date !== "") &&
		 (record.publisher && record.publisher !== "") &&
		 (record.docTypes && record.docTypes.length > 0) ) {
		return true;
	} else 
		return false;
}

/**
 * Just put a publisher name into a more easy to read form
 */
function simplifyPublisher(publisher) {
	if (publisher.match(/springer/gi)) {
		publisher = "Springer";
	} else if (publisher.match(/wiley/gi)) {
		publisher = "Wiley";
	} else if (publisher.match(/elsevier/gi)) {
		publisher = "Elsevier";
	} else if (publisher.match(/kluwer/gi)) {
		publisher = "Kluwer";
	} else if (publisher.match(/sage/gi)) {
		publisher = "SAGE";
	} else if (publisher.match(/blackwell/gi)) {
		publisher = "Blackwell";
	} else if (publisher.match(/bmj/gi)) {
		publisher = "BMJ";
	} else if (publisher.match(/emerald/gi)) {
		publisher = "Emerald";
	}

	return publisher;
}

/**
 * Init the main object with paths passed with the command line
 */
function init() {
    var options = new Object();

    // start with the config file
    const config = require('./config.json');
    options.temp_path = config.temp_path;

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
    analyze(options);
}

main();