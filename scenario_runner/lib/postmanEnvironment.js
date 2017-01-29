module.exports = function constructEnvironment(data) {
  const env = {
    "id": "4d74a192-1ca9-53df-0177-7671c90b962d",
    "name": "test env",
    "team": null,
    "timestamp": 1485705660602,
    "synced": false,
    "syncedFilename": "",
    "isDeleted": false,
    "reporters": ['html', 'json'],
    "reporter": {
      "html": {
        "export": './htmlResults.html'
      }
    },
    "values": []
  };
  Object.keys(data).forEach((k) => {
    env.values.push({
      "key": k,
      "value": data[k],
      "type": 'text',
      "enabled": true
    });
  });
  return env;
};