/**
 * Copyright 2019 Jeremy Cook
 * Released under the MIT license
 * https://github.com/jeremycook/please-load/blob/master/LICENSE
 */
var please = {
    root: "/",
    cacheBuster: null,
    container: document.getElementsByTagName("head")[0],
    plugins: {
        "get-fragment": function (libOptions, callback, state) {
            var req = new XMLHttpRequest();
            req.addEventListener("load", function () {
                var div = document.createElement('div');
                div.innerHTML = this.responseText;

                callback(div);
            });
            req.open("GET", please.getLibPath(libOptions));
            req.send();
        },
        /**
         * 
         * @param {please.LibOptions} libOptions
         * @param {any} callback
         * @param {DocumentFragment} fragment
         */
        "insert-fragment-children": function (libOptions, callback, fragment) {

            if (!fragment) {
                throw new Error("Empty 'fragment' argument.")
            }

            var scriptNumber = 1;
            while (fragment.childNodes.length > 0) {
                var node = fragment.childNodes[0];
                if (node.nodeName.toUpperCase() === "SCRIPT") {
                    if (!node.type || node.type.toLowerCase() === "text/javascript") {
                        var sourceURL = please.getLibPath(libOptions);
                        var scriptId = node.getAttribute("id") || ("script-" + scriptNumber);
                        eval(node.innerHTML + "\n" +
                            "//# sourceURL=" + sourceURL + "#" + scriptId);

                        console.debug("eval: " + window.location.protocol + "//" + window.location.host + sourceURL + "#" + scriptId);

                        fragment.removeChild(node);
                        scriptNumber++;
                    }
                    else {
                        console.error("node", node);
                        throw new Error("Could not insert child of fragment 'node'. See console error for details.");
                    }
                }
                else if (node.nodeName.toUpperCase() === "TEMPLATE") {
                    var supportsTemplate = 'content' in document.createElement('template');
                    if (supportsTemplate) {
                        // Insert template as-is
                        please.container.appendChild(node);
                    }
                    else {
                        // Insert template as script
                        var script = document.createElement("script");
                        script.type = "text/html";
                        for (var i in node.attributes) {
                            var attr = node.attributes[i];
                            script[attr.name] = attr.value;
                        }
                        script.innerHTML = node.innerHTML;
                        please.container.appendChild(script);
                        fragment.removeChild(node);
                    }
                }
                else {
                    please.container.appendChild(node);
                }
            }

            if (fragment.remove) {
                fragment.remove();
            }
            else {
                delete fragment;
            }

            callback();
        },
        "console-log": function (libOptions, callback, state) {
            console.log(libOptions, state);
            callback(state);
        },
        "insert-script": function (libOptions, callback) {
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.async = true;
            script.addEventListener("load", function () {
                callback();
            });
            script.src = please.getLibPath(libOptions);
            please.container.appendChild(script);
        },
        "insert-link": function (libOptions, callback) {
            var link = document.createElement("link");
            link.rel = "stylesheet";
            link.async = true;
            link.addEventListener("load", function () {
                callback();
            });
            link.href = please.getLibPath(libOptions);
            please.container.appendChild(link);
        }
    },
    rules: [
        { test: "\\.css$", use: ["insert-link"] },
        { test: "\\.js$", use: ["insert-script"] },
        { test: "\\.html$", use: ["insert-fragment-children", "get-fragment"] }
    ],
    libs: {},
    LibOptions: function (lib, options) {
        throw new Error("Not initialized");
    },
    load: function (lib, callback) {
        throw new Error("Not initialized");
    },
    getAbsolutePath: function (relative) {
        throw new Error("Not initialized");
    },
    getLibPath: function (libOptions) {
        throw new Error("Not initialized");
    }
};

