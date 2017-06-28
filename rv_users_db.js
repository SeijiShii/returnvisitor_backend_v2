const STATUS_200_AUTH_TOKEN_UPDATED = 'STATUS_200_AUTH_TOKEN_UPDATED';
const STATUS_201_CREATED              = "STATUS_201_CREATED";
const STATUS_202_AUTHENTICATED        = 'STATUS_202_AUTHENTICATED';
const STATUS_204_NO_AUTH_TOKEN        = 'STATUS_204_NO_AUTH_TOKEN';
const STATUS_400_DUPLICATE_USER_NAME  = 'STATUS_400_DUPLICATE_USER_NAME';
const STATUS_400_SHORT_USER_NAME      = "STATUS_400_SHORT_USER_NAME";
const STATUS_400_SHORT_PASSWORD       = "STATUS_400_SHORT_PASSWORD";
const STATUS_400_WRONG_ARGS         = 'STATUS_400_WRONG_ARGS';
const STATUS_401_UNAUTHORIZED         = "STATUS_401_UNAUTHORIZED";
const STATUS_404_NOT_FOUND            = 'STATUS_404_NOT_FOUND';

var _client;

function RVUsersDB(client) {
  _client = client;
}

RVUsersDB.prototype.login = (userName, password, callback) => {
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
          statusCode: STATUS_202_AUTHENTICATED
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
                  RVUsersDB.prototype.login(userName, password, (result) => {
                    // 新規作成なのでステータスコードを書き換える
                    result.statusCode = STATUS_201_CREATED;
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

RVUsersDB.prototype.loginWithAuthToken = (userName, authToken, callback) => {

    // authTokenログインの流れ
    // queryAuthToken
    //  -> 存在する場合　成功
    //  -> 存在しない場合
    //      -> insertAuthToken アカウントの作成
    //        -> 成功する場合
    //            -> queryAuthToken  
    //              -> 存在する場合　成功
    //              -> 存在しない場合 失敗

    queryAuthToken(authToken, (data) => {
      if (data) {
      let result = {
            statusCode: STATUS_202_AUTHENTICATED,
            userName: data.user_name,
            password: data.password,
            userId: data.user_id,
            authToken: authToken
        }
        console.log(new Date() + ' Successfully logged in with authToken: ' + authToken);
        callback(result);
    } else {
        console.log(new Date() + ' Login, not found authToken: ' + authToken);
        console.log(new Date() + ' Creating user with authToken: ' + authToken);
        insertAuthToken(userName, authToken, (success) => {
          if (success) {
            console.log(new Date() + ' Successfully created user with authToken: ' + authToken);
            console.log(new Date() + ' Trying login again with authToken: ' + authToken);
            queryAuthToken(authToken, (data) => {
              let result = {
                statusCode: STATUS_202_AUTHENTICATED,
                userName: data.user_name,
                password: data.password,
                userId: data.user_id,
                authToken: authToken
              }
              console.log(new Date() + ' Second login succeed with authToken: ' + authToken);
              callback(result);
            });
          } else {
            let result = {
                statusCode: STATUS_401_UNAUTHORIZED,
                userName: data.user_name,
                password: data.password,
                userId: data.user_id,
                authToken: authToken
            }
            console.log(new Date() + ' Second login failed with authToken: ' + authToken);
            callback(result);
          }
        });
      }
    });
           
}

const queryAuthToken = (authToken, callback) => {

  // callback(queried data OR null)

  let authTokenQuery 
  = 'SELECT * FROM returnvisitor_db.users WHERE auth_token = :authToken ;';
    _client.query(authTokenQuery,
                 {authToken: authToken},
                 (err, rows) => {

      if (rows.info.numRows == 1) {
        
        // console.log('rows[0]');
        // console.dir(rows[0]);

        callback(rows[0]);
      } else {
        callback(null);
      }
    });
    _client.end();
}

const insertAuthToken = (userName, authToken, callback) => {

    // callback(success)

    // generate userId
    const dateString = new Date().getTime().toString();
    let userId;
    if (userName != null) {
      userId = 'user_id_' + userName + '_' + dateString;
    } else {
      userId = 'user_id_' + authToken + '_' + dateString;
    }

    // 新規作成クエリ
    const createUserQuery = 'INSERT INTO returnvisitor_db.users (auth_token, user_id, updated_at) VALUES (:authToken, :userId, :updated_at );';
    let dateTime = new Date().getTime().toString();
    _client.query(createUserQuery,
      {
        authToken: authToken,
        userId: userId, 
        updated_at: dateTime},
      (err, rows) => {
       console.dir(err);
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

RVUsersDB.prototype.updateAuthToken = (oldAuthToken, newAuthToken, callback) => {
    
    console.log('oldAuthToken: ' + oldAuthToken);
    queryAuthToken(oldAuthToken, (succeed) => {
      if (succeed) {
        const updateQuery 
          = 'UPDATE returnvisitor_db.users SET auth_token = :newAuthToken WHERE auth_token = :oldAuthToken;';
         _client.query(updateQuery,
          {
            newAuthToken : newAuthToken,
            oldAuthToken : oldAuthToken
          },
          (err, rows) => {
            if (rows.info.affectedRows == 1) {
              RVUsersDB.prototype.loginWithAuthToken(null, newAuthToken, (result) => {
                result.statusCode = STATUS_200_AUTH_TOKEN_UPDATED;
                callback(result);
              });
            }
        });
        _client.end();
    } else {
      let result = {
          statusCode: STATUS_204_NO_AUTH_TOKEN,
          userName: null,
          password: null,
          userId: null,
          authToken: oldAuthToken
      }
      console.log(new Date() + ' Not found authToken to update: ' + oldAuthToken);
      callback(result);
    }
  });
}

module.exports = RVUsersDB;
    
