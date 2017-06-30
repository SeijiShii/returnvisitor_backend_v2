#!/usr/bin/env node

// RVCloudSyndDataFrame: FrameCategory
const	LOGIN_REQUEST         = 'LOGIN_REQUEST';
const	LOGIN_RESPONSE 				= 'LOGIN_RESPONSE';
const	CREATE_USER_REQUEST 	= 'CREATE_USER_REQUEST';
const	CREATE_USER_RESPONSE 	= 'CREATE_USER_RESPONSE';
const	SYNC_DATA_REQUEST_WITH_NAME 		= 'SYNC_DATA_REQUEST_WITH_NAME';
const	SYNC_DATA_RESPONSE_WITH_NAME 		= 'SYNC_DATA_RESPONSE_WITH_NAME';
const	SYNC_DATA_REQUEST_WITH_TOKEN 		= 'SYNC_DATA_REQUEST_WITH_TOKEN';
const	SYNC_DATA_RESPONSE_WITH_TOKEN 		= 'SYNC_DATA_RESPONSE_WITH_TOKEN';
const	DEVICE_DATA_FRAME 		= 'DEVICE_DATA_FRAME';
const	DEVICE_DATA_END_FRAME = 'DEVICE_DATA_END_FRAME';
const	CLOUD_DATA_FRAME 			= 'CLOUD_DATA_FRAME';
const	CLOUD_DATA_END_FRAME 	= 'CLOUD_DATA_END_FRAME';
const AUTH_TOKEN_UPDATE_REQUEST = 'AUTH_TOKEN_UPDATE_REQUEST';
const AUTH_TOKEN_UPDATE_RESPONSE = 'AUTH_TOKEN_UPDATE_RESPONSE';

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

const WebSocketServer = require('websocket').server;
// const https = require('https');
 const http = require('http');

// const dbclient = require('./dbclient');
const dbclient = require('./dbclient_test');

const RVUsersDB = require('./rv_users_db');
const usersDB = new RVUsersDB(dbclient);

const RVDataDB = require('./rv_data_db');
const dataDB = new RVDataDB(dbclient);

const websocket = require("websocket");
// const fs = require('fs');
const logger = require('./logger');

// const ssl_server_key = './ssl.key/server.key';
// const ssl_server_crt = './ssl.key/server.crt';
// const client_crt = './ssl.key/client.crt';

// const options = {
// 	key: fs.readFileSync(ssl_server_key),
//  cert: fs.readFileSync(ssl_server_crt)
// };

// const server = https.createServer(options);
const server = http.createServer();
const port = 1337;

server.listen(port, function() {
    console.log((new Date()) + ' Server is listening on port: ' + port);
});

const wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});


