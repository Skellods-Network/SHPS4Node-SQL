'use strict';

const knex = require('knex');
const nml = require('node-mod-load');

const libs = nml('SHPS4Node-SQL').libs;

const SQL = libs['SQL.h'];


SQL.prototype._init = function () {

    if (typeof this._isInitialized !== 'undefined') {

        throw new Error('This SQL object has already been initialized!');
    }

    this._isInitialized = true;
    this._dbs = new Map();

    nml('SHPS4Node').libs['Schedule'].schedule.addSlot('afterInitialization', () => {

        const config = nml('SHPS4Node').libs['Config'];
        const vHosts = config.getHostnames();

        let i = 0;
        const l = vHosts.length;
        while (i < l) {

            let url = vHosts[i].URL.value;
            this._dbs.set(url, new Map());
            for (let c of config.getDBConfig(url)) {

                const alias = config.getDBConfig(url, c, 'alias');
                let type = 'mysql';
                switch (config.getDBConfig(url, c, 'type')) {

                    case SQL.DBTYPE_MSSQL: type = 'mssql'; break;
                    case SQL.DBTYPE_SQLITE: type = 'sqlite'; break;
                }

                const connection = {};
                if (type !== 'sqlite') {

                    connection.host = config.getDBConfig(url, c, 'host');
                    connection.user = config.getDBConfig(url, c, 'user');
                    connection.password = config.getDBConfig(url, c, 'pass');
                    connection.database = config.getDBConfig(url, c, 'name');
                }
                else {

                    connection.filename = config.getDBConfig(url, c, 'host');
                }

                const knex = knex({

                    client: type,
                    pool: {
                        min: 0,
                        max: config.getDBConfig(url, c, 'connectionLimit'),
                    },
                    connection: connection,
                });

                if (type !== 'sqlite') {

                    this._dbs.get(url).set(alias, knex.withSchema(connection.database));
                }
                else {

                    this._dbs.get(url).set(alias, knex);
                }
            }

            i++;
        }
    });
};
