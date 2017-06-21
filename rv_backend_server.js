#!/usr/bin/env node

// RVCloudSyndDataFrame: FrameCategory
const	LOGIN_REQUEST 				= 'LOGIN_REQUEST';
const	LOGIN_RESPONSE 				= 'LOGIN_RESPONSE';
const	CREATE_USER_REQUEST 	= 'CREATE_USER_REQUEST';
const	CREATE_USER_RESPONSE 	= 'CREATE_USER_RESPONSE';
const	SYNC_DATA_REQUEST 		= 'SYNC_DATA_REQUEST';
const	SYNC_DATA_RESPONSE 		= 'SYNC_DATA_RESPONSE';
const	DEVICE_DATA_FRAME 		= 'DEVICE_DATA_FRAME';
const	DEVICE_DATA_END_FRAME = 'DEVICE_DATA_END_FRAME';
const	CLOUD_DATA_FRAME 			= 'CLOUD_DATA_FRAME';
const	CLOUD_DATA_END_FRAME 	= 'CLOUD_DATA_END_FRAME';

// RVResponseBody: StatusCode
const STATUS_200_SYNC_START_OK 				= 'STATUS_200_SYNC_START_OK';
const STATUS_200_SYNC_END_OK 					= 'STATUS_200_SYNC_END_OK';
const STATUS_201_CREATED              = 'STATUS_201_CREATED';
const STATUS_202_AUTHENTICATED        = 'STATUS_202_AUTHENTICATED';
const STATUS_400_DUPLICATE_USER_NAME  = 'STATUS_400_DUPLICATE_USER_NAME';
const STATUS_400_SHORT_USER_NAME      = 'STATUS_400_SHORT_USER_NAME';
const STATUS_400_SHORT_PASSWORD       = 'STATUS_400_SHORT_PASSWORD';
const STATUS_401_UNAUTHORIZED         = 'STATUS_401_UNAUTHORIZED';
const STATUS_404_NOT_FOUND            = 'STATUS_404_NOT_FOUND';

const WebSocketServer = require('websocket').server;
const https = require('https');
// const http = require('http');

const dbclient = require('./dbclient');

const RVUsersDB = require('./rv_users_db');
const usersDB = new RVUsersDB(dbclient);

const RVDataDB = require('./rv_data_db');
const dataDB = new RVDataDB(dbclient);

const websocket = require("websocket");
const fs = require('fs');
const logger = require('./logger');

const ssl_server_key = './ssl.key/server.key';
const ssl_server_crt = './ssl.key/server.crt';
const client_crt = './ssl.key/client.crt';

const options = {
	key: fs.readFileSync(ssl_server_key),
  cert: fs.readFileSync(ssl_server_crt)
};

