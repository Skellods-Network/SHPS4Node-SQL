'use strict';

var me = module.exports;

GLOBAL.SHPS_SQL_MYSQL = 0b10;
GLOBAL.SHPS_SQL_MSSQL = 0b10000;
GLOBAL.SHPS_SQL_SQLITE = 0b100000;

GLOBAL.SHPS_SQL_MARIA = SHPS_SQL_MYSQL | 0b100;
GLOBAL.SHPS_SQL_PERCONA = SHPS_SQL_MYSQL | 0b1000;

GLOBAL.SHPS_DB_COLTYPE_INT = 'INTEGER';
GLOBAL.SHPS_DB_COLTYPE_STRING = 'VARCHAR';
GLOBAL.SHPS_DB_COLTYPE_DECIMAL = 'DECIMAL';
GLOBAL.SHPS_DB_COLTYPE_REAL = 'REAL';
GLOBAL.SHPS_DB_COLTYPE_FLOAT = 'FLOAT';
GLOBAL.SHPS_DB_COLTYPE_DOUBLE = 'DOUBLE';
GLOBAL.SHPS_DB_COLTYPE_BOOL = 'TINYINT(1)';
GLOBAL.SHPS_DB_COLTYPE_TEXT = 'TEXT';

GLOBAL.SHPS_DB_KEY_PRIMARY = 'PRIMARY KEY';

GLOBAL.SHPS_ERROR_NO_ROWS = 'No rows were returned!';

var defer = require('promise-defer');
var mysql = require('mysql2');
var mssql = require('mssql');
var pooling = require('generic-pool');
var async = require('vasync');
var q = require('q');
var libs = require('node-mod-load').libs;
var sqlite = require('./sqlite-helper');

var _sqlConnectionPool = {};
var mp = {
    self: this
};

/**
 * SQL string determinators
 * 
 * @var array
 */
var _stringdeterminator = {};
_stringdeterminator[SHPS_SQL_MYSQL] = '\'';
_stringdeterminator[SHPS_SQL_MARIA] = '\'';
_stringdeterminator[SHPS_SQL_MSSQL] = '\'';
_stringdeterminator[SHPS_SQL_SQLITE] = '\'';

/**
 * SQL variable determinators
 * 
 * @var array
 */
var _variabledeterminator = {};
_variabledeterminator[SHPS_SQL_MYSQL] = ['`', '`'];
_variabledeterminator[SHPS_SQL_MARIA] = ['`', '`'];
_variabledeterminator[SHPS_SQL_MSSQL] = ['[', ']'];
_variabledeterminator[SHPS_SQL_SQLITE] = ['[', ']'];

var _paramDeclarator = {};
_paramDeclarator[SHPS_SQL_MYSQL] = ':';
_paramDeclarator[SHPS_SQL_MARIA] = ':';
_paramDeclarator[SHPS_SQL_MSSQL] = '@';
_paramDeclarator[SHPS_SQL_SQLITE] = ':';

/**
 * Alias Connections
 * 
 * @var array
 */
var _alias_connections = [];

/**
 * Memcached object
 * 
 * @var memcached
 */
var _memcached = null;

/**
 * Condition Builder currently in use
 * 
 * @var SHPS_sql_conditionBuilder
 */
var _conditionbuilder = null;

var _newCol 
= me.newCol = libs.sqlCol.newCol;

var _newRow 
= me.newRow = libs.sqlRow.newRow;

var _newTable 
= me.newTable = libs.sqlTable.newTable;

var _newConditionBuilder 
= me.newConditionBuilder = libs.sqlConditionBuilder.newSQLConditionBuilder;

/**
 * SQL Class<br>
 * For SQLite, a new file will be created if the database file is missing
 * 
 * @param string $user
 * @param string $passwd
 * @param string $database
 * @param string $host
 * @param string $prefix
 * @param array $mcServers [[(Sting)'Host',(Integer)['Port']],[...]]
 */
