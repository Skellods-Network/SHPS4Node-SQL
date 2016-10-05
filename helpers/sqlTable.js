'use strict';

var me = module.exports;

var q = require('q');
var async = require('vasync');

var libs = require('node-mod-load').libs;
var __log = null;
__defineGetter__('_log', function () {
    
    if (!__log) {
        
        __log = require('./log.js');
    }
    
    return __log;
});

var __nLog = null;
__defineGetter__('log', function () {
    
    if (!__nLog) {
        
        __nLog = _log.newLog();
    }
    
    return __nLog;
});


var _newTable 
= me.newTable = function f_sqlTable_newTable($sql, $name) {
    
    return new _sqlTable($sql, $name);
};

var _sqlTable = function c_sqlTable($sql, $name) {
    
    var mp = {
        self: this
    };
    
    /**
     * Gets a column of this table
     * 
     * @param string $name
     * @param string $asName
     *   Alias
     *   Default: undefined
     */
    var _col 
    this.col = function f_sqlTable_col($name, $asName) {

        return libs.sqlCol.newCol(this, $name, $asName);
    };
    
    /**
     * Returns parent SQL Object
     * 
     * @result SQL
     */
    var _getSQL =
    this.getSQL = function f_sqlTable_getSQL() {

        return $sql;
    };
    
    /**
     * Gets name of table without prefix
     * 
     * @result string
     */
    var _getName =
    this.getName = function f_sqlTable_getName() {

        return $name;
    };
    
    /**
     * Gets full name of table with prefix
     * 
     * @result string
     */
    var _getFullName =
    this.getFullName = function f_sqlTable_getFullName() {

        return $sql.getPrefix() + $name;
    };
    
    /**
     * Gets full name with prefix and with db name in query-conform format
     * 
     * @result string
     */
    var _getAbsoluteName =
    this.getAbsoluteName = function f_sqlTable_getAbsoluteName() {
        
        var tmp = $sql.getServerType();
        switch ($sql.getServerType()) {

            case SHPS_SQL_MSSQL: {

                return $sql.standardizeName($sql.getDB()) + '..' + $sql.standardizeName(_getFullName());
                break;
            }

            case SHPS_SQL_SQLITE: {

                return $sql.standardizeName(_getFullName());
                break;
            }
            
            case SHPS_SQL_MYSQL:
            default: {

                return $sql.standardizeName($sql.getDB()) + '.' + $sql.standardizeName(_getFullName());
            }
        }
        
    };
    
    /**
     * Same as getAbsoluteName()
     * 
     * @result string
     */
    var _toString 
    this.toString = function f_sqlTable_toString() {
    
        return _getAbsoluteName();
    }; 

    var _getAllColumns =
    this.getAllColumns = function f_sqlTable_getAllColumns() {
        
        return [];
    };
    
    /**
     * TODO
     */
    var _create =
    this.create = function f_sqlTable_sqlTable_create() {
        
        var te = '';
        var cs = 'utf8mb4';
        var tc = 'utf8mb4_unicode_ci';
        switch ($sql.getServerType()) {

            case SHPS_SQL_MYSQL: {

                return $sql.query('CREATE TABLE IF NOT EXISTS ' + _getAbsoluteName() + ' ( `ID` INT UNSIGNED NOT NULL AUTO_INCREMENT , PRIMARY KEY (`ID`) ) ENGINE = Aria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
            }
        }
        
    };
    
    /**
     * Reads data from this table
     * 
     * @param $cols
     *   Default: '*'
     * @result Promise([])
     *   Rows as array of Objects
     */
    var _get =
    this.get = function f_sqlTable_sqlTable_get($cols) {
        
        if ($cols == 'undefined') {

            $cols = _getAllColumns();
        }
        
        var i = 0;
        var l = $cols.length;
        var cols = [];
        while (i < l) {
            
            cols.push(_col($cols[i]));
            i++;
        }

        return libs.sqlQueryBuilder.newSQLQueryBuilder($sql)
            .get(cols)
            .execute();
    };

    /**
     * Drop table
     * 
     * @return Promise
     */
    var _drop =
    this.drop = function f_sqlTable_drop() {
        
        /*let*/var sql;
        $sql.isFree()
            ? sql = $sql
            : sql = libs.sql.newSQL($sql);
        
        var defer = q.defer();
        sql.query('DROP TABLE ' + _getAbsoluteName() + ';').done(function ($r) {
            
            sql.flush().then(defer.resolve.bind(null, $r), defer.reject);
            sql.free();
        }, function ($err) {
        
            defer.reject(new Error($err));
            sql.free();
        });

        return defer.promise;
    };
    
    /**
     * Insert rows into table
     * 
     * @param $vals
     *  Object or array of objects containing values (1 object / row)
     * 
     * @return Promise(Object|Array)
     *   The resolving object(s) will contain information about the insert(s), containing for example the row index
     */
    var _insert =
    this.insert = function f_sqlTable_insert($vals) {
        
        var defer = q.defer();
        if (typeof $vals === 'array') {// improve this by putting everything into a single query if possible!
            
            async.forEachParallel({
                
                inputs: $vals,
                func: ($val, $cb) => {
                    
                    _insert($val).done($cb.bind(null, null), $cb);
                },
            }, function f_sqlTable_insert_1($err, $res) {
            
                if ($err) {

                    defer.reject($err);
                }
                else {

                    defer.resolve($res);
                }
            });

            return defer.promise;
        }

        if (typeof $vals !== 'object') {

            throw ('Wrong parameters in f_sqlTable_insert()!');
            return;
        }

        var vals = [];
        var params = {};
        var paramNum = 0;
        var keys = [];
        var param;
        for (var key in $vals) {
            
            keys.push($sql.standardizeName(key));
            param = $sql.genParamName('v', paramNum++);
            params[param.substr(1)] = $vals[key];
            vals.push(param);
        }

        var query = 'INSERT INTO ' + _getAbsoluteName() + ' (' + keys + ') VALUES (' + vals + ');';
        if ($sql.getServerType() === SHPS_SQL_MSSQL) {

            query = `BEGIN TRY SET IDENTITY_INSERT ${this.getAbsoluteName()} ON; END TRY BEGIN CATCH END CATCH ${query} BEGIN TRY SET IDENTITY_INSERT ${this.getAbsoluteName()} OFF; END TRY BEGIN CATCH END CATCH`;
        }

        $sql.query(query, params).done($r => {

            $sql.flush().then(defer.resolve.bind(null, $r), defer.reject);
        }, defer.reject);

        return defer.promise;
    };
    
    /**
     * Delete data in this table
     * 
     * @param string $conditions
     *   If not set, a sqlConditionBuilder will be returned
     *   Default: undefined
     * @result Promise()|sqlConitionBuilder
     */
    var _delete =
    this.delete = function f_sqlTable_delete($conditions) {
    
        if (!$conditions) {
            
            return libs.sqlQueryBuilder.newSQLQueryBuilder($sql).delete(this).fulfilling();
        }

        var query = 'DELETE FROM ' + _getAbsoluteName() + ' WHERE ' + $conditions.toString();

        var defer = q.defer();
        $sql.query(query, $conditions.getParamValues()).done($r => {

            $sql.flush().then(defer.resolve.bind(null, $r), defer.reject);
        }, defer.reject);

        return defer.promise;
    };
    
    /**
     * Update data in this table
     * 
     * @param array of Objects $values
     * @param string $conditions
     *   If not set, a sqlConditionBuilder will be returned
     *   Default: undefined
     * @result Promise()|sqlConditionBuilder
     */
    var _update =
    this.update = function f_sqlTable_update($values, $conditions) {
        
        if (!$conditions) {
            
            return libs.sqlQueryBuilder.newSQLQueryBuilder($sql).set(this, $values).fulfilling();
        }

        var newVals = '';
        var first = true;
        var params = {};
        var paramNum = 0;
        var param;
        for (var key in $values) {

            if (first) {

                first = false;
            }
            else {

                newVals += ',';
            }

            param = $sql.genParamName('v', paramNum++);
            newVals += key + '=' + param;
            params[param.substr(1)] = $values[key];
        }

        params = Object.assign(params, $conditions.getParamValues());
        var query = 'UPDATE ' + _getAbsoluteName() + ' SET ' + newVals + ' WHERE ' + $conditions.toString() + ';';

        var defer = q.defer();
        $sql.query(query, params).done($r => {

            $sql.flush().then(defer.resolve.bind(null, $r), defer.reject);
        }, defer.reject);

        return defer.promise;
    };
};
