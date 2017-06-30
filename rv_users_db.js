// RVCloudSyndDataFrame: StatusCode
const STATUS_200_AUTH_TOKEN_UPDATED       = 'STATUS_200_AUTH_TOKEN_UPDATED';
const STATUS_200_SYNC_START_OK_WITH_NAME 	= 'STATUS_200_SYNC_START_OK_WITH_NAME';
const STATUS_200_SYNC_START_OK_WITH_TOKEN = 'STATUS_200_SYNC_START_OK_WITH_TOKEN';
const STATUS_200_SYNC_END_OK			    = 'STATUS_200_SYNC_END_OK';
const STATUS_201_CREATED_USER         = 'STATUS_201_CREATED_USER';
const STATUS_202_AUTHENTICATED        = 'STATUS_202_AUTHENTICATED';
const STATUS_204_NO_AUTH_TOKEN        = 'STATUS_204_NO_AUTH_TOKEN';
const STATUS_400_DUPLICATE_USER_NAME  = 'STATUS_400_DUPLICATE_USER_NAME';
const STATUS_400_SHORT_USER_NAME      = 'STATUS_400_SHORT_USER_NAME';
const STATUS_400_SHORT_PASSWORD       = 'STATUS_400_SHORT_PASSWORD';
const STATUS_400_WRONG_ARGS           = 'STATUS_400_WRONG_ARGS';
const STATUS_401_UNAUTHORIZED         = 'STATUS_401_UNAUTHORIZED';
const STATUS_404_NOT_FOUND            = 'STATUS_404_NOT_FOUND';

var _client;

function RVUsersDB(client) {
  _client = client;
}

RVUsersDB.prototype.loginWithName = (userName, password, callback) => {
  // ログインの流れ
  
  // ユーザ名とパスワードでDBクエリ
  // if データ件数が1件ヒット
  //       202 AUTHENTICATED ユーザデータを返す。
  // else
  //   ユーザ名だけでDBクエリ
  //    if データ件数が1件ヒット
  //        40１　UNAUTHORIZED ユーザ名だけを返す。
  //    else
  //        404 NOT_FOUND ユーザ名だけを返す。

  let queryUser = 'SELECT * FROM returnvisitor_db.users WHERE user_name = :userName AND password = :password ;';
  _client.query(queryUser,
    {userName: userName, password: password},
    (err, rows) => {
    if (rows) {
      if (rows.info.numRows == 1) {
        // データが1件だけの時のみデータを返す。
        let result = {
          userName: rows[0].user_name,
          password: rows[0].password,
          userId: rows[0].user_id,
          statusCode: STATUS_202_AUTHENTICATED_WITH_NAME
        };
        console.log(new Date() + ' Login, authenticated: ' + userName);
        callback(result);
      } else {
        // 1件以外の時
        RVUsersDB.prototype.existsUser(userName, (exists) => {
          if (exists) {
            let result = {
              userName: userName,
              password: password,
              statusCode: STATUS_401_UNAUTHORIZED
            }
            console.log(new Date() + ' Login, unauthorized: ' + userName);
            callback(result);
          } else {
            let result = {
              userName: userName,
              password: password,
              statusCode: STATUS_404_NOT_FOUND
            }
            console.log(new Date() + ' Login, not found: ' + userName);
            callback(result);
          }
        });
      }
    } else {
      // rowがnullになるケースがあるかどうかは分からないけれど。
      let result = {
        user:{
          userName: userName
        },
        statusCode: STATUS_404_NOT_FOUND
      }
      console.log(new Date() + ' Login not found: ' + userName);
      callback(result);
    }

  });
  _client.end();
}

