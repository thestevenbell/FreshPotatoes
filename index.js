const sqlite3 = require('sqlite3').verbose(),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      Promise = require("bluebird"),
      rp = require('request-promise'),
      fs = Promise.promisifyAll(require('fs')); // adds Async() versions that return promises

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

var db = new sqlite3.Database('./db/database.db');
      
var app = express();

// ROUTES
app.get('/films/:id/recommendations',  getFilmRecommendations);
  
async function getFilmRecommendations(req, res, next) {
  let id = req.params.id;
  console.log(`ID:`  + id);
  if(!areValidQueryParameters(id)){
    console.log(`validating ID: ${id}`);
    return res.status(422).json({message: "Invalid id parameter.  Only an integer is allowed."});
  };
  let limit = req.query.limit;
  console.log(limit);
  let offset = req.query.offset;
  console.log(offset);
  if(!areValidQueryParameters(limit)){
    console.log(`validating limit: ${limit}`);
    return res.status(422).json({message: "Invalid limit query.  Only an integer is allowed."});
  };
  if(!areValidQueryParameters(offset)){
    console.log(`validating offset: ${offset}`);
    return res.status(422).json({message: "Invalid offset query.  Only an integer is allowed."});
  };
  let date;
  let genre;
  try{
    date = await getReleaseDate(id); 
    genre = await getGenre(id);
  }catch(err){
    return res.status(404).json({message: `The film_id ${id} was not found.`});
  }
  console.log(`date.releaseDate: ${date.releaseDate}`);
  let relatedFilmsArray = [];
  relatedFilmsArray = await makeDBcall(id,date.releaseDate);
  console.log(`relatedFilmsArray.length: ${relatedFilmsArray.length}`);
  let filteredObjects =  await filterOutFilms(relatedFilmsArray, genre);
  let finalListOfObjectsLimitedAndOffset = 
      limitAndOffsetResults( await addTitleReleaseDateAndGenre(filteredObjects), limit, offset);
  let responseObject = 
  {
    recommendations: finalListOfObjectsLimitedAndOffset,
    meta: await meta(limit, offset)
  };
  return res.status(200).json(responseObject);
};

function areValidQueryParameters(param){
  let regex = new RegExp('^\\d+$');
  if(param == undefined){
    return true;
  }
  if(regex.test(param)){
    console.log(`VALID param: ${param}`);
      return true;
    }
  console.log(`INVALID param: ${param}`);
  return false;
}

async function makeDBcall(id,date){
  console.log(`Start makeDBcall().`)
  return new Promise(function (resolve, reject) {
    let responseObj;
    console.log("date.release_date: " + date);
    // let sql = `SELECT "id" FROM films WHERE "release_date" BETWEEN date("1984-11-17","-15 years") AND date("1999-11-17", "+15 years") AND "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = "10164")`;
    db.all(`SELECT "id" FROM films WHERE "release_date" BETWEEN date(?,"-15 years") AND date(?, "+15 years") AND "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = ?)`,
      date,
      date,
      id,
      function cb(err, rows) {
      if (err) {
        let message = `The film_id ${id} was not found.`
        responseObj = {
          message: message
        };
        console.log(`ERROR: ${responseObj.message}.`)
        reject(responseObj);
      } else {
        responseObj = {
          rows: rows
        };
        // console.log("makeDBcall() repsonseObj.rows" + JSON.stringify(responseObj.rows));
        resolve(responseObj.rows);
      }
    });
  });
}

async function getReleaseDate(id){
  console.log("Starting getReleaseDate().")
  let sql = `SELECT "release_date" FROM films WHERE "id" = ?`;
  let message = `The film_id ${id} was not found.`;
  return new Promise(function (resolve, reject) {
    let responseObj;
    db.all(sql, id, function cb(err, rows) {
      if (err) {
        responseObj = {
          message: message
        };
        console.log(`getReleaseDate() ERROR: ${responseObj.message}.`)
        reject(responseObj);
      } else {
        if(rows.length===0){
          responseObj = {
            message: message
          };
          console.log(`getReleaseDate() ERROR: ${responseObj.message}.`)
          reject(new Error(responseObj));
        } else { 
          responseObj = {
            releaseDate: rows[0].release_date
          };
          console.log("getReleaseDate() repsonseObj.rows length: " + rows.length + ` string: ` + JSON.stringify(responseObj.releaseDate));
        }
        resolve(responseObj);
      }
    });
  });
}

