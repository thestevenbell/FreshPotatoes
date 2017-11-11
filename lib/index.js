'use strict';

let getFilmRecommendations = (() => {
  var _ref = _asyncToGenerator(function* (req, res, next) {
    let id = req.params.id;
    console.log(`ID:` + id);
    if (!areValidQueryParameters(id)) {
      console.log(`validating ID: ${id}`);
      return res.status(422).json({ message: "Invalid id parameter.  Only an integer is allowed." });
    };
    let limit = req.query.limit;
    console.log(limit);
    let offset = req.query.offset;
    console.log(offset);
    if (!areValidQueryParameters(limit)) {
      console.log(`validating limit: ${limit}`);
      return res.status(422).json({ message: "Invalid limit query.  Only an integer is allowed." });
    };
    if (!areValidQueryParameters(offset)) {
      console.log(`validating offset: ${offset}`);
      return res.status(422).json({ message: "Invalid offset query.  Only an integer is allowed." });
    };
    let date;
    let genre;
    try {
      date = yield getReleaseDate(id);
      genre = yield getGenre(id);
    } catch (err) {
      return res.status(404).json({ message: `The film_id ${id} was not found.` });
    }
    console.log(`date.releaseDate: ${date.releaseDate}`);
    let relatedFilmsArray = [];
    relatedFilmsArray = yield makeDBcall(id, date.releaseDate);
    console.log(`relatedFilmsArray.length: ${relatedFilmsArray.length}`);
    let filteredObjects = yield filterOutFilms(relatedFilmsArray, genre);
    let finalListOfObjectsLimitedAndOffset = limitAndOffsetResults((yield addTitleReleaseDateAndGenre(filteredObjects)), limit, offset);
    let responseObject = {
      recommendations: finalListOfObjectsLimitedAndOffset,
      meta: yield meta(limit, offset)
    };
    return res.status(200).json(responseObject);
  });

  return function getFilmRecommendations(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();

let makeDBcall = (() => {
  var _ref2 = _asyncToGenerator(function* (id, date) {
    console.log(`Start makeDBcall().`);
    return new Promise(function (resolve, reject) {
      let responseObj;
      console.log("date.release_date: " + date);
      // let sql = `SELECT "id" FROM films WHERE "release_date" BETWEEN date("1984-11-17","-15 years") AND date("1999-11-17", "+15 years") AND "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = "10164")`;
      db.all(`SELECT "id" FROM films WHERE "release_date" BETWEEN date(?,"-15 years") AND date(?, "+15 years") AND "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = ?)`, date, date, id, function cb(err, rows) {
        if (err) {
          let message = `The film_id ${id} was not found.`;
          responseObj = {
            message: message
          };
          console.log(`ERROR: ${responseObj.message}.`);
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
  });

  return function makeDBcall(_x4, _x5) {
    return _ref2.apply(this, arguments);
  };
})();

let getReleaseDate = (() => {
  var _ref3 = _asyncToGenerator(function* (id) {
    console.log("Starting getReleaseDate().");
    let sql = `SELECT "release_date" FROM films WHERE "id" = ?`;
    let message = `The film_id ${id} was not found.`;
    return new Promise(function (resolve, reject) {
      let responseObj;
      db.all(sql, id, function cb(err, rows) {
        if (err) {
          responseObj = {
            message: message
          };
          console.log(`getReleaseDate() ERROR: ${responseObj.message}.`);
          reject(responseObj);
        } else {
          if (rows.length === 0) {
            responseObj = {
              message: message
            };
            console.log(`getReleaseDate() ERROR: ${responseObj.message}.`);
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
  });

  return function getReleaseDate(_x6) {
    return _ref3.apply(this, arguments);
  };
})();

let getGenre = (() => {
  var _ref4 = _asyncToGenerator(function* (id) {
    console.log("Starting getGenre().");
    let sql = `SELECT "name" FROM genres WHERE "id" = (SELECT "genre_id" FROM films WHERE "id" = ?)`;
    let message = `The film_id ${id} was not found.`;
    return new Promise(function (resolve, reject) {
      let responseObj;
      db.all(sql, id, function cb(err, rows) {
        if (err) {
          responseObj = {
            message: message
          };
          console.log(`getGenre() ERROR: ${responseObj.message}.`);
          reject(responseObj);
        } else {
          if (rows.length === 0) {
            responseObj = {
              message: message
            };
            console.log(`getGenre() ERROR: ${responseObj.message}.`);
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
  });

  return function getGenre(_x7) {
    return _ref4.apply(this, arguments);
  };
})();

let getTitleReleaseDate = (() => {
  var _ref5 = _asyncToGenerator(function* (id) {
    console.log("Starting getTitleReleaseDate().");
    let sql = `SELECT "title", "release_date" FROM films WHERE "id" = ?`;
    return new Promise(function (resolve, reject) {
      let responseObj;
      db.all(sql, id, function cb(err, rows) {
        if (err) {
          responseObj = {
            'error': err
          };
          console.log(`ERROR: ${responseObj.error}.`);
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
  });

  return function getTitleReleaseDate(_x8) {
    return _ref5.apply(this, arguments);
  };
})();

let filterOutFilms = (() => {
  var _ref6 = _asyncToGenerator(function* (relatedFilmsArray, genre) {
    console.log(`Starting filterOutFilms.`);
    let relatedFilmsCSV = relatedFilmsArray.map(function (elem) {
      return elem.id;
    }).join(",");
    // console.log(`----relatedFilmsCSV: ${relatedFilmsCSV}`)
    let results = [];
    yield makeCallToGetFilmReviews(relatedFilmsCSV).then(function (response) {
      results = response;
    }).catch(function (err) {
      // TODO
      // Deal with the error
    });
    results = yield filterByNumberRatingsAndNumberOfReview(results, genre);
    return results;
  });

  return function filterOutFilms(_x9, _x10) {
    return _ref6.apply(this, arguments);
  };
})();

let makeCallToGetFilmReviews = (() => {
  var _ref7 = _asyncToGenerator(function* (relatedFilmsCSV) {
    const options = {
      method: 'GET',
      uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1`,
      json: true,
      qs: {
        films: relatedFilmsCSV
      }
    };
    return rp(options);
  });

  return function makeCallToGetFilmReviews(_x11) {
    return _ref7.apply(this, arguments);
  };
})();

//TODO 
let addTitleReleaseDateAndGenre = (() => {
  var _ref8 = _asyncToGenerator(function* (filteredObjects) {
    console.log(`Starting addTitleReleaseDate()`);
    for (let [index, value] of filteredObjects.entries()) {
      console.log(`VALUE: ${value.id} and INDEX: ${index}`);
      let titleAndDate = yield getTitleReleaseDate(value.id);
      filteredObjects[index].title = titleAndDate[0].title;
      filteredObjects[index].releaseDate = titleAndDate[0].release_date;
    }
    return filteredObjects;
  });

  return function addTitleReleaseDateAndGenre(_x12) {
    return _ref8.apply(this, arguments);
  };
})();

// TODO
let meta = (() => {
  var _ref9 = _asyncToGenerator(function* (limit, offset) {
    if (limit == undefined) {
      limit = 10;
    }
    if (offset == undefined) {
      offset = 0;
    }
    return { limit: limit, offset: offset };
  });

  return function meta(_x13, _x14) {
    return _ref9.apply(this, arguments);
  };
})();

// START SERVER


function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const sqlite3 = require('sqlite3').verbose(),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      Promise = require("bluebird"),
      rp = require('request-promise'),
      fs = Promise.promisifyAll(require('fs')); // adds Async() versions that return promises

const { PORT = 3000, NODE_ENV = 'development', DB_PATH = './db/database.db' } = process.env;

var db = new sqlite3.Database('./db/database.db');

var app = express();

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

;

function areValidQueryParameters(param) {
  let regex = new RegExp('^\\d+$');
  if (param == undefined) {
    return true;
  }
  if (regex.test(param)) {
    console.log(`VALID param: ${param}`);
    return true;
  }
  console.log(`INVALID param: ${param}`);
  return false;
}

;

function filterByNumberRatingsAndNumberOfReview(results, genre) {
  console.log(`Starting filterByNumberRatingsAndNumberOfReview.`);
  let filteredResults = [];
  for (var i = 0, len = results.length; i < len; i++) {
    let averageRating = calculateAverageRating(results[i].reviews);
    // console.log(averageRating);
    if (results[i].reviews.length >= 5 && averageRating >= 4) {
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

function calculateAverageRating(results) {
  let sumOfRating = 0;
  for (var i = 0, len = results.length; i < len; i++) {
    // console.log(results.rating);
    sumOfRating = sumOfRating + results[i].rating;
  }
  return parseFloat((sumOfRating / results.length).toFixed(2));
};;

function limitAndOffsetResults(listOfResults, limit, offset) {
  // TODO - need to handle limit and offset case.  
  if (limit !== undefined) {
    let listLength = listOfResults.length;
    if (listLength > limit) {
      let numberOfElementsToRemove = listLength - limit;
      while (numberOfElementsToRemove > 0) {
        numberOfElementsToRemove--;
        console.log(listOfResults.length);
        listOfResults.splice(listOfResults.length - 1);
      }
    }
  }

  if (offset !== undefined) {
    let shiftCounter = parseInt(offset);
    while (shiftCounter > 0) {
      shiftCounter--;
      listOfResults.shift();
    }
  }

  return listOfResults;
}Promise.resolve().then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`))).catch(err => {
  if (NODE_ENV === 'development') console.error(err.stack);
});

app.use(function (req, res, next) {
  res.status(404).json({ message: 'Route not found.' });
});

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send({ message: err.message });
});

module.exports = app;

//# sourceMappingURL=index.js.map