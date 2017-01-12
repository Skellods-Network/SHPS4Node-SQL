'use strict';

const nml = require('node-mod-load');
const libs = nml('SHPS4Node-SQL').libs;


libs['SQL.h'].prototype._init = function () {

    // use init system to create pools for all available DB configs with minPool=0 so no connection is established when none is needed

    this.dbs = {};

    nml('SHPS4Node').libs['Schedule'].schedule.addSlot('afterInitialization', () => {

        this.dbs = nml('SHPS4Node').libs['Config'].getAllDBs().preparePools();
    });
};