RVUsersDB.prototype.createUser = (userName, password, callback) => {

  // callback(result {user{userName, password}, statusCode})
  // アカウント新規作成の流れ
  //    if ユーザ名が存在するか
  //      400 BAD REAUEST DUPLICATE USER
  //    else
  //      if ユーザ名は8文字以下か
  //        400 BAD REQUEST SHORT userName
  //      else
  //        if パスワードは8文字以下か
  //          400 BAD REQUEST SHORT PASSWORD
  //        else
  //          新規作成　201 CREATED
  RVUsersDB.prototype.existsUser(userName, (exists) => {

      if (exists) {

        let result = {
          userName: userName,
          statusCode: STATUS_400_DUPLICATE_USER_NAME
        };

        console.log(new Date() + ' Create user duplicate user name: ' + userName);
        callback(result);
      } else {
        // ユーザ名が8文字以下か
        if (userName.length < 8) {

          let result = {
            userName: userName,
            statusCode: STATUS_400_SHORT_USER_NAME
          };

          console.log(new Date() + ' Create user, short user name: ' + userName);
          callback(result);
        } else {
          // パスワードが8文字以下か
          if (password.length < 8) {

            let result = {
              userName: userName,
              statusCode: STATUS_400_SHORT_PASSWORD
            };

            console.log(new Date() + ' Create user, short password: ' + userName);
            callback(result);
          } else {

            // generate userId
            var dateString = new Date().getTime().toString();
            var userId = 'user_id_' + userName + '_' + dateString;

            // 新規作成クエリ
            var createUserQuery = 'INSERT INTO returnvisitor_db.users (user_name, password, user_id, updated_at) VALUES (:userName, :password, :userId, :updated_at );';
            let dateTime = new Date().getTime().toString();
            _client.query(createUserQuery,
              {userName: userName, password: password, userId: userId, updated_at: dateTime},
              (err, rows) => {
              // console.dir(err);
              if (rows) {
                if (rows.info.affectedRows == 1) {
                  RVUsersDB.prototype.loginWithName(userName, password, (result) => {
                    // 新規作成なのでステータスコードを書き換える
                    result.statusCode = STATUS_201_CREATED_USER_WITH_NAME;
                    console.log(new Date() + ' Create user success: ' + userName);
                    callback(result);
                  });
                }
              }
            });
            _client.end();
          }
        }
      }
  });

}

RVUsersDB.prototype.existsUser = (userName, callback) => {

  // callback(boolean)

  var queryUserName = 'SELECT * FROM returnvisitor_db.users WHERE user_name = :userName;';
  _client.query(queryUserName,
    {userName: userName},
     (err, rows) => {
    if (rows) {
      if (rows.info.numRows >= 1) {
        // console.log(new Date() + " " + userName + ': Exists.');
        callback(true);
      } else {
        // console.log(new Date() + " " + userName + ': Does not Exist.');
        callback(false);
      }
    } else {
      // console.log(new Date() + " " + userName + ': Does not Exist.');
      callback(false);
    }
  });
  _client.end();
}

