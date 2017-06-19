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
const STATUS_201_CREATED              = 'STATUS_201_CREATED';
const STATUS_202_AUTHENTICATED        = 'STATUS_202_AUTHENTICATED';
const STATUS_400_DUPLICATE_USER_NAME  = 'STATUS_400_DUPLICATE_USER_NAME';
const STATUS_400_SHORT_USER_NAME      = 'STATUS_400_SHORT_USER_NAME';
const STATUS_400_SHORT_PASSWORD       = 'STATUS_400_SHORT_PASSWORD';
const STATUS_401_UNAUTHORIZED         = 'STATUS_401_UNAUTHORIZED';
const STATUS_404_NOT_FOUND            = 'STATUS_404_NOT_FOUND';

const WebSocketServer = require('websocket').server;
// const https = require('https');
const http = require('http');

const dbclient = require('./dbclient_test');

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

// const options = {
// 	key: fs.readFileSync(ssl_server_key),
//   cert: fs.readFileSync(ssl_server_crt)
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

  var authToken;
  var user_id;
  var lastSyncDate;
  var deviceDataArray = [];
	let connection = req.accept(null, req.origin);

  connection.on('message', (message) => {
    if (message.type === 'utf8') {
			// console.dir(message);
			// console.log('message: ' + message);
			let data_frame = JSON.parse(message.utf8Data)
			let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + data_frame.frame_category;
			logger.loggerAction.info(logMessage);
			console.log(new Date() + ' ' + logMessage);
			separateOnFrameCategory(data_frame);
    }
  });

  connection.on('close', (reasonCode, description) => {
      console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
  });

  let separateOnFrameCategory = (data_frame) => {
  	switch (data_frame.frame_category) {
  		case LOGIN_REQUEST:
  			onLoginRequest(data_frame.data_body);
  			break;

  		case CREATE_USER_REQUEST:
  			onCreateUserRequest(data_frame.data_body);
  			break;

  		case SYNC_DATA_REQUEST:
  			onSyncDataRequest(data_frame.data_body);
  			break;

  		case DEVICE_DATA_FRAME:
  			onDeviceDataFrame(data_frame.data_body, data_frame.token);
  			break;

  		case DEVICE_DATA_END_FRAME:
  			onDeviceDataEndFrame(data_frame.token);
  			break;

  		default:

  	}
  }

  const onLoginRequest = (data_body) => {
    lastSyncDate = data_body.last_sync_date;
  	usersDB.login(data_body.user_name, data_body.password, (result) => {
  		var data_frame = {
  			frame_category: LOGIN_RESPONSE,
  			data_body: {
  				status_code: result.status_code
  			},
  			token: null
  		};

  		sendDataFrame(data_frame);
  	});
  }

  const onCreateUserRequest = (data_body) => {
  	usersDB.createUser(data_body.user_name, data_body.password, (result) => {
  		var data_frame = {
  			frame_category: CREATE_USER_RESPONSE,
  			data_body: {
  				status_code: result.status_code
  			},
  			token: null
  		};

  		sendDataFrame(data_frame)
  	});
  }

  const onSyncDataRequest = (data_body) => {
  	usersDB.login(data_body.user_name, data_body.password, (result) => {
  		if (result.status_code === STATUS_202_AUTHENTICATED) {
  			authToken = require('./hashed_token')(result.user.user_id);
  			user_id = result.user.user_id;
  			var data_frame = {
  				frame_category: SYNC_DATA_RESPONSE,
  				data_body: {
  					status_code: STATUS_200_SYNC_START_OK
  				},
  				token: authToken
  			};
  			sendDataFrame(data_frame);

  		} else {
  			var data_frame = {
  				frame_category: SYNC_DATA_RESPONSE,
  				data_body: {
  					status_code: result.status_code
  				},
  				token: null
  			};
  			sendDataFrame(data_frame);

  		}
  	});
  }

  const onDeviceDataFrame = (data_body, token) => {
  	if (token === authToken) {
  		deviceDataArray.push(data_body);
  	} else {
  		var data_frame = {
  			frame_category: SYNC_DATA_RESPONSE,
  			data_body: {
  				status_code: STATUS_401_UNAUTHORIZED
  			},
  			token: null
  		};
  		sendDataFrame(data_frame);
  	}
  }

  const onDeviceDataEndFrame = (token) => {
  	if (token === authToken) {
      dataDB.saveDataArray(user_id, deviceDataArray);
      let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + DEVICE_DATA_END_FRAME + ', Device data count: ' + deviceDataArray.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);

      // todo ここからクラウド側のデータの伝送を始める
      sendCloudData(token);

  	} else {
  		var data_frame = {
  			frame_category: SYNC_DATA_RESPONSE,
  			data_body: {
  				status_code: STATUS_401_UNAUTHORIZED
  			},
  			token: null
  		};
  		sendDataFrame(data_frame);
  	}
  }

  const sendDataFrame = (data_frame) => {
  	var jsonRes = JSON.stringify(data_frame);
  	// console.log('response: ' + jsonRes);
  	connection.sendUTF(jsonRes);

  	let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + data_frame.frame_category + ', status_code: ' + data_frame.data_body.status_code;
  	logger.loggerAction.info(logMessage);
  	console.log(new Date() + ' ' + logMessage);
  }

  const sendCloudData = (token) => {
    dataDB.prototype.getDataLaterThanTime(user_id, last_sync_date, (loaded_rows) => {
      for ( var i = 0 ; i < loaded_rows.length ; i++ ) {
        let data_frame = {
    			frame_category: CLOUD_DATA_FRAME,
    			data_body: loaded_rows[i],
    			token: token
    		};
        let jsonData = JSON.stringify(data_frame);
        connection.sendUTF(jsonData);
      }

      let end_data_frame = {
        frame_category: CLOUD_DATA_END_FRAME,
        data_body: loaded_rows[i],
        token: token
      };
      let jsonEndData = JSON.stringify(end_data_frame);
      connection.sendUTF(jsonEndData):

      let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + CLOUD_DATA_END_FRAME + ', Cloud data count: ' + loaded_rows.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);
    });
  }

});
