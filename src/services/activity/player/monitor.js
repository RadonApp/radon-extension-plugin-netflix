/* eslint-disable no-multi-spaces, key-spacing */
import EventEmitter from 'eventemitter3';
import IsNil from 'lodash-es/isNil';

// import {Movie, Show, Season, Episode} from 'neon-extension-framework/models/item/video';

import Log from '../../../core/logger';
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
        this._currentItem = null;
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
        return this._getItem().then((item) => {
            // Emit "opened" event
            this.emit('opened', item);
            return true;
        }, (err) => {
            Log.warn('Unable to retrieve identifier, error:', err);
        });
    }

    _onClosed() {
        // Emit "closed" event
        this.emit('closed', this._currentItem);
        return true;
    }

    _onLoaded() {
        // Update current identifier
        return this._updateItem().then((changed) => {
            // Emit "created" event (if the identifier has changed)
            if(changed) {
                Log.trace('Identifier changed, emitting "created" event (identifier: %o)', this._currentItem);
                this.emit('created', this._currentItem);
            } else {
                this.emit('loaded', this._currentItem);
            }

            return true;
        }, (err) => {
            Log.warn('Unable to update identifier, error:', err);
        });
    }

    _onStarted() {
        Log.trace('Started');

        // Update current identifier
        return this._updateItem()
            .then((changed) => {
                // Emit event
                if(changed) {
                    Log.trace('Identifier changed, emitting "created" event (identifier: %o)', this._currentItem);
                    this.emit('created', this._currentItem);
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

    _getItem() {
        throw new Error('TODO: Implement PlayerMonitor._getItem()');
    }

    _createItem() {
        throw new Error('TODO: Implement PlayerMonitor._createItem()');
    }

    _getMountPoint(document) {
        return new Promise((resolve, reject) => {
            let retries = 0;

            let get = () => {
                let node = document.querySelector('#appMountPoint');

                if(IsNil(node)) {
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

    _updateItem() {
        return this._getItem().then((item) => {
            // Determine if content has changed
            if(item === this._currentItem) {
                return false;
            }

            if(!IsNil(item) && item.matches(this._currentItem)) {
                return false;
            }

            // Update state
            this._currentItem = item;
            return true;
        });
    }

    // endregion
}