RVUsersDB.prototype.syncRequestWithToken = (authToken, updatedToken, callback) => {

    // authToken同期リクエストの流れ
    // 引数authTokenでqueryAuthToken
    //  -> 存在する場合　以前にログインしている
    //    -> updatedTokenで書き換える
    //      -> 成功 queryAuthToken updatedToken
    //        -> 成功 STATUS_200_SYNC_START_OK_WITH_TOKEN
    //        -> 失敗 STATUS_401_UNAUTHORIZED
    //      -> 失敗 STATUS_401_UNAUTHORIZED
    //  -> 存在しない場合　始めてのログインである
    //        このときauthTokenとupdatedTokenには同じ文字列が入っているものとする。
    //    -> authToken === updatedToken
    //      -> TRUE
    //        -> insertAuthToken authToken アカウントの作成
    //          -> 成功 queryAuthToken authToken
    //              -> 成功 STATUS_200_SYNC_START_OK_WITH_TOKEN 
    //              -> 失敗 STATUS_401_UNAUTHORIZED
    //          -> 失敗 STATUS_401_UNAUTHORIZED
    //      -> FALSE
    //          -> 同じトークンが入っていない STATUS_401_UNAUTHORIZED

    

  const mToken = authToken.slice(0, 15);
  const mUpdatede = updatedToken.slice(0, 15);
  console.log(new Date() + ' AuthToken: ' + mToken);
  console.log(new Date() + ' UpdatedToken: ' + mUpdatede);

  queryAuthToken(authToken, (data) => {
    // 引数authTokenでqueryAuthToken
      if (data) {
        // -> 存在する場合　以前にログインしている
        //  -> updatedTokenで書き換える
        console.log(new Date() + ' Found account with token: ' + mToken);
        console.log(new Date() + ' Updating the account with token: ' + mUpdatede);
        updateAuthToken(authToken, updatedToken, (success) => {
          if (success) {
            // -> 成功 queryAuthToken updatedToken
            console.log(new Date() + ' Successfully updated account with token: ' + mUpdatede);
            console.log(new Date() + ' Querying updated account with token: ' + mUpdatede);
            queryAuthToken(updatedToken, (data) => {
              if (data) {
                // -> 成功 STATUS_200_SYNC_START_OK_WITH_TOKEN
                console.log(new Date() + ' Successfully queried account with token: ' + mUpdatede);
                data.statusCode = STATUS_200_SYNC_START_OK_WITH_TOKEN;
                callback(data);
              } else {
                // -> data == null 失敗 STATUS_401_UNAUTHORIZED
                console.log(new Date() + ' Failed querying account with updated token: ' + mUpdatede);
                let result = {
                  statusCode: STATUS_401_UNAUTHORIZED,
                  authToken: authToken
                }
                callback(result);
              }
            });
          } else {
            // -> 失敗 STATUS_401_UNAUTHORIZED
            console.log(new Date() + ' Failed updating account with token: ' + mUpdatede);
            let result = {
              statusCode: STATUS_401_UNAUTHORIZED,
              authToken: authToken
            }
            callback(result);
          }
        });
      } else {
        // -> 存在しない場合　始めてのログインである
        console.log(new Date() + ' Not found account with token: ' + mToken);
        if (authToken === updatedToken) {
          // このときauthTokenとupdatedTokenには同じ文字列が入っているものとする。
          // -> insertAuthToken authToken アカウントの作成
          console.log(new Date() + ' Old and updated tokens are same.');
          console.log(new Date() + ' Creating account with token: ' + mToken);
          insertAuthToken(authToken, (success) => {
            if (success) {
              // -> 作成成功 queryAuthToken authToken
              console.log(new Date() + ' Successfully created account with token: ' + mToken);
              queryAuthToken(authToken, (data) => {
                if (data) {
                  // -> クエリ成功 STATUS_200_SYNC_START_OK_WITH_TOKEN 
                  data.statusCode = STATUS_200_SYNC_START_OK_WITH_TOKEN;
                  callback(data);
                } else {
                  // -> クエリ失敗 STATUS_401_UNAUTHORIZED
                  console.log(new Date() + ' Failed querying created account with token: ' + mToken);
                  let result = {
                    statusCode: STATUS_401_UNAUTHORIZED,
                    authToken: authToken
                  }
                  callback(result);
                }
              });
            } else {
              // -> 作成失敗 STATUS_401_UNAUTHORIZED
              console.log(new Date() + ' Failed creating account with token: ' + mUpdatede);
              let result = {
                statusCode: STATUS_401_UNAUTHORIZED,
                authToken: authToken
              }
              callback(result);
            }
          });
        }  else {
          console.log(new Date() + ' Old and updated tokens are different.');
          let result = {
            statusCode: STATUS_401_UNAUTHORIZED,
            authToken: authToken
          }
          callback(result);
        }
      }
  });
}


const queryAuthToken = (authToken, callback) => {

  // callback(queried single data OR null)

  let authTokenQuery 
  = 'SELECT * FROM returnvisitor_db.users WHERE auth_token = :authToken ;';
    _client.query(authTokenQuery,
                 {authToken: authToken},
                 (err, rows) => {

      if (rows) {
        if (rows.info.numRows == 1) {
          // 1件見つかった場合
          callback(rows[0]);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
    _client.end();
}

const insertAuthToken = (authToken, callback) => {

    // callback(success)

    // generate userId
    const dateString = new Date().getTime().toString();
    const name = authToken.slice(0, 9);
    const userId = 'user_id_' + name + '_' + dateString;

    // 新規作成クエリ
    const createUserQuery 
      = 'INSERT INTO returnvisitor_db.users (auth_token, user_id, updated_at) VALUES (:authToken, :userId, :updated_at );';
    let dateTime = new Date().getTime().toString();
    _client.query(createUserQuery,
      {
        authToken: authToken,
        userId: userId, 
        updated_at: dateTime},
      (err, rows) => {
      //  console.dir(err);
      if (rows) {
        if (rows.info.affectedRows == 1) {
            // console.log('rows')
            // console.dir(rows);            
            callback(true);
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    });
    _client.end();
}

const updateAuthToken = (oldAuthToken, newAuthToken, callback) => {

  // callback(success)

  const updateQuery 
          = 'UPDATE returnvisitor_db.users SET auth_token = :newAuthToken WHERE auth_token = :oldAuthToken;';
    _client.query(updateQuery,
    {
      newAuthToken : newAuthToken,
      oldAuthToken : oldAuthToken
    },
    (err, rows) => {
      if (rows) {
        if (rows.info.affectedRows == 1) {
        callback(true);
      } else {
        callback(false);
      } 
    } else{
      callback(false);
    }
  });
  _client.end();
}

module.exports = RVUsersDB;
    