async function getGenre(id){
  console.log("Starting getGenre().")
  let sql = `SELECT "name" FROM genres WHERE "id" = (SELECT "genre_id" FROM films WHERE "id" = ?)`;
  let message = `The film_id ${id} was not found.`;
  return new Promise(function (resolve, reject) {
    let responseObj;
    db.all(sql, id, function cb(err, rows) {
      if (err) {
        responseObj = {
          message: message
        };
        console.log(`getGenre() ERROR: ${responseObj.message}.`)
        reject(responseObj);
      } else {
        if(rows.length===0){
          responseObj = {
            message: message
          };
          console.log(`getGenre() ERROR: ${responseObj.message}.`)
          reject(new Error(responseObj));
        } else { 
          responseObj = {
            name: rows[0].name
          };
          console.log(`getGenre() repsonseObj.rows` + JSON.stringify(responseObj.name));
        }
        resolve(responseObj);
      }
    });
  });
}

async function getTitleReleaseDate(id){
  console.log("Starting getTitleReleaseDate().")
  let sql = `SELECT "title", "release_date" FROM films WHERE "id" = ?`;
  return new Promise(function (resolve, reject) {
    let responseObj;
    db.all(sql, id, function cb(err, rows) {
      if (err) {
        responseObj = {
          'error': err
        };
        console.log(`ERROR: ${responseObj.error}.`)
        reject(responseObj);
      } else {
        responseObj = {
          rows: rows
        };
        console.log("getTitleReleaseDate() repsonseObj.rows" + JSON.stringify(responseObj.rows));
        resolve(responseObj.rows);
      }
    });
  });
  db.close();
}

async function filterOutFilms(relatedFilmsArray, genre){
  console.log(`Starting filterOutFilms.`)
  let relatedFilmsCSV = relatedFilmsArray.map(function(elem){
      return elem.id;
  }).join(",");
  // console.log(`----relatedFilmsCSV: ${relatedFilmsCSV}`)
  let results = [];
  await makeCallToGetFilmReviews(relatedFilmsCSV)
    .then(function(response) {
      results = response;
    }).catch(function (err) {
      // TODO
      // Deal with the error
    }
  );
  results = await filterByNumberRatingsAndNumberOfReview(results, genre);
  return results;
};

async function makeCallToGetFilmReviews(relatedFilmsCSV){
  const options = {
    method: 'GET',
    uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1`,
    json: true,
    qs: {
      films: relatedFilmsCSV
    } 
  }
  return rp(options);
}

function filterByNumberRatingsAndNumberOfReview(results, genre){
  console.log(`Starting filterByNumberRatingsAndNumberOfReview.`);
  let filteredResults = [];
  for (var i = 0, len = results.length; i < len; i++) {
    let averageRating = calculateAverageRating(results[i].reviews);
    // console.log(averageRating);
    if(results[i].reviews.length >= 5 && averageRating >= 4){
      results[i].id = results[i].film_id;
      results[i].title = '';
      results[i].releaseDate = ''; 
      results[i].genre = genre.name;
      results[i].averageRating = averageRating;
      results[i].reviews = results[i].reviews.length;
      delete results[i].film_id;
      filteredResults.push(results[i]);
    }
  }
  // console.log(`filteredResults: ${filteredResults.length} ${filteredResults.toString()}`)
  return filteredResults;
}

function calculateAverageRating(results){
  let sumOfRating = 0;
  for (var i = 0, len = results.length; i < len; i++) {
    // console.log(results.rating);
    sumOfRating = sumOfRating + results[i].rating;
  }
  return parseFloat((sumOfRating/results.length).toFixed(2));
};

//TODO 
async function addTitleReleaseDateAndGenre(filteredObjects){
  console.log(`Starting addTitleReleaseDate()`);
  for (let [index,value] of filteredObjects.entries()) {
    console.log(`VALUE: ${value.id} and INDEX: ${index}`);
    let titleAndDate = await getTitleReleaseDate(value.id);
    filteredObjects[index].title = titleAndDate[0].title;
    filteredObjects[index].releaseDate = titleAndDate[0].release_date; 
  }
  return filteredObjects;
};

function limitAndOffsetResults(listOfResults, limit, offset){
  // TODO - need to handle limit and offset case.  
  if(limit !== undefined){
    let listLength = listOfResults.length;
    if(listLength>limit){
      let numberOfElementsToRemove = listLength - limit;
      while(numberOfElementsToRemove>0){
        numberOfElementsToRemove--;
        console.log(listOfResults.length);
        listOfResults.splice(listOfResults.length-1);
      }
    }
  }

  if(offset !== undefined){
    let shiftCounter = parseInt(offset);
    while(shiftCounter>0){
      shiftCounter--;
      listOfResults.shift();
    }
  }
  

  return listOfResults;
 }

// TODO
async function meta(limit, offset){
  if(limit == undefined){
    limit = 10;
  }
  if (offset == undefined){
    offset = 0;
  }
  return { limit: limit, offset: offset};
}

// START SERVER
Promise.resolve()
.then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
.catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

app.use(function (req, res, next) {
  res.status(404).json({message: 'Route not found.'});
})

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send({message: err.message})
})

module.exports = app;




  