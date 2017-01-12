'use strict';


require('../interface/s-h.h.js').prototype.query = function ($str, $bindVals, $cb) {

    var stmt;
    try {

        if (arguments.length < 3) {

            $cb = $bindVals;
            $bindVals = undefined;
        }

        //TODO: improve this unsafe test
        if (/\W*?CREATE/i.test($str)) {

            return $cb(null, this.db.exec($str));
        }
        else {

            stmt = this.db.prepare($str);
        }

        if (!!$bindVals) {

            var tmp;
            for (var key in $bindVals) {

                if ($bindVals.hasOwnProperty(key)) {

                    tmp = $bindVals[key];
                    delete $bindVals[key];
                }

                // I do not really like the hardcoded `:`,
                // but since this module is specifically for SQLite it might be acceptable
                $bindVals[':' + key] = tmp;
            }
        }


        var arr = [];
        var firstRow = stmt.getAsObject($bindVals);
        if (!!firstRow && Object.keys(firstRow).length > 0) {

            arr.push(firstRow);
        }

        // If we step() on INSERT, data will be duplicated :/
        //TODO: improve this unsafe test
        if (/SELECT.+?FROM/i.test($str)) {

            while (stmt.step()) {

                arr.push(stmt.getAsObject($bindVals));
            }
        }

        stmt.free();
        $cb(null, arr);
    }
    catch ($e) {

        $cb($e);
    }
    finally {

        if (stmt && stmt.free) {

            stmt.free();
        }
    }
};
