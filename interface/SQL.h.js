'use strict';


module.exports =

    /**
     * Class for connecting to a SQL database
     */
    class SQL {

        /**
         * Create an interface to a certain database/schema
         */
        constructor() { this._init(); };

        /**
         * Get connection in pool in order to query a db
         *
         * @param {RequestState} $requestState
         *   State to use for interfaces
         * @param {string} $alias
         *   Name of alias to connect to
         * @return {Result<SQLConnection, Error>}
         *   Usable connection in order to work with the DB
         */
        getConnection($requestState, $alias) { throw 'Not Implemented: getConnection'; };
    };

module.exports.DBTYPE_MYSQL = 0b10;         // 2
module.exports.DBTYPE_MSSQL = 0b10000;      // 16
module.exports.DBTYPE_SQLITE = 0b100000;    // 32
