'use strict';


module.exports =

    /**
     * Class for querying a SQL database
     */
    class SQLConnection {

        /**
         * Constructor
         *
         * @param {Object} $dbConfig
         *   DBConfig as found in the config object
         */
        constructor($dbConfig) { this._init($dbConfig); };


    };