const server = https.createServer(options);
// const server = http.createServer();
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

  var authToken;
  var userId;
  var lastSyncDate;
  var deviceDataArray = [];
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

  let separateOnFrameCategory = (dataFrame) => {
  	switch (dataFrame.frameCategory) {
  		case LOGIN_REQUEST:
  			onLoginRequest(dataFrame.dataBody);
  			break;

  		case CREATE_USER_REQUEST:
  			onCreateUserRequest(dataFrame.dataBody);
  			break;

  		case SYNC_DATA_REQUEST:
  			onSyncDataRequest(dataFrame.dataBody);
  			break;

  		case DEVICE_DATA_FRAME:
  			onDeviceDataFrame(dataFrame.dataBody, dataFrame.token);
  			break;

  		case DEVICE_DATA_END_FRAME:
  			onDeviceDataEndFrame(dataFrame.token);
  			break;

  		default:

  	}
  }

  const onLoginRequest = (dataBody) => {
    dataBody = JSON.parse(dataBody);
  	usersDB.login(dataBody.userName, dataBody.password, (result) => {

      if (result.statusCode = STATUS_202_AUTHENTICATED) {
        var dataFrame = {
          frameCategory: LOGIN_RESPONSE,
          dataBody: JSON.stringify({
            statusCode: result.statusCode,
            userName: result.user.userName,
            password: result.user.password
          }),
          token: null
        };
        sendDataFrame(dataFrame, STATUS_202_AUTHENTICATED);
      } else {
        var dataFrame = {
          frameCategory: LOGIN_RESPONSE,
          dataBody: JSON.stringify({
            statusCode: result.statusCode,
            userName: result.user.userName,
            password: null
          }),
          token: null
        };
        sendDataFrame(dataFrame, result.statusCode);
      }


  	});
  }

  const onCreateUserRequest = (dataBody) => {
    dataBody = JSON.parse(dataBody);
  	usersDB.createUser(dataBody.userName, dataBody.password, (result) => {
      if (result.statusCode == STATUS_201_CREATED) {
        var dataFrame = {
          frameCategory: CREATE_USER_RESPONSE,
          dataBody: JSON.stringify({
            statusCode: result.statusCode,
            userName: dataBody.userName,
            password: result.user.password
          }),
          token: null
        };

        sendDataFrame(dataFrame, result.statusCode)
      } else {
        var dataFrame = {
          frameCategory: CREATE_USER_RESPONSE,
          dataBody: JSON.stringify({
            statusCode: result.statusCode,
            userName: dataBody.userName,
            password: null
          }),
          token: null
        };

        sendDataFrame(dataFrame, result.statusCode)
      }

  	});
  }

  const onSyncDataRequest = (dataBody) => {
    dataBody = JSON.parse(dataBody);
    lastSyncDate = dataBody.lastSyncDate;
  	usersDB.login(dataBody.userName, dataBody.password, (result) => {
  		if (result.statusCode === STATUS_202_AUTHENTICATED) {
  			authToken = require('./hashed_token')(result.user.userId);
  			userId = result.user.userId;
  			var dataFrame = {
  				frameCategory: SYNC_DATA_RESPONSE,
  				dataBody: JSON.stringify({
  					statusCode: STATUS_200_SYNC_START_OK,
            userName: dataBody.userName
  				}),
  				token: authToken
  			};
  			sendDataFrame(dataFrame, STATUS_200_SYNC_START_OK);

  		} else {
  			var dataFrame = {
  				frameCategory: SYNC_DATA_RESPONSE,
  				dataBody: JSON.stringify({
  					statusCode: result.statusCode,
            userName: dataBody.userName
  				}),
  				token: null
  			};
  			sendDataFrame(dataFrame, result.statusCode);

  		}
  	});
  }

  const onDeviceDataFrame = (dataBody, token) => {
  	if (token === authToken) {
			let data = JSON.parse(dataBody)
  		deviceDataArray.push(data);
  	} else {
  		var dataFrame = {
  			frameCategory: SYNC_DATA_RESPONSE,
  			dataBody: JSON.stringify({
  				statusCode: STATUS_401_UNAUTHORIZED
  			}),
  			token: null
  		};
  		sendDataFrame(dataFrame, STATUS_401_UNAUTHORIZED);
  	}
  }

  const onDeviceDataEndFrame = (token) => {
  	if (token === authToken) {
      dataDB.saveDataArray(userId, deviceDataArray);
      let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + DEVICE_DATA_END_FRAME + ', Device data count: ' + deviceDataArray.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);

      // todo ここからクラウド側のデータの伝送を始める
      sendCloudData(token);

  	} else {
  		var dataFrame = {
  			frameCategory: SYNC_DATA_RESPONSE,
  			dataBody: JSON.stringify({
  				statusCode: STATUS_401_UNAUTHORIZED
  			}),
  			token: null
  		};
  		sendDataFrame(dataFrame, STATUS_401_UNAUTHORIZED);
  	}
  }

  const sendDataFrame = (dataFrame, statusCode) => {
  	var jsonRes = JSON.stringify(dataFrame);
  	// console.log('response: ' + jsonRes);
  	connection.sendUTF(jsonRes);

  	let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + dataFrame.frameCategory + ', statusCode: ' + statusCode;
  	logger.loggerAction.info(logMessage);
  	console.log(new Date() + ' ' + logMessage);
  }

  const sendCloudData = (token) => {
    dataDB.loadDataLaterThanTime(userId, lastSyncDate, (loadedRows) => {

      for ( var i = 0 ; i < loadedRows.length ; i++ ) {
        let dataFrame = {
    			frameCategory: CLOUD_DATA_FRAME,
    			dataBody: JSON.stringify(loadedRows[i]),
    			token: token
    		};
        let jsonData = JSON.stringify(dataFrame);
        connection.sendUTF(jsonData);
      }

      let endDataFrame = {
        frameCategory: CLOUD_DATA_END_FRAME,
        dataBody: JSON.stringify({
					statusCode: STATUS_200_SYNC_END_OK,
					userName: null,
					password: null
				}),
        token: token
      };
      let jsonEndData = JSON.stringify(endDataFrame);
      connection.sendUTF(jsonEndData);

      let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + CLOUD_DATA_END_FRAME + ', Cloud data count: ' + loadedRows.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);
    });
  }

});
