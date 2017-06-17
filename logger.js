// モジュールをインポートします
var log4js = require('log4js');
var logger = exports = module.exports = {};
// 設定を行います
log4js.configure({
    appenders: [

        // リクエストログ用設定
        {
            "type": "dateFile",
            "category": "request",
            "filename": "./logs/request.log",
            "pattern": "-yyyy-MM-dd"
        },

        // ユーザーアクションログ用
        {
            "type": "dateFile",
            "category": "action",
            "filename": "./logs/action.log",
            "pattern": "-yyyy-MM-dd"
        },
    ]
});

// リクエストログ用のLoggerを取得して、ログ出力します。
logger.loggerRequest = log4js.getLogger('request');

// アクションログ用のLoggerを取得して、ログ出力します。
logger.loggerAction = log4js.getLogger('action');
