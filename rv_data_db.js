var _client;

function RVDataDB(client) {
  _client = client;
}

const queryMatchData = (userId, data, callback) => {

  // ユーザID、データID、更新日時の一致するデータがあれば検索
  var matchQuery = 'SELECT * FROM returnvisitor_db.rv_data WHERE data_id = :data_id AND user_id = :user_id AND updated_at = :updated_at;';
  _client.query(matchQuery,
    {
      data_id: data.dataId,
      user_id: userId,
      updated_at: data.updatedAt
    },
    (err, rows) => {

      // if (rows.info.affectedRows >= 1) {
      //   console.log('Data to save:');
      //   console.log('  userId:         ' + userId);
      //   console.log('  data.dataId:    ' + data.dataId);
      //   console.log('  data.updatedAt: ' + data.updatedAt);
      //   console.log('Data matched:');
      //   console.log('  rows[0].user_id: ' + rows[0].user_id);
      //   console.log('  rows[0].data_id: ' + rows[0].data_id);
      //   console.log('  rows[0].updated_at: ' + rows[0].updated_at);
      //   console.log('rows.info.numRows: ' + rows.info.numRows);
      //   console.log('rows.info.affectedRows: ' + rows.info.affectedRows);
      // }

      // 全一致するデータが存在しなければ
      if (rows.info.affectedRows == 0) {
        updeteOlderData(userId, data, callback);
      } else {
        console.log('Not updated: ' + data.dataId);
      }
    });
}

const updeteOlderData = (userId, data, callback) => {

  // callback(success: boolean, updatedData: Object)

  // データ更新日が古ければ上書き
  var changeQuery = 'UPDATE returnvisitor_db.rv_data SET class_name = :class_name , updated_at = :updated_at_0, json_data = :json_data WHERE data_id = :data_id AND user_id = :user_id AND updated_at < :updated_at_1;';
  _client.query(changeQuery,
    {
      class_name: data.className,
      updated_at_0: data.updatedAt,
      json_data: data.data,
      data_id: data.dataId,
      user_id: userId,
      updated_at_1: data.updatedAt
    },
    (err, rows) => {

    if (rows) {

      // console.dir(rows);

      if (rows.info.affectedRows == 1) {
        console.log('Data updated: ' + data.dataId);
        callback({
          success: true,
          updatedData: data
        });
      } else {
        insertData(userId, data, callback);
      }
    }
  });
  _client.end();
}

const insertData = (userId, data, callback) => {

  var insertQuery = 'INSERT INTO returnvisitor_db.rv_data (user_id, data_id, class_name, updated_at, json_data) VALUES (:user_id, :data_id, :class_name, :updated_at, :json_data );';
  _client.query(insertQuery,
  {
    user_id: userId,
    data_id: data.dataId,
    class_name: data.className,
    updated_at: data.updatedAt,
    json_data: data.data
  },
  (err, rows) => {

    // console.dir(err);

    if (rows) {
      if (rows.info.affectedRows == 1) {
        console.log('Data inserted: ' + data.dataId);
        callback({
          success: true,
          updatedData: data
        });
      } else {
        callback({
          success: false,
          updatedData: data
        });
      }
    }
  });
  _client.end();
};

const saveSingleData = (userId, data, callback) => {

  queryMatchData(userId, data, callback);

}

RVDataDB.prototype.saveDataArray = (userId, array) => {
  // callback(result)

  // console.dir(array);
  for ( var i = 0 ; i < array.length ; i++ ) {
    saveSingleData(userId, array[i], (result) => {

      if (result.updatedData.className === 'DeletedData') {
        var deletedData = result.updatedData;
        var dataString = JSON.stringify(deletedData.data);
        dataString = dataString.replace(/\*double_quotes\*/g, '"');
        var parsedData = JSON.parse(dataString);

        deleteSingleData(userId, parsedData.id, (success) => {

        });
      }
    });
  }
}

const deleteSingleData = (userId, data_id, callback) => {
  var deleteDataQuery = 'DELETE FROM returnvisitor_db.rv_data WHERE user_id = :user_id AND data_id = :data_id;';
  _client.query(deleteDataQuery,
    {
      user_id: userId,
      data_id: data_id
    },
    (err, rows) =>{
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

RVDataDB.prototype.loadDataLaterThanTime = (userId, time, callback) => {
  // callback(loadedRows)
  var laterDataQuery = 'SELECT * FROM returnvisitor_db.rv_data WHERE user_id = :user_id AND updated_at > :updated_at;'

  let values = {
                user_id: userId,
                updated_at: time
              };

  _client.query(laterDataQuery,
    values,
    (err, rows) => {

      var loadedRows = [];
      for (var i = 0 ; i < rows.length ; i++ ) {
        var row = rows[i];
        var data = {
          dataId:     row.data_id,
          data:       row.json_data,
          updatedAt:  row.updated_at,
          className:  row.class_name
        };
        loadedRows.push(data);
      }

    callback(loadedRows);
  });
  _client.end();

}

module.exports = RVDataDB;
