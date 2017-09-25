/* eslint-disable no-multi-spaces, key-spacing */
import {isDefined} from 'neon-extension-framework/core/helpers';
import Identifier, {KeyType} from 'neon-extension-framework/models/identifier';

import EventEmitter from 'eventemitter3';

import Log from 'neon-extension-source-netflix/core/logger';
import ApplicationObserver from '../application/observer';
import PlayerObserver from './observer';


export default class PlayerMonitor extends EventEmitter {
    constructor() {
        super();

        // Construct application observer
        this.application = new ApplicationObserver();
        this.application.on('navigate.from',    this._onNavigateFrom.bind(this));
        this.application.on('navigate.to',      this._onNavigateTo.bind(this));

        // Construct player observer
        this.player = new PlayerObserver();
        this.player.on('opened',    this._onOpened.bind(this));
        this.player.on('closed',    this._onClosed.bind(this));
        this.player.on('loaded',    this._onLoaded.bind(this));

        this.player.on('started',   this._onStarted.bind(this));

        this.player.on('seeked',    this.emit.bind(this, 'seeked'));
        this.player.on('progress',  this.emit.bind(this, 'progress'));
        this.player.on('paused',    this.emit.bind(this, 'paused'));
        this.player.on('stopped',   this.emit.bind(this, 'stopped'));

        // Private attributes
        this._currentIdentifier = null;
        this._currentMountPoint = null;
    }

    bind(document) {
        return this._getMountPoint(document)
            .then((mountPoint) => {
                this._currentMountPoint = mountPoint;

                // Fire event
                this.emit('bound', this._currentMountPoint);

                // Initial application update
                this.application.update();

                // Bind application observer
                return this.application.bind(mountPoint);
            });
    }

    // region Event handlers

    _onOpened() {
        // Update current identifier
        return this._getIdentifier()
            .then((identifier) => {
                // Emit "opened" event
                this.emit('opened', identifier);
                return true;
            }, (err) => {
                Log.warn('Unable to retrieve identifier, error:', err);
            });
    }

    _onClosed() {
        // Emit "closed" event
        this.emit('closed', this._currentIdentifier);
        return true;
    }

    _onLoaded() {
        // Update current identifier
        return this._updateIdentifier()
            .then((changed) => {
                // Emit "created" event (if the identifier has changed)
                if(changed) {
                    Log.trace('Identifier changed, emitting "created" event (identifier: %o)', this._currentIdentifier);
                    this.emit('created', this._currentIdentifier);
                } else {
                    this.emit('loaded', this._currentIdentifier);
                }

                return true;
            }, (err) => {
                Log.warn('Unable to update identifier, error:', err);
            });
    }

    _onStarted() {
        Log.trace('Started');

        // Update current identifier
        return this._updateIdentifier()
            .then((changed) => {
                // Emit event
                if(changed) {
                    Log.trace('Identifier changed, emitting "created" event (identifier: %o)', this._currentIdentifier);
                    this.emit('created', this._currentIdentifier);
                } else {
                    this.emit('started');
                }

                return true;
            }, (err) => {
                Log.warn('Unable to update identifier, error:', err);
            });
    }

    _onNavigateFrom(path) {
        if(path.startsWith('/watch')) {
            this.player.dispose();
        }
    }

    _onNavigateTo(path) {
        if(path.startsWith('/watch')) {
            this.player.bind(this._currentMountPoint);
        }
    }

    // endregion

    // region Private methods

    _getIdentifier() {
        let path = location.pathname;

        // Retrieve video key
        let videoId = path.substring(path.lastIndexOf('/') + 1);

        if(!videoId || videoId.length < 1) {
            return null;
        }

        return Promise.resolve(new Identifier(
            KeyType.Unknown, parseInt(videoId, 10)
        ));
    }

    _getMountPoint(document) {
        return new Promise((resolve, reject) => {
            let retries = 0;

            let get = () => {
                let node = document.querySelector('#appMountPoint');

                if(!isDefined(node)) {
                    Log.info('Unable to find the "#appMountPoint" element, will try again in 500ms');

                    if(retries < 10) {
                        retries++;
                        setTimeout(get, 500);
                        return;
                    }

                    reject(new Error('Unable to find application mount point'));
                    return;
                }

                // Resolve promise with node
                resolve(node);
            };

            get();
        });
    }

    _updateIdentifier() {
        return this._getIdentifier()
            .then((identifier) => {
                // Determine if content has changed
                if(identifier === this._currentIdentifier) {
                    return false;
                }

                if(isDefined(identifier) && identifier.matches(this._currentIdentifier)) {
                    return false;
                }

                // Update state
                this._currentIdentifier = identifier;
                return true;
            });
    }

    // endregion
}