wsServer.on('request', (req) => {

  let serverAuthToken;
  let userId;
  let lastSyncDate;
  let deviceDataArray = [];
	let connection = req.accept(null, req.origin);
	let logMessage = 'Remote Address: ' + connection.remoteAddress + ', Connected.';
	logger.loggerAction.info(logMessage);
	console.log(new Date() + ' ' + logMessage);

  connection.on('message', (message) => {
    if (message.type === 'utf8') {
			let dataFrame = JSON.parse(message.utf8Data)
			let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + dataFrame.frameCategory;
			logger.loggerAction.info(logMessage);
			console.log(new Date() + ' ' + logMessage);
			separateOnFrameCategory(dataFrame);
    }
  });

  connection.on('close', (reasonCode, description) => {
			let logMessage = 'Remote Address: ' + connection.remoteAddress + ' disconnected.';
			logger.loggerAction.info(logMessage);
			console.log(new Date() + ' ' + logMessage);
  });

const separateOnFrameCategory = (dataFrame) => {
  
  switch (dataFrame.frameCategory) {
    case LOGIN_REQUEST:
      onLoginRequest(dataFrame);
      break;
    
    case CREATE_USER_REQUEST:
      onCreateUserRequest(dataFrame);
      break;

    case SYNC_DATA_REQUEST_WITH_NAME:
      onSyncDataRequestWithName(dataFrame);
      break;
    
    case SYNC_DATA_REQUEST_WITH_TOKEN:
      onSyncDataRequestWithToken(dataFrame);
      break;

    case DEVICE_DATA_FRAME:
      onDeviceDataFrame(dataFrame);
      break;

    case DEVICE_DATA_END_FRAME:
      onDeviceDataEndFrame(dataFrame);
      break;
    
    case AUTH_TOKEN_UPDATE_REQUEST:
      onAuthTokenUpdateRequest(dataFrame);
      break;
        
    default:

  }
}

  const onLoginRequest = (dataFrame) => {
  	usersDB.loginWithName(dataFrame.userName, dataFrame.password, (result) => {

      const responseDataFrame = {
          frameCategory: LOGIN_RESPONSE,
          userName: result.userName,
          password: result.password,
          statusCode: result.statusCode,
          dataBody: null,
          lastSyncDate: null
        };
      sendDataFrame(responseDataFrame);
  	});
  }

  // const onLoginRequestWithToken = (dataFrame) => {
  //   usersDB.loginWithAuthToken(dataFrame.authToken, (result) => {
  //     const responseDataFrame = {
  //         frameCategory: LOGIN_RESPONSE,
  //         statusCode: result.statusCode
  //       };
  //     sendDataFrame(responseDataFrame);
  //   });
  // }

  const onCreateUserRequest = (dataFrame) => {

  	usersDB.createUser(dataFrame.userName, dataFrame.password, (result) => {
      
      const responseDataFrame = {
          frameCategory: CREATE_USER_RESPONSE,
          userName: result.userName,
          password: result.password,
          statusCode: result.statusCode,
          dataBody: null,
          lastSyncDate: null
        };
      sendDataFrame(responseDataFrame);
  	});
  }

  const onSyncDataRequestWithName = (dataFrame) => {

    const userName = dataFrame.userName;
    const password = dataFrame.password;

    usersDB.loginWithName(userName, password, (result) => {
	        if (result.statusCode === STATUS_202_AUTHENTICATED_WITH_NAME) {
            // 認証OKでトークンを発行
            userId = result.userId;
  			    serverAuthToken = require('./hashed_token')(result.userId);
            const responseDataFrame = {
              frameCategory: SYNC_DATA_RESPONSE,
              userName: result.userName,
              password: result.password,
              statusCode: STATUS_200_SYNC_START_OK_WITH_NAME,
              authToken: serverAuthToken,
              dataBody: null,
              lastSyncDate: null
            };
            sendDataFrame(responseDataFrame);
          } else {
            const responseDataFrame = {
              frameCategory: SYNC_DATA_RESPONSE,
              userName: result.userName,
              password: result.password,
              statusCode: result.statusCode,
              authToken: null,
              dataBody: null,
              lastSyncDate: null
            };
            sendDataFrame(responseDataFrame);
          }
        });

    // if (userName != null && password != null) {
    //   // ユーザ名とパスワードでリクエストか
        
       
    // } else if(authToken != null) {
      
    // } else {
    //    const responseDataFrame = {
    //     frameCategory: SYNC_DATA_RESPONSE,
    //     userName: userName,
    //     password: password,
    //     statusCode: STATUS_400_WRONG_ARGS,
    //     dataBody: null,
    //     lastSyncDate: null
    //   };
    //   sendDataFrame(responseDataFrame);
    // }
  }

  const onSyncDataRequestWithToken = (dataFrame) => {
      // 認証トークンによるリクエストか
        serverAuthToken = dataFrame.authToken;

        usersDB.syncRequestWithToken(dataFrame.authToken, dataFrame.dataBody, (result) => {
          userId = result.userId;
          const responseDataFrame = {
            frameCategory: SYNC_DATA_RESPONSE_WITH_TOKEN,
            statusCode: result.statusCode,
            authToken: result.authToken,
          };
          sendDataFrame(responseDataFrame);
        });
  }

  const onDeviceDataFrame = (dataFrame) => {
  	if (dataFrame.authToken === serverAuthToken) {
			let data = JSON.parse(dataFrame.dataBody)
  		deviceDataArray.push(data);
  	} else {
      const responseDataFrame = {
        frameCategory: SYNC_DATA_RESPONSE,
        userName: dataFrame.userName,
        password: dataFrame.password,
        statusCode: STATUS_401_UNAUTHORIZED,
        authToken: null,
        dataBody: null,
        lastSyncDate: null
      };
      sendDataFrame(responseDataFrame);
  	}
  }

  const onDeviceDataEndFrame = (dataFrame) => {
  	if (dataFrame.authToken === serverAuthToken) {
      dataDB.saveDataArray(userId, deviceDataArray);
      let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + DEVICE_DATA_END_FRAME + ', Device data count: ' + deviceDataArray.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);

      // todo ここからクラウド側のデータの伝送を始める
      sendCloudData(serverAuthToken);

  	} else {
  		const responseDataFrame = {
        frameCategory: SYNC_DATA_RESPONSE,
        userName: dataFrame.userName,
        password: dataFrame.password,
        statusCode: STATUS_401_UNAUTHORIZED,
        authToken: null,
        dataBody: null,
        lastSyncDate: null
      };
      sendDataFrame(responseDataFrame);
  	}
  }

  const onAuthTokenUpdateRequest = (dataFrame) => {
    usersDB.updateAuthToken(dataFrame.authToken, dataFrame.dataBody, (result) => {
      userId = result.userId;
      const responseDataFrame = {
        frameCategory: AUTH_TOKEN_UPDATE_RESPONSE,
        userName: result.userName,
        password: result.password,
        statusCode: result.statusCode,
        authToken: result.authToken,
        dataBody: null,
        lastSyncDate: null
      };
      sendDataFrame(responseDataFrame);
    });
  }

  const sendDataFrame = (dataFrame) => {
  	var jsonRes = JSON.stringify(dataFrame);
  	// console.log('response: ' + jsonRes);
  	connection.sendUTF(jsonRes);

  	let logMessage = 'Remote Address: ' + connection.remoteAddress 
      + ', FrameCategory: ' + dataFrame.frameCategory + ', statusCode: ' 
      + dataFrame.statusCode;
  	logger.loggerAction.info(logMessage);
  	console.log(new Date() + ' ' + logMessage);
  }

  const sendCloudData = (authToken) => {
    dataDB.loadDataLaterThanTime(userId, lastSyncDate, (loadedRows) => {

      loadedRows.forEach((row) => {
        const cloudDataFrame = {
          frameCategory: CLOUD_DATA_FRAME,
          userName: null,
          password: null,
          statusCode: null,
          authToken: authToken,
          dataBody: JSON.stringify(row),
          lastSyncDate: null
        };
        connection.sendUTF(JSON.stringify(cloudDataFrame));
      });

      const cloudDataEndFrame = {
        frameCategory: CLOUD_DATA_END_FRAME,
        userName: null,
        password: null,
        statusCode: STATUS_200_SYNC_END_OK,
        authToken: authToken,
        dataBody: null,
        lastSyncDate: null
      };
      connection.sendUTF(JSON.stringify(cloudDataEndFrame));
      const logMessage 
        = 'Remote Address: ' + connection.remoteAddress 
          + ', FrameCategory: ' + CLOUD_DATA_END_FRAME 
          + ', Cloud data count: ' + loadedRows.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);
    });
  }

});
