const sqlite3 = require('sqlite3').verbose(),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      Promise = require("bluebird");
const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

var db = new sqlite3.Database('./db/database.db');
      
app = express();

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations)

  // get the one result genre
  // then call db to get other films of same genre
  // then call the 3rd party for each film
  // filter on >5 reviews, >4 stars and add to list
  //  return the resulting object
function getFilmRecommendations(req, res, next) {
  // "10302";
  let id = req.params.id;
  relatedFilms = [makeDBcall(id)];
  filterOutFilms();
  res.json("results:");
};

function makeDBcall(id){
  console.log("PRINTING ID:" + id)
  let sql = `SELECT "id" FROM films WHERE "genre_id" = (SELECT "genre_id" FROM films WHERE "id" = ?)`;
        
  db.all(sql, id, function(err, rows) {
    rows.forEach(function(row) {
      console.log('row.genre_id:' + row.id);
    }, this);
    
    });
  
  db.close();
}

function filterOutFilms(){

};

// START SERVER
Promise.resolve()
.then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
.catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

module.exports = app;