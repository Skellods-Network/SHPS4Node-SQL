'use strict';

const Result = require('result-js');

const nml = require('node-mod-load');
const libs = nml('SHPS4Node-SQL').libs;


libs['SQL.h'].prototype.getConnection = function ($requestState, $alias = 'default') {

    // Knox handles the connection stuff under the hood and the Connection class can add the SHPS sugar

    // Also the initialization should make sure that the necessary db modules are installed. This will be darn hard!

    let parVal;

    if ($requestState instanceof nml('SHPS4Node').libs['RequestState']) {

        parVal = $requestState;
    }
    else {

        return Result.fromError(new Error('$requestState missing or of invalid type'));
    }

    const requestState = parVal;

    if (typeof $alias !== 'undefined') {

        parVal = $alias.toString();
    }
    else {

        return Result.fromError(new Error('$alias missing'));
    }

    const alias = parVal;


    return Result.fromSuccess(new libs['SQLConnection.h'](this.dbs[requestState.request.url.hostname][alias]));
};
