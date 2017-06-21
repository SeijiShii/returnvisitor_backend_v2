const dbclient = require('./dbclient');

// データをすべて読み出す。
let queryAllData = 'SELECT * FROM returnvisitor_db.rv_data;';
dbclient.query(queryAllData, (err, rows) => {
  console.log('1st queryAllData err:');
  console.dir(err);
  console.log('削除前のすべてのデータを読み出した。件数: ' + rows.length);
  let oldCount = rows.length;

  let idsToDelete = [];
  // 順繰りに次のものと比較していき、重複があれば更新日時の古いものを削除する。
  // for ( var i = 0 ; i < rows.length - 1 ; i++ ) {
  //
  // }
  let i = process.argv[2];
  var item1 = rows[i];
  let data_id = item1.data_id;
  if (idsToDelete.indexOf(item1.id) < 0) {
    for ( var j = 0 ; j < rows.length ; j++ ) {
      if (j !== i) {
        var item2 = rows[j];
        if (idsToDelete.indexOf(item2.id < 0)) {
          // console.log('i = ' + i + ', j = ' + j);

          if (item1.data_id === item2.data_id) {
            // console.log('rows[' + i + '] and rows[' + j + '] have same data_id.');
            var idToDelete;
            if (item1.updated_at >= item2.updated_at) {
              idToDelete = item2.id;
            } else {
              idToDelete = item1.id;
              item1 = item2;
            }
            if (idsToDelete.indexOf(idToDelete) == -1) {
              idsToDelete.push(idToDelete);
              // console.log('Added id to delete: ' + idToDelete);
              // console.log('ids to delete count: ' + idsToDelete.length);
            }
          }
        }
      }
    }
  }
  for ( var k = 0 ; k < idsToDelete.length ; k++ ) {

    console.log('Deleting id:' + idsToDelete[k]);
    let deleteQuery = 'DELETE FROM returnvisitor_db.rv_data where id = ' + idsToDelete[k] + ' ;';

    // console.log('dbclient:');
    // console.dir(dbclient);

    dbclient.query(deleteQuery, (err, rows) => {
      // console.log('deleteQuery err:');
      // console.dir(err);
      // console.log('affectedRows: ' + rows.info.affectedRows);
      // if (rows.info.affectedRows == 1) {
      //   // console.log('Deleted id: ');
      // }
    });

  }
  dbclient.query(queryAllData, (err, rows) => {
    // console.log('2nd queryAllData err:');
    // console.dir(err);
    let diff = oldCount - rows.length;
    console.log('item1.data_id: ' + data_id );
    console.log('削除前: ' + oldCount + ', 削除後: ' + rows.length + ', 削除数: ' + diff);
  });
  dbclient.end();
});
