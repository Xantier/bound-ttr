const postgres = require('./postgresManager');
const fs = require('fs');
const readline = require('readline');
const async = require('async');

module.exports.assertionQuery = function (path, testcase, callback) {
  const queries = [];
  testcase.db.forEach((dbConf) => {
    queries.push((cb) => {
      const dbQuery = fs.readFileSync(path + '/' + dbConf.query, 'utf8');
      const dbExpected = [];

      const lineReader = readline.createInterface({
        input: fs.createReadStream(path + '/' + dbConf.results, 'utf8')
      });
      lineReader.on('line', (line) => {
        dbExpected.push(line);
      });
      lineReader.on('close', () => {
        postgres.query(dbQuery, dbConf.variables, (result) => {
          assertQueryResults(result, dbExpected, cb, testcase);
        });
      });
    });
  });
  async.series(queries, (err, res) => {
    let good = true;
    res.forEach((result) => {
      if (!result[1]) {
        good = false;
      }
    });
    callback(null, good, testcase);
  });

};

module.exports.setupQuery = function (path, queryFile, callback) {
  const dbQuery = fs.readFileSync(path + '/' + queryFile, 'utf8');
  postgres.transaction(dbQuery, [], callback);
};
module.exports.tearDownQuery = module.exports.setupQuery;

function assertQueryResults(result, dbExpected, cb, testcase) {
  let good = true;
  result.forEach((row, idx) => {
    console.log('Excpected: ' + dbExpected[idx]);
    const values = Object.keys(row).map((key) => {
      return row[key];
    });
    console.log('Result: ' + values);
    if (dbExpected[idx] == values) {
      console.log('DB query assertion successful for row ' + idx);
    } else {
      console.log('DB query result DOES NOT MATCH expected for row ' + idx);
      good = false
    }
  });
  cb(null, testcase, good);
}