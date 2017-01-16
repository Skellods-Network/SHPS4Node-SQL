'use strict';

const libs = nml('SHPS4Node-SQL').libs;

const SQL = libs['SQLConnection.h'];


SQL.prototype._init = function ($dbConfig) {

    if (typeof this._isInitialized !== 'undefined') {

        throw new Error('This SQLConnection object has already been initialized!');
    }

    this._isInitialized = true;
    this._config = $dbConfig;
};
