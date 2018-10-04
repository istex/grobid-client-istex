var request = require('requestretry');

var urls = [ 'https://api.istex.fr/document/?q=*&output=id,corpusName,doi,ark,genre&scroll=1m&size=1000' ]

function getIstexIdsFromOnePage() {
  	var url = urls.pop();
  	request.get({
    	url: url,
    	maxAttempts: 50,   // (default) try 50 times
    	retryDelay: 10000,  // (default) wait for 10s before trying again
    	retryStrategy: request.RetryStrategies.HTTPOrNetworkError 
      // (default) retry on 5xx or network errors
  	}, 
  	function (err, res) {
    	if (err) {
      		console.error(err, url);
      		return;
    	}
    	var json = JSON.parse(res.body);
 		if (json && json.hits) {
      		json.hits.forEach(function (doc) {
	        	var jsonRes = {
	          		corpusName: doc.corpusName,
	          		istexId: doc.id,
                ark: doc.ark,
	          		doi: doc.doi || [],
	          		genre: doc.genre || []
	        	};
            if (isValid(jsonRes))
  	        	  console.log(doc.id);
      		});
    	} else {
      		console.error('json.hits empty ' + url);
      		console.error(json);
    	}
    	if (!json.noMoreScrollResults && json.nextScrollURI) {
      		urls.push(json.nextScrollURI);
    	} else {
      		console.error('no more nextScrollURI ' + url)
    	}
    	setTimeout(function () {
      		getIstexIdsFromOnePage();
		}, 10);
  	});
}

// for sanity check of ISTEX values
var corpusNames = ['elsevier', 'wiley', 'springer-journals', 'oup', 'cambridge', 
               'sage', 'bmj', 'springer-ebooks', 'iop', 'nature', 'rsc-journals',
               'degruyter-journals', 'edp-sciences', 'emerald', 'brill-journals',
               'brepols-journals', 'rsc-ebooks', 'gsl'];

var possibleGenres = ['research-article', 'article', 'other', 'book-reviews', 'abstract', 
          'review-article', 'brief-communication', 'editorial', 'conference',  
          'chapter', 'case-report'];

// check validity of the ISTEX object for full text processing
// this is based on corpus name and document genre (which is actually
// the ISTEX name for the document type)
function isValid(json) {
    corpusName = json.corpusName;

    for (ind in json.genre) {
    genre = json.genre[ind];
    valid = false;

    // sanity check
    //if (!corpusNames.includes(corpusName))
    //    console.error('invalid ISTEX corpus name: ' + corpusName);

    //if (!possibleGenres.includes(genre)) {
    //    console.error('invalid ISTEX genre: ' + genre);
    //} 

    if (corpusName === 'elsevier') {
        if ( (genre === 'research-article') || (genre === 'article') || 
           (genre === 'review-article') || (genre === 'brief-communication') ) {
              valid = true;
        }
    } else if (corpusName == 'wiley') {
        if ((genre === 'brief-communication') || (genre === 'case-report') ) {
            valid = true;
        }
    } else if (corpusName === 'springer-journals') {
        if ( (genre === 'research-article') || (genre === 'brief-communication') ) {
            valid = true;
        }
    } else if (corpusName === 'oup') {
        if ( (genre === 'research-article') || (genre === 'review-article') ||
             (genre === 'brief-communication') || (genre === 'case-report') ) {
            valid = true;
        }
    } else if (corpusName === 'cambridge') {
        if ( (genre === 'research-article') || (genre === 'review-article') ||
             (genre === 'brief-communication') ) {
            valid = true;
        }
    } else if (corpusName === 'sage') {
        if ( (genre === 'research-article') ) {
            valid = true;
        }
    } else if (corpusName === 'bmj') {
        if ( (genre === 'research-article') || (genre === 'case-report') ) {
            valid = true;
        }
    } else if (corpusName === 'springer-ebooks') {
        if ( (genre === 'research-article') || (genre === 'article') ||
             (genre === 'other') || (genre === 'review-article') || 
             (genre === 'conference') || (genre === 'chapter') ) {
            valid = true;
        }
    } else if (corpusName === 'iop') {
        if ( (genre === 'article') || (genre === 'other') || 
             (genre === 'review-article') || (genre === 'brief-communication') ) {
            valid = true;
        }
    } else if (corpusName === 'nature') {
        if ( (genre === 'review-article') || (genre === 'conference') ) {
            valid = true;
        }
    } else if (corpusName === 'rsc-journals') {
        if ( (genre === 'research-article') || (genre === 'article') ||
             (genre === 'other') || (genre === 'review-article') ) {
            valid = true;
        }
    } else if (corpusName === 'degruyter-journals') {
        if ( (genre === 'other') || (genre === 'review-article') ||
             (genre === 'case-report') ) {
            valid = true;
        }
    } else if (corpusName === 'edp-sciences') {
        if ( (genre === 'research-article') || (genre === 'article') ||
             (genre === 'brief-communication') || (genre === 'review-article') ||
             (genre === 'case-report') ) {
            valid = true;
        }
    } else if (corpusName === 'emerald') {
        if ( (genre === 'research-article') || (genre === 'article') ||
             (genre === 'review-article') || (genre === 'case-report') ) {
            valid = true;
        }
    } else if (corpusName === 'brill-journals') {
        if ( (genre === 'review-article') ) {
            valid = true;
        }
    } else if (corpusName === 'rsc-ebooks') {
        if ( (genre === 'research-article') || (genre === 'article') ||
             (genre === 'conference') || (genre === 'chapter') ) {
            valid = true;
        }
    } else if (corpusName === 'gsl') {
        if ( (genre === 'research-article') || (genre === 'review-article') ) {
            valid = true;
        }
    } 

    if (valid)
        return valid;
    }
    return valid;
}

setTimeout(function () {
  	getIstexIdsFromOnePage();
}, 10);