var _SQL = function ($dbConfig, $connection) {
    
    if (typeof $dbConfig === 'undefined') {
        
        throw ('Cannot work with undefined dbConfig!');
        return;
    }
    
    if (typeof $connection === 'undefined' || $connection === null) {
        
        throw ('Cannot work without connection!');
        return;
    }
    
    var mp = {
        self: this
    };
    
    /**
     * Total count of SQL queries
     * 
     * @var integer
     */
    var _queryCount = 0;
    
    /**
     * Total time of all SQL queries
     * 
     * @var integer
     */
    var _queryTime = 0;
    
    /**
     * Time last query needed to complete
     * 
     * @var integer
     */
    var _lastQueryTime = 0;
    
    /**
     * Database type
     * 
     * @var integer
     */
    var _dbType = 0;
    
    /**
     * PDO link
     * 
     * @var PDO
     */
    var _connection = null;
    
    /**
     * Connection status
     * 
     * @var boolean
     */
    var _free = false;
    
    /**
     * Containes the last executed query
     * 
     * @var string
     */
    var _lastQuery = '';
    
    /**
     * Containes the last query's statement
     * 
     * @var PDOStatement
     */
    var _statement = null;
    
    /**
     * Contains Table/Col info : [INDEX][table,columne]
     * 
     * @var array of array of strings
     */
    var _tblInfo = [];
    
    /**
     * Index of next row to fetch
     * 
     * @var type 
     */
    var _fetchIndex = 0;
    
    /**
     * Server Type
     * 
     * @var string
     */
    var _serverType = '';
    
    /**
     * Tables to include in current query
     * 
     * @var array of string
     */
    var _includeTable = [];
    
    /**
     * Array with results of last query
     * 
     * @var array of sqlRow
     */
    var _resultRows = [];
    
    /**
     * Array with field catalogue of last query
     * 
     * @var array of Object
     */
    var _resultFields = [];
    

    /**
     * Make a new SQL query
     * 
     * @param string $query OPTIONAL
     * @param string $domain Needed for $param
     *   // Deprecated since v4.3.1
     * @param mixed $param several parameters for SQL statement
     * @return mixed
     *   Promise([]) if a query was given, else a queryBuilder object is returned
     */
    var _query 
    = this.query = function ($query, $domain, $param) {
        
        _free = false;
        _fetchIndex = -1;
        
        if (typeof $query === 'undefined') {

            return libs.sqlQueryBuilder.newSQLQueryBuilder(this);
        }
        
        if ($domain && !$param) {
        
            $param = $domain;
        }
    
        _lastQuery = $query;
        _queryCount++;
        
        var defer = q.defer();
        var start = process.hrtime();
        var cb = ($err, $rows, $fields) => {
            
            var t = process.hrtime(start);
            _lastQueryTime = t[0] + (t[1] / 1000000000);
            _queryTime += _lastQueryTime;
            
            if ($err) {
                
                defer.reject(new Error($err));
            }
            else {
                
                _resultRows = $rows;
                _resultFields = $fields;
                defer.resolve($rows);
            }
        };
        
        if (typeof $param !== 'undefined') {
        
            switch(_dbType) {
                
                case SHPS_SQL_MARIA:
                case SHPS_SQL_MYSQL: {

                    //TODO
                    // This is the reference implementation for custom params from https://www.npmjs.com/package/mysql#custom-format
                    // I am pretty sure it can be enhanced a lot (e.g. when strings contain `:param`)
                    $connection.config.queryFormat = function ($query, $values) {

                        if (!$values) {

                            return $query;
                        }

                        //TODO cache prepared regex somewhere
                        return $query.replace(new RegExp('\\' + _getParamDeclarator() + '(\\w+)', 'g'), ($txt, $key) => {

                            if ($values.hasOwnProperty($key)) {

                                return this.escape($values[$key]);
                            }

                            return $txt;
                        });
                    };

                    var query = mysql.format($query, $param/*, true, libs.config.getHPConfig('generalConfig', 'timezone', $domain)*/);
                    $connection.query(query, $param, cb);
                    break;
                }
                
                case SHPS_SQL_MSSQL: {
                    
                    var ps = new mssql.PreparedStatement($connection);

                    for (var key in $param) {

                        if (!$param.hasOwnProperty(key)) {

                            continue;
                        }

                        //TODO check fields against table's fieldcat (retrived from DB server) in order to get the right type and length
                        //For now I will just guess everything from the value (which is highly suboptimal)
                        switch (typeof $param[key]) {

                            case 'number': {

                                if ($param[key] % 1 === 0) {

                                    ps.input(key, mssql.Int);
                                }
                                else {

                                    ps.input(key, mssql.Decimal);
                                }

                                break;
                            }

                            case 'string': ps.input(key, mssql.VarChar); break;
                            case 'boolean': ps.input(key, mssql.TinyInt); break;
                        }

                    }

                    ps.prepare($query, $err => {
                        
                        if ($err) {
                            
                            defer.reject($err);
                            return;
                        }
                     
                        ps.execute($param, function($err, $recordset) {

                            if ($err) {

                                defer.reject($err);
                            }
                            else {

                                defer.resolve($recordset);
                            }
                     
                            ps.unprepare(function($err) {

                                if ($err) {

                                    defer.reject($err);
                                }
                            });
                        });
                    });
                    
                    break;
                }
                
                case SHPS_SQL_SQLITE: {
                    
                    $connection.query($query, $param, cb);
                    break;
                }
            }
        }
        else {
            
            $connection.query($query, cb);
        }
        
        return defer.promise;
    };

    /**
     * Standardizes names in a SQL query by adding determinators
     * 
     * @param string $var
     * @return string
     */
    var _standardizeName 
    = this.standardizeName = function ($var) {
        
        /*let*/var s = _variabledeterminator[_dbType][0];
        /*let*/var e = _variabledeterminator[_dbType][1];
        if ($var !== '*' 
            && $var.substring(0, 1) !== s 
            && $var.substring(-1) !== e) {
            
            $var = s + libs.SFFM.cleanStr($var) + e;
        }
        
        return $var;
    };

    var _genParamName
    = this.genParamName = function f_sql_genParamName ($prefix, $paramNum) {

        var p = $prefix;
        if (!p) {

            p = '';
        }

        var n = $paramNum;
        if (!n) {

            n = 0;
        }

        return _getParamDeclarator() + p + 'p' + n;
    };
    
    var _getParamDeclarator
    = this.getParamDeclarator = function f_sql_getParamDeclarator() {
        
        return _paramDeclarator[_dbType];
    };
    
    /**
     * Standardizes strings in a SQL query by adding determinators
     * 
     * @param string $str
     * @return string
     */
    var _standardizeString 
    = this.standardizeString = function ($str) {
        
        $str = libs.SFFM.cleanStr($str);
        /*let*/var s = _stringdeterminator[_dbType];
        if ($str.substring(0, 1) != s 
            && $str.substring(-1) != s) {
            
            $str = s + $str + s;
        }
        
        return $str;
    }
    
    /**
     * Get query count
     * 
     * @return integer
     */
    var _getQueryCount 
    = this.getQueryCount = function () {
        
        return 0;
    }
    
    /**
     * Get overall query time
     * 
     * @return integer
     */
    var _getQueryTime 
    = this.getQueryTime = function () {
        
        return 0;
    }
    
    /**
     * Get time the last query needed to complete
     * 
     * @return integer
     */
    var _getLastQueryTime 
    = this.getLastQueryTime = function () {
        
        return _lastQueryTime;
    }
    
    /**
     * Get connection count
     * 
     * @return integer
     */
    var _getConnectionCount 
    = this.getConnectionCount = function () {
        
        return 0;
    }
    
    var _hasTable = function f_sql_hasTable($db, $name) {

        var d = q.defer();

        var table = _openTable($name);
        var query = `
            SELECT COUNT(${_standardizeName('table_name') }) AS ${_standardizeName('c')}
            FROM ${_standardizeName('information_schema')}.${_standardizeName('tables')}
            WHERE
                ${_standardizeName('table_name')} = '${table.toString()}'`;
                
        
        switch ($dbConfig.type.value) {

            case SHPS_SQL_MSSQL: {

                query += ' AND ' + _standardizeName('TABLE_CATALOG') + '=\'' + $db + '\';';
                break;
            }

            case SHPS_SQL_MYSQL:
            case SHPS_SQL_MARIADB: {

                query += ' AND ' + _standardizeName('TABLE_SCHEMA') + '=\'' + $db + '\';';
                break;
            }

            default: {
                
                // I might make it reject earlier for better performance, but let's see how this turns out
                d.reject(new Error('Unknown Database Type'));
                return d.promise;
            }
        }

        // The next line should decrease DB traffic by saving bytes. Is this really useful?
        query = query.replace(/[\r\n\t]/gi, ' ').replace(/ +/gim, ' ');
        
        // Hmm, I might have to be careful not to overwrite stuff by internally executing queries...
        _query(query).done($rows => {

            if ($rows.length <= 0) {

                d.reject(SHPS_ERROR_NO_ROWS);
            }
            else {

                d.resolve($rows[0].c > 0);
            }
        }, d.reject);

        return d.promise;
    };

    this.initDB = function($templateType) {

        const d = q.defer();

        var template;
        try {

            template = libs.config.getTemplate($templateType);
        }
        catch ($err) {

            d.reject($err);
            return d.promise;
        }

        var i = 0;
        const keys = Object.keys(template.tables);
        const l = keys.length;
        const proms = [];
        while (i < l) {

            //TODO: check if we should devide this task into several cycles in order to not disturb regular server tasks

            let fieldCat;
            let j;
            let fcKeys;
            let c;
            let index;

            fieldCat = [];
            j = 0;
            fcKeys = Object.keys(template.tables[keys[i]].fieldcat);
            c = fcKeys.length;
            while (j < c) {

                index = fieldCat.push(Object.assign({}, template.tables[keys[i]].fieldcat[fcKeys[j]]));
                index--;

                fieldCat[index].name = fcKeys[j];
                if (fieldCat[index].key === 'primary') {

                    fieldCat[index].key = SHPS_DB_KEY_PRIMARY;
                    fieldCat[index].autoincrement = true;
                }

                switch (fieldCat[index].type.toLowerCase()) {

                    case 'uint': {

                        // hard to add, so we will just make it an integer for now
                        // See Skellods-Network/SHPS4Node-SQL#8
                    }
                    case 'integer':
                    case 'int': {

                        fieldCat[index].type = SHPS_DB_COLTYPE_INT;
                        break;
                    }

                    case 'string': {

                        fieldCat[index].type = `${SHPS_DB_COLTYPE_STRING}(${fieldCat[index].length})`;
                        break;
                    }

                    case 'text': {

                        // See Skellods-Network/SHPS4Node-SQL#8
                        fieldCat[index].type = 'TEXT';
                        break;
                    }

                    case 'bool':
                    case 'boolean': {

                        // See Skellods-Network/SHPS4Node-SQL#8
                        fieldCat[index].type = 'TINYINT(1)';
                        break;
                    }

                    default: {

                        throw new Error(`Unknown field type: ${fieldCat[index].type}`);
                    }
                }

                j++;
            }

            let currentTable = keys[i];
            let lProm = defer();
            proms.push(lProm);

            let curTbl = this.openTable(currentTable);
            this.createTable(
                curTbl.getFullName(),
                template.tables[keys[i]].charset ? template.tables[keys[i]].charset[this.getServerType()] || 'utf8mb4' : 'utf8mb4',
                template.tables[keys[i]].charset ? template.tables[keys[i]].collate[this.getServerType()] || 'utf8mb4_unicode_ci' : 'utf8mb4_unicode_ci',
                fieldCat
            ).done($r => {

                if (template.tables[currentTable].initial) {

                    const insertProms = [];
                    var i = 0;
                    const l = template.tables[currentTable].initial.length;
                    while (i < l) {

                        let p = defer();
                        insertProms.push(p);
                        curTbl.insert(template.tables[currentTable].initial[i]).done(p.resolve, p.reject);
                        //TODO: check default data against template and correct it where necessary

                        i++;
                    }

                    Promise.all(insertProms).then(lProm.resolve, lProm.reject);
                }
                else {

                    lProm.resolve();
                }
            }, $err => {

                lProm.reject($err);
            });

            i++;
        }

        Promise.all(proms).then(d.resolve, d.reject);
        return d.promise;
    };

    /**
     * Create a custom Table and return table object
     * This method will automatically respect any prefix
     * 
     * @return Q::Promise(O:Table)
     */
    var _createTable
        = this.createTable = function f_sql_createTable (/*{  // Node.JS v4.x does not allow for destructuring :/

            name = '',
            charset = 'utf8mb4',
            collate = 'utf8mb4_unicode_ci',
            fieldset = [
                {
                    name: 'ID',
                    'type': SHPS_DB_COLTYPE_INT,
                    key: SHPS_DB_KEY_PRIMARY,
                    'null': false,
                    'default': undefined,
                    autoincrement: true,
                    comment: 'Just a sample',
                }
            ],
        } = {}*/
            name, charset, collate, fieldset
        ) {
            charset = typeof charset !== 'undefined' ? charset : 'utf8mb4';
            collate = typeof collate !== 'undefined' ? collate : 'utf8mb4_unicode_ci';

            // Why I did not write a createTable method for such a long time even though it's so useful?
            // Bc I hate queries and this one is especially annoying to construct since you need so much knowledge about the DB itself

            //TODO: Check if table exists. If yes, compare fieldset. If possible, extend fieldset. Else reject
            //if (_hasTable(_getDB(), name)) {
            //
            //}

            var query = 'CREATE TABLE ' + _standardizeName(name) + '(';
            var i = 0;
            var l = fieldset.length;
            while (i < l) {

                query += _standardizeName(fieldset[i].name) + ' ' + fieldset[i].type + (fieldset[i].null ? ' ' : ' NOT') + ' NULL'; /* COMMENT*/
                if (typeof fieldset[i].default !== 'undefined') {

                    query += ' DEFAULT ' + fieldset[i].default; //TODO: add string delimiters if necessary! Change Date Obj to String (or INT Timestamp??)
                }

                if (fieldset[i].autoincrement) {

                    if (_dbType === SHPS_SQL_SQLITE) {

                        fieldset[i].key = SHPS_DB_KEY_PRIMARY;
                        query += ' AUTOINCREMENT';
                    }
                    else if ((_dbType & SHPS_SQL_MYSQL) == SHPS_SQL_MYSQL) {

                        query += ' AUTO_INCREMENT';
                    }
                    else if (_dbType === SHPS_SQL_MSSQL) {

                        query += ' IDENTITY(1,1)';
                    }
                    else {

                        libs.coml.writeError(`Could not add the attribute \`AUTOINCREMENT\` on column ${_standardizeName(name)}.${_standardizeName(fieldset[i].name)}!`);
                    }

                    //TODO add left-statement to QueryBuilder
                }

                if (typeof fieldset[i].key !== 'undefined') {

                    query += ' ' + fieldset[i].key;
                }

                if (typeof fieldset[i].comment !== 'undefined') {

                    query += ' COMMENT ' + _standardizeString(fieldset[i].comment);
                }

                i++;

                if (i < l) {

                    query += ',';
                }
            }

            query += ')';

            if (_dbType & SHPS_SQL_MYSQL) {

                if (_dbType & SHPS_SQL_MARIA) {

                    query += ' ENGINE=ARIA';
                }
                else {

                    query += ' ENGINE=InnoDB';// or ENGINE=MyISAM if available (check engine-list first!)
                }

                // ENCRYPTION='N'  <-- this might be activated later on, but I first need a way to securely store passwords
                query += ' DEFAULT CHARSET=' + charset + ' COLLATE=' + collate;
            }

            query += ';';

            var r = null;
            if (_dbType === SHPS_SQL_SQLITE) {

                var d = q.defer();
                _query(query).done($r => {

                    $connection.flush().then(() => {

                        d.resolve($r);
                    }, $e => {

                        d.reject($e);
                    });
                }, d.reject);

                r = d.promise;
            }
            else {

                r = _query(query);
            }

            return r;
        };
    
    /**
     * Get Server Type
     * 
     * @return string
     */
    var _getServerType 
    = this.getServerType = function () {
        
        return _dbType;
    }
    
    this.flush = function () {

        if ($connection.flush) {

            return $connection.flush();
        }
        else {
            
            return Promise.resolve();
        }
    };

    /**
     * Return table object
     * 
     * @param string $name
     * @return sql_table
     */
    var _openTable 
    = this.openTable = function ($name) {
        
        return libs.sqlTable.newTable(this, $name);
    }
    
    /**
     * Return last SQL Query as string
     * 
     * @return string
     */
    var _getLastQuery 
    = this.getLastQuery = function () {
        
        return _lastQuery;
    }
    
    /**
     * Return last error
     * 
     * @return string
     */
    var _getLastError 
    = this.getLastError = function () {
        
        return '';
    }
    
    /**
     * Get all results
     * 
     * @return Array of sql_resultrow
     */
    var _fetchResult 
    = this.fetchResult = function () {
        
        return [];
    };

    /**
     * Get query result from cache
     *
     * @param $key mixed
     * @returns {*}
     */
    this.getFromCache = function ($key) {

        return libs.cache.load(this.requestState, $key);
    };
    
    /**
     * Get one result row
     * 
     * @return sql_resultrow
     */
    var _fetchRow 
    = this.fetchRow = function () {
        
        _fetchIndex++;
        return _resultRows[_fetchIndex];
    };
    
    /**
     * Free the SQL connection so it can be reused
     */
    var _free =
    this.free = function f_sql_SQL_free() {
        
        switch ($dbConfig.type.value) {

            case SHPS_SQL_SQLITE:
            case SHPS_SQL_MSSQL: {

                _sqlConnectionPool[_makePoolName($dbConfig)].release($connection);
                break;
            }
            
            case SHPS_SQL_MARIA:
            case SHPS_SQL_MYSQL: {

                $connection.release();
            }
        }
        
        _free = true;
    };
    
    /**
     * Check if the current connection has already been freed.
     * Do never use freed connections, get a new one
     * 
     * @result boolean
     */
    var _isFree =
    this.isFree = function f_sql_isFree() {
        
        return _free;
    };
    
    var _getAlias =
    this.getAlias = function f_sql_getAlias() {
        
        return $alias;
    };
    
    var _getRequestState =
    this.getRequestState = function f_sql_getRequestState() {
        
        return this.requestState;
    };
    
    /**
     * Get DB name
     * 
     * @result string
     */
    var _getDB 
    this.getDB = function f_sql_getDB() {
        
        return $dbConfig.name.value;
    };
    
    /**
     * Get prefix which is currently used for the tables
     * 
     * @result string
     */
    var _getPrefix 
    this.getPrefix = function f_sql_getPrefix() {
        
        return $dbConfig.prefix.value;
    };
    
    /**
     * CONSTRUCTOR
     */
    switch ($dbConfig.type.value) {

        case SHPS_SQL_MYSQL: {
            
            _query('SET NAMES \'UTF8\'; SET SESSION sql_mode=\'NO_AUTO_VALUE_ON_ZERO\';').done();
            _dbType = SHPS_SQL_MYSQL;
            _query('SELECT VERSION();').done(function ($res) {
                
                if ($res[0]['VERSION()'].indexOf('MariaDB') > 0) {
                    
                    _dbType |= SHPS_SQL_MARIA;
                }
            });
            
            break;
        }

        default: {
            
            _dbType = $dbConfig.type.value;
        }
    }
    
    _free = true;
};


