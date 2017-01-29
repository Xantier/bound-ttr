const connectionInfo = require('../properties.json').db;
const pgp = require('pg-promise')();
const postgres = pgp(connectionInfo);

module.exports.query = function (query, params, callback) {
  postgres
      .query(query, params)
      .then((result) => {
        callback(result);
      })
      .catch((err) => {
        console.error(err.message);
        return;
      });
};

module.exports.transaction = function (query, params, callback) {
  postgres
      .query(query, params)
      .then((result) => {
        callback(result);
      })
      .catch((err) => {
        console.error(err.message);
        return;
      });
};
