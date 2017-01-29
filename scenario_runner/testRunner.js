const Newman = require('newman');
const JSON5 = require('json5');
const fs = require('fs');
const dir = require('node-dir');
const async = require('async');
const builder = require('junit-report-builder');

const db = require('./lib/db');
const postmanEnvironment = require('./lib/postmanEnvironment');
const argv = require('minimist')(process.argv.slice(2));

dir.subdirs('scenarios', (err, subdirs) => {
  if (err) {
    throw err;
  }
  subdirs.forEach((path) => {
    runScenario(path);
  });
});

function runScenario(path) {
  if (argv.silent) {
    const access = fs.createWriteStream(path + '/testcase.log');
    process.stdout.write = process.stderr.write = access.write.bind(access);
  }

  const scenario = JSON5.parse(fs.readFileSync(path + '/collection.json', 'utf8'));
  const testdata = JSON.parse(fs.readFileSync(path + '/testdata.json', 'utf8'));

  const funcs = [];
  if (testdata.setup) {
    funcs.push((callback) => {
      console.log('Setting Up.');
      db.setupQuery(path, testdata.setup, () => {
        console.log('Set up');
        callback();
      });
    });
  }
  funcs.push((callback) => {
    runTestCases(testdata, scenario, path, callback);
  });
  if (testdata.tearDown) {
    funcs.push((callback) => {
      console.log('Tearing down');
      db.tearDownQuery(path, testdata.tearDown, () => {
        console.log('Torn Down');
        callback();
      });
    });
  }
  if (testdata.disabled !== true) {
    async.series(funcs, (err, results) => {
      if (err) {
        console.log('FAILED TO RUN scenario ' + path + '. Something wrong with the test framework?');
        console.log(err);
      }
      const suite = builder.testSuite().name(path);
      results.filter((it) => it !== undefined)
          .reduce((a, b) => a.concat(b), [])
          .forEach((res) => {
            const testCase = suite.testCase()
                .className(path)
                .name(res[1].testcase.name);
            if (res[0] > 0) {
              testCase.failure();
            }
          });
      console.log('Writing JUnit Test report');
      builder.writeTo(path + '/test-report.xml');
    });
  } else {
    console.log('Skipping scenario ' + path + '. Tags not matching.');
  }
}

function runTestCases(testdata, scenario, path, cb) {
  const iterations = [];
  testdata.testCases.forEach((testcase) => {
    if (testcase.disabled !== true && matchesTags(testcase)) {
      iterations.push((callback) => {
        const environment = postmanEnvironment(Object.assign({}, testcase.variables, testcase.assertions));
        const newmanOptions = {
          environment: environment,
          responseHandler: "TestResponseHandler",
          asLibrary: true,
          bail: true,
          collection: scenario
        };
        Newman.run(newmanOptions, (err, result) => {
          if (err) {
            console.log(err);
            callback(err, null, testcase);
          }
          if (testcase.db) {
            db.assertionQuery(path, testcase, (err, res) => {
              if (res) {
                callback(null, result, {testcase: testcase});
              } else {
                callback(1, null, testcase);
              }
            });
          } else {
            callback(null, result, {testcase: testcase});
          }
        }).on('start', (err, args) => {
          console.log('running a collection...');
        }).on('done', (err, summary) => {
          if (err || summary.error) {
            console.error('collection run encountered an error.');
          } else {
            console.log('collection run completed.');
          }
        });
      });
    } else {
      console.log('Skipping testcase ' + testcase.name + '. Tags not matching.');
    }
  });
  async.series(iterations, (err, results) => {
    const failed = results
        .reduce((a, b) => a.concat(b), [])
        .filter((it) => it !== undefined && it !== null && it.testcase === undefined)
        .filter((it) => it.run.failures && it.run.failures.length > 0)
        .map((it, idx) => {
          console.log(it.run);
          console.log('-------');
          return {idx: idx};
        });
    if (failed.length > 0) {
      console.log(failed.length + ' failed testcase(s) for scenario ' + path + '.\n Failed test case indexes:');
      failed.forEach((it) => {
        console.log(it.idx);
      });
    } else {
      console.log('All testcases executed successfully for scenario ' + path);
    }
    cb(err, results);
  });
}

function matchesTags(testdata) {
  let run = true;
  if (argv.tags) {
    run = false;
    if (testdata.tags) {
      testdata.tags.forEach((tag) => {
        argv.tags.split(',').forEach((arg) => {
          console.log(tag);
          console.log(arg);
          if (tag === arg) {
            run = true;
          }
        })
      });
    }
  }
  return run;
}