/**
 * Get connection count
 * 
 * @todo implement
 * @return integer
 */
var _getConnectionCount 
= me.getConnectionCount = function f_sql_getConnectionCount($requestState) {
    if (typeof $requestState !== 'undefined') {
        
        log.error('Cannot connect with undefined requestState!');
    }
    
    return -1;
};

var _makePoolName = function f_sql_makePoolName($dbConfig) {

    var tmp = 
        $dbConfig.type.value.toString() +
        $dbConfig.host.value +
        $dbConfig.port.value.toString() +
        $dbConfig.name.value +
        $dbConfig.user.value +
        $dbConfig.prefix.value;
    return tmp;
};

var _makeErrorObject = function f_sql_makeErrorObject ($dbConfig, $err) {

    $err.conf = $dbConfig;
    $err.toString = function () {

        return ($err.fatal ? 'FATAL ' : '') + 'ERROR: ' + $err.code + ' on DB ' + $dbConfig.host.value + ':' + $dbConfig.port.value + ' -> ' + $dbConfig.user.value + '@' + $dbConfig.name.value;
    };

    return $err;
};

/**
 * Create new managed SQL connection from alias (see config file)
 * 
 * @param string $alias //Default: 'default'
 * @param $requestState requestState Object
 * @return promise(SQL)
 */
