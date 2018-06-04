/* eslint-disable no-console, no-new */
import EventEmitter from 'eventemitter3';
import IsNil from 'lodash-es/isNil';

import {retry} from 'neon-extension-framework/Utilities/Promise';


export class ShimRequests extends EventEmitter {
    constructor() {
        super();

        // Ensure body exists
        if(IsNil(document.body)) {
            throw new Error('Body is not available');
        }

        // Bind to events
        this._bind('neon.request', (e) => this._onRequest(e));
    }

    _bind(event, callback) {
        try {
            document.body.addEventListener(event, callback);
        } catch(e) {
            console.error('Unable to bind to "%s"', event, e);
            return false;
        }

        console.debug('Bound to "%s"', event);
        return true;
    }

    _onRequest(e) {
        if(!e || !e.detail) {
            console.error('Invalid request received:', e);
            return;
        }

        // Decode request
        let request;

        try {
            request = JSON.parse(e.detail);
        } catch(err) {
            console.error('Unable to decode request: %s', err && err.message, err);
            return;
        }

        // Emit request
        this.emit(request.type, ...request.args);
    }
}

export class Shim {
    constructor() {
        this.requests = new ShimRequests();
        this.requests.on('configuration', () => this.configuration());

        // Emit "configuration" event
        this.configuration();
    }

    configuration() {
        retry(() => {
            if(IsNil(window.netflix)) {
                return Promise.reject(new Error('Unable to find "netflix" object'));
            }

            if(IsNil(window.netflix.reactContext)) {
                return Promise.reject(new Error('Unable to find "netflix.reactContext" object'));
            }

            if(IsNil(window.netflix.reactContext.models)) {
                return Promise.reject(new Error('Unable to find "netflix.reactContext.models" object'));
            }

            let models = window.netflix.reactContext.models;

            // Build configuration object
            let configuration = {
                serverDefs: models && models.serverDefs && models.serverDefs.data,
                userInfo: models && models.userInfo && models.userInfo.data
            };

            // Validate configuration
            if(IsNil(configuration.userInfo)) {
                return Promise.reject(new Error('Invalid "serverDefs" model'));
            }

            if(IsNil(configuration.userInfo)) {
                return Promise.reject(new Error('Invalid "userInfo" model'));
            }

            // Resolve with configuration
            return configuration;
        }).then((configuration) => {
            // Emit "configuration" event
            this._emit('configuration', configuration);
        }, (err) => {
            console.error('Unable to retrieve configuration', err && err.message ? err.message : err);

            // Emit "configuration" event
            this._emit('configuration', null);
        });
    }

    // region Private Methods

    _emit(type, ...args) {
        // Construct event
        let event = new CustomEvent('neon.event', {
            detail: JSON.stringify({
                type: type,
                args: args || []
            })
        });

        // Emit event on the document
        document.body.dispatchEvent(event);
    }

    // endregion
}

// Construct shim
(new Shim());
