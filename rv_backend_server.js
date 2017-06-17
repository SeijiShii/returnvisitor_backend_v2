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
const STATUS_201_CREATED              = "STATUS_201_CREATED";
const STATUS_202_AUTHENTICATED        = 'STATUS_202_AUTHENTICATED';
const STATUS_400_DUPLICATE_USER_NAME  = 'STATUS_400_DUPLICATE_USER_NAME';
const STATUS_400_SHORT_USER_NAME      = "STATUS_400_SHORT_USER_NAME";
const STATUS_400_SHORT_PASSWORD       = "STATUS_400_SHORT_PASSWORD";
const STATUS_401_UNAUTHORIZED         = "STATUS_401_UNAUTHORIZED";
const STATUS_404_NOT_FOUND            = 'STATUS_404_NOT_FOUND';

const WebSocketServer = require('websocket').server;
const https = require('https');

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

var connection;
wsServer.on('request', (req) => {

		connection = req.accept(null, req.origin);

    connection.on('message', function(message) {
      if (message.type === 'utf8') {
				let data_frame = JSON.parse(message);
				logger.loggerAction.info('Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + data_frame.frame_category);
				separateOnFrameCategory(data_frame);
      }
    });

    connection.on('close', (reasonCode, description) => {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

const separateOnFrameCategory(data_frame) => {
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
			onDevicedata_frame(data_frame.data_body, data_frame.token);
			break;

		case DEVICE_DATA_END_FRAME:
			onDeviceDataEndFrame(data_frame.token);
			break;

		default:

	}
}

const onLoginRequest(data_body) => {
	usersDB.login(data_body.user_name, data_body.password, (result) => {
		var response = {
			frame_category: LOGIN_RESPONSE,
			data_body: {
				status_code: result.status_code
			},
			token: null
		};
		var jsonRes = JSON.stringify(res);
		console.log('response: ' + jsonRes);
		socket.send(jsonRes);

		logger.loggerAction.info('Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + data_frame.frame_category+ ', status_code: ' + result.status_code);
	});
	break;
}

const onCreateUserRequest(dataBody) => {
	usersDB.createUser(data_body.user_name, data_body.password, (result) => {
		var response = {
			frame_category: LOGIN_RESPONSE,
			data_body: {
				status_code: result.status_code
			},
			token: null
		};
		var jsonRes = JSON.stringify(res);
		console.log('response: ' + jsonRes);
		socket.send(jsonRes);

		logger.loggerAction.info('Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + data_frame.frame_category+ ', status_code: ' + result.status_code);
	});
}

const onSyncDataRequest(dataBody) => {

}

const onDeviceDataFrame(dataBody, token) => {

}

const onDeviceDataEndFrame(token) => {

}
