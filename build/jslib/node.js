/**
 * @license RequireJS node Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */

/*jslint regexp: false, strict: false */
/*global require: false, define: false, requirejsVars: false, process: false */

/**
 * This adapter assumes that x.js has loaded it and set up
 * some variables. This adapter just allows limited RequireJS
 * usage from within the requirejs directory. The general
 * node adapater is r.js.
 */

(function () {
    var nodeReq = requirejsVars.nodeRequire,
        req = requirejsVars.require,
        def = requirejsVars.define,
        fs = nodeReq('fs'),
        path = nodeReq('path'),
        vm = nodeReq('vm');

    //Supply an implementation that allows synchronous get of a module.
    req.get = function (context, moduleName, relModuleMap) {
        if (moduleName === "require" || moduleName === "exports" || moduleName === "module") {
            req.onError(new Error("Explicit require of " + moduleName + " is not allowed."));
        }

        var ret,
            moduleMap = context.makeModuleMap(moduleName, relModuleMap);

        //Normalize module name, if it contains . or ..
        moduleName = moduleMap.fullName;

        if (moduleName in context.defined) {
            ret = context.defined[moduleName];
        } else {
            if (ret === undefined) {
                //Try to dynamically fetch it.
                req.load(context, moduleName, moduleMap.url);
                //The above call is sync, so can do the next thing safely.
                ret = context.defined[moduleName];
            }
        }

        return ret;
    };

    //Add wrapper around the code so that it gets the requirejs
    //API instead of the Node API, and it is done lexically so
    //that it survives later execution.
    req.makeNodeWrapper = function (contents) {
        return '(function (require, define) { ' +
                contents +
                '\n}(requirejsVars.require, requirejsVars.define));';
    };

    req.load = function (context, moduleName, url) {
        var contents, err;

        //isDone is used by require.ready()
        req.s.isDone = false;

        //Indicate a the module is in process of loading.
        context.loaded[moduleName] = false;
        context.scriptCount += 1;

        if (path.existsSync(url)) {
            contents = fs.readFileSync(url, 'utf8');

            contents = req.makeNodeWrapper(contents);
            try {
                vm.runInThisContext(contents, fs.realpathSync(url));
            } catch (e) {
                err = new Error('Evaluating ' + url + ' as module "' +
                                moduleName + '" failed with error: ' + e);
                err.originalError = e;
                err.moduleName = moduleName;
                err.fileName = url;
                return req.onError(err);
            }
        } else {
            def(moduleName, function () {
                try {
                    return nodeReq(moduleName);
                } catch (e) {
                    err = new Error('Calling node\'s require("' +
                                        moduleName + '") failed with error: ' + e);
                    err.originalError = e;
                    err.moduleName = moduleName;
                    return req.onError(err);
                }
            });
        }

        //Support anonymous modules.
        context.completeLoad(moduleName);

        return undefined;
    };

    //Override to provide the function wrapper for define/require.
    req.exec = function (text) {
        /*jslint evil: true */
        text = req.makeNodeWrapper(text);
        return eval(text);
    };
}());