(function () {
    applyPolyfills();

    please.LibOptions = LibOptions;
    please.getAbsolutePath = getAbsolutePath;
    please.getLibPath = getLibPath;
    // queueLib(...) will be used for loading until ready() is called
    please.load = queueLib;

    var queue = [];

    (function () {
        // The last available script element is assumed to belong
        // to this script.
        var scripts = document.getElementsByTagName("script"),
            pleaseScript = scripts[scripts.length - 1];

        var pleasePath = pleaseScript.getAttribute("data-config") || "/please.json";

        please.root = pleasePath.substr(0, pleasePath.lastIndexOf("/"));
        if (please.root.substr(please.root.length - 1) !== "/") {
            please.root += "/";
        }

        if (pleaseScript.hasAttribute("data-cache-buster")) {
            please.cacheBuster = pleaseScript.getAttribute("data-cache-buster");
        }

        // Load options from please.json
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                var data = JSON.parse(this.responseText);

                if (data.libs) {
                    var props = Object.getOwnPropertyNames(data.libs);
                    for (var i in props) {
                        var lib = props[i];
                        please.libs[lib] = new LibOptions(lib, data.libs[lib]);
                    }
                }

                ready();
            }
        };
        var pleasePath = getAbsolutePath("please.json");
        xmlhttp.open("GET", pleasePath, true);
        xmlhttp.send();
    })();

    function queueLib(lib, callback) {
        queue.push({
            lib: lib,
            callback: callback
        });
    }

    /**
     * Swaps in script loader and load queued scripts.
     */
    function ready() {
        please.load = load;
        for (var i in queue) {
            var item = queue[i];
            load(item.lib, item.callback);
        }
    }

    /**
     * Asyncronously loads lib, and notifies the caller once loaded via callback.
     * @param {string} lib The lib to load.
     * @param {Function} callback Called once lib is loaded.
     */
    function load(lib, callback) {
        var libOptions = please.libs[lib];

        if (!libOptions) {
            libOptions = new LibOptions(lib, {});
            please.libs[lib] = libOptions;
            console.debug("Automatically created " + lib);
        }

        if (libOptions.loaded) {
            if (callback) {
                callback();
            }
            return;
        }

        if (libOptions.deps && libOptions.deps.length > 0) {
            var loadedDeps = 0;
            for (var i in libOptions.deps) {
                var depLib = libOptions.deps[i];
                load(depLib, function () {
                    loadedDeps++;
                    if (loadedDeps >= libOptions.deps.length) {
                        loadLib(libOptions, callback);
                    }
                });
            }
        }
        else {
            loadLib(libOptions, callback);
        }
    }

    function loadLib(libOptions, callback) {

        if (libOptions.loaded) {
            if (callback) {
                callback();
            }
            return;
        }

        if (libOptions.onload) {
            // Subscribe to onload event.
            console.debug("Awaiting " + libOptions.lib);

            libOptions.onload.push(function () {
                console.debug("Awaited " + libOptions.lib);
                if (callback) {
                    callback();
                }
            });
        }
        else {
            // Load resource
            console.debug("Loading " + libOptions.lib);

            libOptions.onload = [];

            for (var i in please.rules) {
                var rule = please.rules[i];
                if (new RegExp(rule.test, "i").test(libOptions.file)) {

                    var useNumber = rule.use.length - 1;
                    function pluginCallback(state) {
                        useNumber--;
                        if (useNumber >= 0) {
                            // Execute next plugin, passing the state forward, which could be anything including undefined.
                            please.plugins[rule.use[useNumber]](libOptions, pluginCallback, state);
                        }
                        else {
                            // All plugins have finished executing.
                            console.debug("Loaded " + libOptions.lib);
                            libOptions.loaded = true;
                            if (callback) {
                                // Notify the original caller.
                                callback();
                            }
                            // Notify additional callers that started waiting
                            // after the original call but before loaded.
                            for (var i in libOptions.onload) {
                                libOptions.onload[i]();
                            }
                            libOptions.onload = null;
                        }
                    };

                    // Pass plugin callbacks that will trigger callback
                    // after all plugins have executed their intermediate callback.
                    please.plugins[rule.use[useNumber]](libOptions, pluginCallback);

                    // Only the first matched rule will run.
                    return;
                }
            }

            throw new Error("Failed to find a rule for lib '" + libOptions.lib + "'.");
        }
    }

    // Helpers

    /**
     * Lib options
     * @param {string} lib The name of the lib.
     * @param {any} values Values
     * @property {string} route The route to the lib.
     * @property {string[]} deps Other libraries this one depends on.
     */
    function LibOptions(lib, values) {
        this.lib = lib;
        this.file = lib;
        this.deps = [];
        this.loaded = false;
        this.onload = null;
        //this.type = "text/javascript";
        //this.route = "lib/[lib]/[lib].min.js";

        Object.assign(this, values);
    }

    /**
     * @param {string} relative A relative path.
     * @returns {string} path An absolute path.
     */
    function getAbsolutePath(relative) {
        return please.root + relative + (please.cacheBuster ? (relative.indexOf("?") >= 0 ? "&" : "?v=") + please.cacheBuster : "");
    }

    /**
     * @param {please.LibOptions} libOptions A object of libOptions.
     * @returns {string} An absolute path.
     */
    function getLibPath(libOptions) {
        var relative = libOptions.route ?
            libOptions.route.replace(/\[lib\]/gi, libOptions.lib) :
            libOptions.file;
        return getAbsolutePath(relative);
    }

    function applyPolyfills() {

        if (typeof Object.assign !== 'function') {
            // Must be writable: true, enumerable: false, configurable: true
            Object.defineProperty(Object, "assign", {
                value: function assign(target, varArgs) { // .length of function is 2
                    'use strict';
                    if (target === null) { // TypeError if undefined or null
                        throw new TypeError('Cannot convert undefined or null to object');
                    }

                    var to = Object(target);

                    for (var index = 1; index < arguments.length; index++) {
                        var nextSource = arguments[index];

                        if (nextSource !== null) { // Skip over if undefined or null
                            for (var nextKey in nextSource) {
                                // Avoid bugs when hasOwnProperty is shadowed
                                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                                    to[nextKey] = nextSource[nextKey];
                                }
                            }
                        }
                    }
                    return to;
                },
                writable: true,
                configurable: true
            });
        }
    }

})();