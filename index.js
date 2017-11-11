const sqlite3 = require('sqlite3').verbose(),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      Promise = require("bluebird"),
      async = require('asyncawait/async'),
      await = require('asyncawait/await'),
      rp = require('request-promise'),
      fs = Promise.promisifyAll(require('fs')); // adds Async() versions that return promises

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

var db = new sqlite3.Database('./db/database.db');
      
app = express();


// ROUTES
app.get('/films/:id/recommendations',  getFilmRecommendations);

  // STEPS: 
  // get the one result genre
  // then call db to get other films of same genre
  // then call the 3rd party for each film
  // filter on >5 reviews, >4 stars and add to list
  // take list and then call db again to get the additional missing fields
  //  return the resulting object
  
async function getFilmRecommendations(req, res, next) {
  // "10302";
  let id = req.params.id;
  let date = await getReleaseDate(id);
  let relatedFilmsArray = [];
  relatedFilmsArray = await makeDBcall(id,date[0]);
  console.log(`relatedFilmsArray.length: ${relatedFilmsArray.length}`);
  
  // console.log(`Printing list of ids`);
  // relatedFilmsArray.forEach(function(element) {
  // console.log('e:' + element.id);
  // });

  let filteredObjects =  await filterOutFilms(relatedFilmsArray);

  let responseObject = await addTitleReleaseDateAndGenre(filteredObjects);

  res.json(responseObject);
};

async function makeDBcall(id,date){
  console.log(`Start makeDBcall().`)
  return new Promise(function (resolve, reject) {
    let responseObj;
    console.log("date.release_date: " + date.release_date);
    // let sql = `SELECT "id" FROM films WHERE "release_date" BETWEEN date("1984-11-17","-15 years") AND date("1999-11-17", "+15 years") AND "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = "10164")`;
    db.all(`SELECT "id" FROM films WHERE "release_date" BETWEEN date("${date.release_date}","-15 years") AND date("${date.release_date}", "+15 years") AND "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = "${id}")`,
      function cb(err, rows) {
      if (err) {
        responseObj = {
          'error': err
        };
        reject(responseObj);
      } else {
        responseObj = {
          rows: rows
        };
        // console.log("makeDBcall() repsonseObj.rows" + JSON.stringify(responseObj.rows));
        resolve(responseObj.rows);
      }
      db.close();
    });
  });
}

async function getReleaseDate(id){
  console.log("Starting getReleaseDate().")
  let sql = `SELECT "release_date" FROM films WHERE "id" = ?`;
  return new Promise(function (resolve, reject) {
    let responseObj;
    db.all(sql, id, function cb(err, rows) {
      if (err) {
        responseObj = {
          'error': err
        };
        reject(responseObj);
      } else {
        responseObj = {
          rows: rows
        };
        console.log("getReleaseDate() repsonseObj.rows" + JSON.stringify(responseObj.rows));
        resolve(responseObj.rows);
      }
    });
  });
}

async function filterOutFilms(relatedFilmsArray){
  console.log(`Starting filterOutFilms.`)
  relatedFilmsCSV = relatedFilmsArray.map(function(elem){
      return elem.id;
  }).join(",");
  // console.log(`----relatedFilmsCSV: ${relatedFilmsCSV}`)
  let results = []

  await makeCallToGetFilmReviews(relatedFilmsCSV)
    .then(function(response) {
      results = response;
    }).catch(function (err) {
      // Deal with the error
    }
  );

  results = await filterByNumberRatingsAndNumberOfReview(results);
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

function filterByNumberRatingsAndNumberOfReview(results){
  console.log(`Starting filterByNumberRatingsAndNumberOfReview.`);
  filteredResults = [];
  for (var i = 0, len = results.length; i < len; i++) {
    averageRating = calculateAverageRating(results[i].reviews);
    console.log(averageRating);
    if(results[i].reviews.length >= 5 && averageRating >= 4){
      results[i].averageRating = averageRating;
      results[i].reviews = results[i].reviews.length;
      results[i].id = results[i].film_id;
      delete results[i].film_id;
      filteredResults.push(results[i]);
    }
  }
  console.log(`filteredResults: ${filteredResults.length} ${filteredResults.toString()}`)
  return filteredResults;
}

function calculateAverageRating(results){
  sumOfRating = 0;
  for (var i = 0, len = results.length; i < len; i++) {
    // console.log(results.rating);
    sumOfRating = sumOfRating + results[i].rating;
  }
  return (sumOfRating/results.length).toFixed(2);
};

async function addTitleReleaseDateAndGenre(filteredObjects){
return filteredObjects;
};

// START SERVER
Promise.resolve()
.then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
.catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

module.exports = app;




  