var _client;

function RVDataDB(client) {
  _client = client;
}

RVDataDB.prototype.changeSingleData = (user_id, data, callback) => {

  // callback(success: boolean)
  // データ更新日が古ければ上書き
  var changeQuery = 'UPDATE returnvisitor_db.rv_data SET class_name = :class_name , updated_at = :updated_at_0, json_data = :json_data WHERE data_id = :data_id AND user_id = :user_id AND updated_at < :updated_at_1;';
  _client.query(changeQuery,
    {
      class_name: data.class_name,
      updated_at_0: data.updated_at,
      json_data: data.data,
      data_id: data.id,
      user_id: user_id,
      updated_at_1: data.updated_at
    },
    (err, rows) => {

    // console.dir(rows);
    // console.dir(err);

    if (rows) {
      if (rows.info.affectedRows == 1) {
        callback(true);
      } else {
        RVDataDB.prototype.insertSingleData(user_id, data, callback);
      }
    }
  });
  _client.end();
}

RVDataDB.prototype.insertSingleData = (user_id, data, callback) => {

  var insertQuery = 'INSERT INTO returnvisitor_db.rv_data (user_id, data_id, class_name, updated_at, json_data) VALUES (:user_id, :data_id, :class_name, :updated_at, :json_data );';
  _client.query(insertQuery,
    {
      user_id: user_id,
      data_id: data.id,
      class_name: data.class_name,
      updated_at: data.updated_at,
      json_data: data.data
    },
    (err, rows) => {
    if (rows) {
      if (rows.info.affectedRows == 1) {
        callback(true);
      } else {
        callback(false);
      }
    }
  });
  _client.end();
};

RVDataDB.prototype.saveSingleData = (user_id, data, callback) => {

  // console.log('saveSingleData called.');

  RVDataDB.prototype.changeSingleData(user_id, data, callback);

}

RVDataDB.prototype.saveDataArray = (user_id, array, callback) => {
  // callback(result)
  // console.log('saveDataArray called.');
  // console.dir(array);

  var updatedDataCount = 0;
  for ( var i = 0 ; i < array.length ; i++ ) {
    RVDataDB.prototype.saveSingleData(user_id, array[i], (result) => {
      if (result) {
        updatedDataCount++;
      }
    });
  }

  var deletedDataCount = 0;
  for ( var i = 0 ; i < array.length ; i++ ) {
    if (array[i].class_name === 'DeletedData') {
      var deletedData = array[i];
      var dataString = deletedData.data;
      // console.log('dataString: ' + dataString);
      dataString = dataString.replace(/\*double_quotes\*/g, '"');
      // console.log('dataString (replaced): ' + dataString);
      var parsedData = JSON.parse(dataString);

      RVDataDB.prototype.deleteSingleData(user_id, parsedData.data_id, (result) => {
        if (result) {
          deletedDataCount++;
        }
      })
    }
  }

  var result = {
    updatedDataCount: updatedDataCount,
    deletedDataCount: deletedDataCount
  }
  // console.dir(result);
  callback(result);

}

RVDataDB.prototype.deleteSingleData = (user_id, data_id, callback) => {
  var deleteDataQuery = 'DELETE FROM returnvisitor_db.rv_data WHERE user_id = :user_id AND data_id = :data_id;';
  _client.query(deleteDataQuery,
    {
      user_id: user_id,
      data_id: data_id
    },
    (err, rows) =>{
    // console.log('err:');
    // console.dir(err);
    // console.log('rows:');
    // console.dir(rows);
    if (rows) {
      if (rows.info.affectedRows >= 1) {
        callback(true);
      }
    } else {
      callback(false);
    }
  });
  _client.end();
}

RVDataDB.prototype.loadDataLaterThanTime = (user_id, time, callback) => {
  // callback(loaded_rows)
  var laterDataQuery = 'SELECT * FROM returnvisitor_db.rv_data WHERE user_id = :user_id AND updated_at > :updated_at;'

  _client.query(laterDataQuery,
    {
      user_id: user_id,
      updated_at: time
    },
    (err, rows) => {

    var loaded_rows = [];
    for (var i = 0 ; i < rows.length ; i++ ) {
      var row = rows[i];
      var data = {};
      data.id       = row.data_id;
      data.user_id = row.user_id;
      data.data = row.json_data;
      data.updated_at = row.updated_at;
      data.class_name = row.class_name;
      loaded_rows.push(data);
    }

    callback(loaded_rows);
  });
  _client.end();

}

module.exports = RVDataDB;