var _newSQL 
= me.newSQL = function f_sql_newSQL($alias, $requestState) {
    $alias = (typeof $alias !== 'undefined' ? $alias : 'default');
    
    var defer = q.defer();
    if (typeof $requestState === 'undefined') {
        
        var str = 'Cannot connect to DB with undefined requestState!';
        defer.reject(str);

        return defer.promise;
    }

    if (typeof $requestState.config === 'undefined') {

        var str = 'Cannot connect to DB without known configuration for ' + $requestState.uri + '!';
        defer.reject(str);

        return defer.promise;
    }
    
    
    if (!$requestState.config.databaseConfig[$alias]) {

        var str = 'Cannot connect with undefined alias `' + $alias + '`!';
        defer.reject(str);
        
        return defer.promise;
    }

    var config = $requestState.config;
    var dbConfig = config.databaseConfig[$alias];
    var poolName = _makePoolName(dbConfig);
    var log = libs.log.newLog($requestState);

    var nPool = _sqlConnectionPool[poolName];
    if (typeof nPool === 'undefined') {
        
        switch (dbConfig.type.value) {

            case SHPS_SQL_MYSQL: {
                
                _sqlConnectionPool[poolName] = nPool = mysql.createPool({
                    
                    connectionLimit: dbConfig.connectionLimit.value,
                    host: dbConfig.host.value,
                    port: dbConfig.port.value,
                    user: dbConfig.user.value,
                    password: dbConfig.pass.value,
                    database: dbConfig.name.value,
                    charset: 'utf8mb4_general_ci',
                    timezone: config.generalConfig.timezone.value,
                    multipleStatements: true
                });
                
                nPool.on('connection', function ($con) {
                        
                    $con.on('error', function ($err) {

                        libs.coml.writeError('DB ERROR: ' + $err.code);
                    });
                });
                
                nPool.on('enqueue', function () {
                        
                    // Use optimizer here to ask admin for higher connection limit
                });
                
                nPool.getConnection(function ($err, $con) {
                    
                    if (!$err) {
                        
                        const sql = new _SQL(dbConfig, $con);
                        sql.requestState = $requestState;
                        defer.resolve(sql);
                    }
                    else {

                        defer.reject(_makeErrorObject(dbConfig, $err));
                    }
                });

                break;
            }

            case SHPS_SQL_SQLITE: {

                _sqlConnectionPool[poolName] = nPool = pooling.Pool({

                    name: poolName,
                    create: function f_sql_newSQL_create_SQLITE_pool($cb) {

                        $cb(null, new sqlite(dbConfig.host.value));
                    },
                    destroy: function f_sql_newSQL_destroy_MSSQL_pool($res) {

                        $res.flush();
                    },
                    max: dbConfig.connectionLimit.value,
                    min: 1,
                    idleTimeoutMillis: 30000,
                    log: false
                });

                nPool.acquire(function ($err, $client) {

                    if ($err === null) {

                        const sql = new _SQL(dbConfig, $client);
                        sql.requestState = $requestState;
                        defer.resolve(sql);
                    }
                    else {

                        defer.reject(_makeErrorObject(dbConfig, $err));
                    }

                });

                break;
            }

            case SHPS_SQL_MSSQL: {
                
                _sqlConnectionPool[poolName] = nPool = pooling.Pool({
                        
                    name: poolName,
                    create: function f_sql_newSQL_create_MSSQL_pool($cb) {
                        
                        var con = new mssql.Connection({
                            
                            server: dbConfig.host.value,
                            port: dbConfig.port.value,
                            user: dbConfig.user.value,
                            password: dbConfig.pass.value,
                            database: dbConfig.name.value
                        });

                        con.connect(function ($err) {

                            $cb($err, con);
                        });
                    },
                    destroy: function f_sql_newSQL_destroy_MSSQL_pool($res) {
                        
                        if (typeof $res.connection !== 'undefined') {

                            $res.connection.close();
                        }
                    },
                    max: dbConfig.connectionLimit.value,
                    min: 1,
                    idleTimeoutMillis: 30000,
                    log: false
                });

                nPool.acquire(function ($err, $client) {
                    
                    if ($err === null) {

                        const sql = new _SQL(dbConfig, new mssql.Request($client));
                        sql.requestState = $requestState;
                        defer.resolve(sql);
                    }
                    else {

                        defer.reject(_makeErrorObject(dbConfig, $err));
                    }
                    
                });

                break;
            }

            default: {

                log.error('Database type not supported!');
            }
        }
    }
    else {
        
        switch (dbConfig.type.value) {

            case SHPS_SQL_MYSQL:
            case SHPS_SQL_MARIA: {

                nPool.getConnection(function ($err, $con) {
                    
                    if ($err) {

                        defer.reject(_makeErrorObject(dbConfig, $err));
                    }
                    else {

                        const sql = new _SQL(dbConfig, $con);
                        sql.requestState = $requestState;
                        defer.resolve(sql);
                    }
                });

                break;
            }

            case SHPS_SQL_SQLITE: {

                nPool.acquire(function ($err, $client) {

                    if ($err) {

                        defer.reject(_makeErrorObject(dbConfig, $err));
                    }
                    else {

                        const sql = new _SQL(dbConfig, new mssql.Request($client));
                        sql.requestState = $requestState;
                        defer.resolve(sql);
                    }
                });

                break;
            }

            case SHPS_SQL_MSSQL: {

                nPool.acquire(function ($err, $client) {
                    
                    if ($err) {
                        
                        defer.reject(_makeErrorObject(dbConfig, $err));
                    }
                    else {
                        
                        if (!$client.query) {

                            $client.query = function ($query, $cb) {

                                var req = new mssql.Request($client);
                                req.query($query, $cb);
                            };
                        }

                        const sql = new _SQL(dbConfig, new mssql.Request($client));
                        sql.requestState = $requestState;
                        defer.resolve(sql);
                    }
                });

                break;
            }
        }
    }

    return defer.promise;
};

