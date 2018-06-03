/* eslint-disable no-multi-spaces, key-spacing */
import EventEmitter from 'eventemitter3';
import IsNil from 'lodash-es/isNil';

import Log from '../Core/Logger';


export default class VideoObserver extends EventEmitter {
    constructor() {
        super();

        this._listeners = {};

        this._loaded = false;
        this._node = null;
    }

    // region Public Methods

    start(node) {
        if(IsNil(node)) {
            throw new Error(`Invalid video: ${node}`);
        }

        // Ensure we aren't already observing this video
        if(this._node === node) {
            Log.trace('Already observing video: %o', node);
            return true;
        }

        // Stop existing video observations
        if(!IsNil(this._node)) {
            this.stop();
        }

        Log.trace('Observing video: %o', node);

        // Update state
        this._loaded = false;
        this._node = node;

        // Bind events
        this._addEventListener('loadstart',         () => this.emit('loading'));
        this._addEventListener('loadedmetadata',    () => this.load());

        this._addEventListener('playing',           () => this.emit('started'));
        this._addEventListener('pause',             () => this.emit('paused'));
        this._addEventListener('ended',             () => this.emit('stopped'));

        this._addEventListener('seeked',            () => this.emit('seeked', this._getTime()));

        this._addEventListener('timeupdate',        () => {
            if(this.load()) {
                return;
            }

            // Emit "progress" event
            this.emit('progress', this._getTime());
        });

        // Emit "loading" event
        this.emit('loading');

        // Emit "loaded" event (if already loaded)
        if(this._node.readyState >= 2) {
            this.load();
        }

        return true;
    }

    load() {
        if(this._loaded) {
            return false;
        }

        // Update state
        this._loaded = true;

        // Emit "loaded" event
        this.emit('loaded');
        return true;
    }

    stop(node = null) {
        if(IsNil(this._node)) {
            return false;
        }

        if(!IsNil(node) && this._node !== node) {
            return false;
        }

        // Unbind events
        this._removeEventListeners();

        // Update state
        this._node = null;

        Log.trace('Stopped observing video');
        return true;
    }

    getDuration() {
        if(IsNil(this._node) || this._node.duration === 0) {
            return null;
        }

        return this._node.duration * 1000;
    }

    // endregion

    // region Private Methods

    _getTime() {
        if(IsNil(this._node) || this._node.currentTime === 0) {
            return null;
        }

        return this._node.currentTime * 1000;
    }

    _addEventListener(type, listener) {
        if(IsNil(this._node)) {
            return false;
        }

        Log.trace('Listening for video %o events', type);

        // Add event listener
        this._node.addEventListener(type, listener);

        // Store listener reference (for later cleanup)
        if(IsNil(this._listeners[type])) {
            this._listeners[type] = [];
        }

        this._listeners[type].push(listener);

        return true;
    }

    _removeEventListeners() {
        if(IsNil(this._node)) {
            return false;
        }

        for(let type in this._listeners) {
            if(!this._listeners.hasOwnProperty(type)) {
                continue;
            }

            let listeners = this._listeners[type];

            for(let i = 0; i < listeners.length; ++i) {
                let listener = listeners[i];

                Log.trace('Stopped listening for video %o events', type);

                // Remove event listener
                this._node.removeEventListener(type, listener);
            }

            // Create new array
            this._listeners[type] = [];
        }

        return true;
    }

    // endregion
}
