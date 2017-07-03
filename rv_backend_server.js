#!/usr/bin/env node

// RVCloudSyndDataFrame: FrameCategory
const SYNC_DATA_REQUEST_WITH_GOOGLE = 'SYNC_DATA_REQUEST_WITH_GOOGLE'
const SYNC_DATA_RESPONSE    = 'SYNC_DATA_RESPONSE';
const	DEVICE_DATA_FRAME 		= 'DEVICE_DATA_FRAME';
const	DEVICE_DATA_END_FRAME = 'DEVICE_DATA_END_FRAME';
const	CLOUD_DATA_FRAME 			= 'CLOUD_DATA_FRAME';
const	CLOUD_DATA_END_FRAME 	= 'CLOUD_DATA_END_FRAME';

// RVCloudSyndDataFrame: StatusCode
const STATUS_200_SYNC_START_OK			  = 'STATUS_200_SYNC_START_OK';
const STATUS_200_SYNC_END_OK			    = 'STATUS_200_SYNC_END_OK';
const STATUS_204_NO_AUTH_TOKEN        = 'STATUS_204_NO_AUTH_TOKEN';
const STATUS_401_UNAUTHORIZED         = 'STATUS_401_UNAUTHORIZED';
const STATUS_404_NOT_FOUND            = 'STATUS_404_NOT_FOUND';

const WebSocketServer = require('websocket').server;
const https = require('https');
//  const http = require('http');

const dbclient = require('./dbclient');
// const dbclient = require('./dbclient_test');

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

  let userId;
  let lastSyncDate;
  let authToken;

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
    case SYNC_DATA_REQUEST_WITH_GOOGLE:
      onSyncDataRequestWithGoogle(dataFrame);
      break;

    case DEVICE_DATA_FRAME:
      onDeviceDataFrame(dataFrame);
      break;

    case DEVICE_DATA_END_FRAME:
      onDeviceDataEndFrame(dataFrame);
      break;
    
    default:
  }
}

  const GoogleAuth = require('google-auth-library');
  const auth = new GoogleAuth;
  const clientId = require('./auth_client_ids').googleClientId;
  const client = new auth.OAuth2(clientId, '', '');
  
  const onSyncDataRequestWithGoogle = (dataFrame) => {

    authToken = dataFrame.authToken;
    // console.log('authToken: ' + dataFrame.authToken);

    client.verifyIdToken(
        authToken,
        clientId,
        // Or, if multiple clients access the backend:
        //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3],
         (err, login) => {

          if (!err) {

            lastSyncDate = dataFrame.lastSyncDate;
            console.log('Last sync date from device: ' + lastSyncDate);

            const payload = login.getPayload();

            // console.log('payload');
            // console.dir(payload);
            
            userId = 'GOOGLE_USER_' + payload['sub'];

            const syncStartOKFrame = {
              frameCategory: SYNC_DATA_RESPONSE,
              statusCode: STATUS_200_SYNC_START_OK
            }
            sendDataFrame(syncStartOKFrame);

          } else {
            const syncStartNGFrame = {
              frameCategory: SYNC_DATA_RESPONSE,
              statusCode: STATUS_401_UNAUTHORIZED
            }
            sendDataFrame(syncStartNGFrame);
          } 
        });
  }


  const onDeviceDataFrame = (dataFrame) => {

    // console.log('authToken: ' + authToken.slice(0, 10));
    // console.log('dataFrame.authToken: ' + dataFrame.authToken.slice(0, 10));

  	if (dataFrame.authToken === authToken) {
			let data = JSON.parse(dataFrame.dataBody)
  		deviceDataArray.push(data);
  	} else {
      const responseDataFrame = {
        frameCategory: SYNC_DATA_RESPONSE,
        statusCode: STATUS_401_UNAUTHORIZED,
      };
      sendDataFrame(responseDataFrame);
  	}
  }

  const onDeviceDataEndFrame = (dataFrame) => {
  	if (dataFrame.authToken === authToken) {
      dataDB.saveDataArray(userId, deviceDataArray);
      let logMessage = 'Remote Address: ' + connection.remoteAddress + ', FrameCategory: ' + DEVICE_DATA_END_FRAME + ', Device data count: ' + deviceDataArray.length;
    	logger.loggerAction.info(logMessage);
    	console.log(new Date() + ' ' + logMessage);

      // todo ここからクラウド側のデータの伝送を始める
      sendCloudData();

  	} else {
  		const responseDataFrame = {
        frameCategory: SYNC_DATA_RESPONSE,
        statusCode: STATUS_401_UNAUTHORIZED,
      };
      sendDataFrame(responseDataFrame);
  	}
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

  const sendCloudData = () => {
    dataDB.loadDataLaterThanTime(userId, lastSyncDate, (loadedRows) => {

      loadedRows.forEach((row) => {
        const cloudDataFrame = {
          frameCategory: CLOUD_DATA_FRAME,
          authToken: authToken,
          dataBody: JSON.stringify(row),
        };
        connection.sendUTF(JSON.stringify(cloudDataFrame));
      });

      const cloudDataEndFrame = {
        frameCategory: CLOUD_DATA_END_FRAME,
        statusCode: STATUS_200_SYNC_END_OK,
        authToken: authToken,
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