/**
 * SHPS_sql_colspec
 * 
 * @param $table sql_table Object
 * @param $col string
 */
var sql_colspec = function f_sql_sql_colspec($table, $col) {
    if (typeof $table !== typeof sql_table || typeof $col !== 'string') {
        
        throw('Wrong parameters: ' + typeof $table + ' / ' + typeof $col + '!');
        return;
    }
    
    
    /**
     * Columne as SQL string
     * 
     * @return string
     */
    var _toString =
    this.toString = function f_sql_sql_colspec_toString() {
        
        return $table.getSQL().standardizeName($table.getSQL().getDB()) +
                '.'.$table.getSQL().standardizeName($table.getFullName()) +
                '.'.$table.getSQL().standardizeName($col);
    }
    
    /**
     * Get table
     * 
     * @return SHPS_sql_table
     */
    var _getTable = 
    this.getTable = function f_sql_sql_colspec_getTable() {
        
        return $table;
    }
    
    /**
     * Get Columne name
     * 
     * @return string
     */
    var _getColName =
    this.getColName = function f_sql_sql_colspec_getColName() {
        
        return $col;
    }
    
    var _getSQL =
    this.getSQL = function f_sql_sql_colspec_getSQL() {
        
        return $table.getSQL();
    }
};


/**
 * Focus all DB actions on a given requestState
 * Basically this is a wrapper so web developers don't have to worry about which domain their scripts are served to
 *
 * @param requestState $requestState
 */
var _focus 
= me.focus = function c_sql_focus($requestState) {
    if (typeof $requestState === 'undefined') {

        throw ('Cannot focus undefined requestState!');
    }

    /**
     * Get connection count
     * 
     * @return integer
     */
    var getConnectionCount = function f_sql_focus_getConnectionCount() {
        
        return _getConnectionCount($requestState);
    };
    
    /**
     * Create new managed SQL connection from alias (see config file)
     * 
     * @param string $alias //Default: 'default'
     * @return sql
     */
    var _newSQL =
    this.newSQL = function f_sql_focus_newSQL($alias) {

        return me.newSQL($alias, $requestState);
    };
};
