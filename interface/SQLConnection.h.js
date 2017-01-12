'use strict';


module.exports = new (

    /**
     * Class for querying a SQL database
     */
    class SQLConnection {

        /**
         * Create an interface to a certain database/schema
         *
         * @param {RequestState} $requestState
         *   State to use for interfaces
         */
        constructor($requestState) { this._init($requestState); };

    }
);
