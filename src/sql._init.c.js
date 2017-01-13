'use strict';

const knex = require('knex');
const nml = require('node-mod-load');

const libs = nml('SHPS4Node-SQL').libs;


libs['SQL.h'].prototype._init = function () {

    // use init system to create pools for all available DB configs with minPool=0 so no connection is established when none is needed

    this.dbs = new Map();

    nml('SHPS4Node').libs['Schedule'].schedule.addSlot('afterInitialization', () => {

        const config = nml('SHPS4Node').libs['Config'];
        const vHosts = config.getHostnames();

        let i = 0;
        const l = vHosts.length;
        while (i < l) {

            let url = vHosts[i].URL.value;
            this.dbs.set(url, {});
            let aliases = this.dbs.get(url);
            for (let c of config.getDBConfig(url)) {

                let alias = config.getDBConfig(url, c, 'alias');
                let type = 'mysql';
                switch (config.getDBConfig(url, c, 'type')) {

                    case 16: type = 'mssql'; break;
                    case 32: type = 'sqlite'; break;
                }

                let connection;
                if (type === 'sqlite') {

                    connection = {

                        filename: config.getDBConfig(url, c, 'host'),
                    }
                }
                else {

                    connection = {
                        host: config.getDBConfig(url, c, 'host'),
                        user: config.getDBConfig(url, c, 'user'),
                        password: config.getDBConfig(url, c, 'pass'),
                        database: config.getDBConfig(url, c, 'name'),
                    };
                }

                let knex = knex({

                    client: type,
                    pool: {
                        min: 0,
                        max: config.getDBConfig(url, c, 'connectionLimit'),
                    },
                    connection: connection,
                });

                if (type !== 'sqlite') {

                    knex = knex.withSchema(connection.database);
                }

                this.dbs.get(url).set(alias, knex);
            }

            i++;
        }
    });
};
